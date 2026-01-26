#!/usr/bin/env node
import { WebSocket } from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { glob } from 'glob';
import { Command } from 'commander';
import chalk from 'chalk';
import pidusage from 'pidusage';

const VERSION = '0.1.0';

// Configuration
const MAX_CPU_PERCENT = 80;  // Queue new tasks when CPU > 80%
const MAX_MEMORY_PERCENT = 85;  // Queue new tasks when memory > 85%
const MAX_CONCURRENT_COMMANDS = 5;  // Max simultaneous command executions
const STATUS_INTERVAL_MS = 5000;  // Send status updates every 5 seconds

interface ToolRequest {
  type: 'tool_request';
  requestId: string;
  sessionId: string;
  tool: string;
  input: Record<string, unknown>;
  cwd: string;
}

interface ToolResponse {
  type: 'tool_response';
  requestId: string;
  sessionId: string;
  result: string;
  error?: string;
  metrics?: ProcessMetrics;
  queued?: boolean;
  queuePosition?: number;
}

interface ProcessMetrics {
  cpuPercent: number;
  memoryMB: number;
  durationMs: number;
}

interface SystemMetrics {
  cpuPercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  memoryPercent: number;
  loadAvg: number[];
  activeCommands: number;
  queuedTasks: number;
}

interface QueuedTask {
  request: ToolRequest;
  queuedAt: number;
}

// Get current system metrics
function getSystemMetrics(activeCommands: number, queueLength: number): SystemMetrics {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  // Calculate CPU usage from all cores
  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  }
  const cpuPercent = 100 - (100 * totalIdle / totalTick);

  return {
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    memoryUsedMB: Math.round(usedMem / 1024 / 1024),
    memoryTotalMB: Math.round(totalMem / 1024 / 1024),
    memoryPercent: Math.round((usedMem / totalMem) * 100 * 10) / 10,
    loadAvg: os.loadavg(),
    activeCommands,
    queuedTasks: queueLength
  };
}

// Check if system is under high load
function isSystemOverloaded(metrics: SystemMetrics): boolean {
  return metrics.cpuPercent > MAX_CPU_PERCENT ||
         metrics.memoryPercent > MAX_MEMORY_PERCENT;
}

// Execute a command and track its resource usage
async function executeCommandWithMetrics(
  command: string,
  cwd: string
): Promise<{ output: string; metrics: ProcessMetrics }> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
    const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

    const child: ChildProcess = spawn(shell, shellArgs, {
      cwd,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let peakCpu = 0;
    let peakMemory = 0;
    let metricsInterval: NodeJS.Timeout | null = null;

    // Track process metrics while running
    if (child.pid) {
      metricsInterval = setInterval(async () => {
        try {
          if (child.pid) {
            const stats = await pidusage(child.pid);
            peakCpu = Math.max(peakCpu, stats.cpu);
            peakMemory = Math.max(peakMemory, stats.memory);
          }
        } catch {
          // Process may have ended
        }
      }, 100);
    }

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Command timed out after 2 minutes'));
    }, 120000);

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (metricsInterval) clearInterval(metricsInterval);

      const durationMs = Date.now() - startTime;
      const metrics: ProcessMetrics = {
        cpuPercent: Math.round(peakCpu * 10) / 10,
        memoryMB: Math.round(peakMemory / 1024 / 1024 * 10) / 10,
        durationMs
      };

      if (code === 0 || stdout || stderr) {
        resolve({
          output: stdout || stderr || '(command completed with no output)',
          metrics
        });
      } else {
        reject(new Error(`Command exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      if (metricsInterval) clearInterval(metricsInterval);
      reject(error);
    });
  });
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  cwd: string
): Promise<{ result: string; metrics?: ProcessMetrics }> {
  // Ensure cwd exists
  if (!existsSync(cwd)) {
    return { result: `Error: Working directory not found: ${cwd}` };
  }

  try {
    switch (name) {
      case 'read_file': {
        const filePath = path.resolve(cwd, input.path as string);
        if (!existsSync(filePath)) {
          return { result: `Error: File not found: ${filePath}` };
        }
        const content = await fs.readFile(filePath, 'utf-8');
        return { result: content };
      }

      case 'write_file': {
        const filePath = path.resolve(cwd, input.path as string);
        const dir = path.dirname(filePath);
        if (!existsSync(dir)) {
          await fs.mkdir(dir, { recursive: true });
        }
        await fs.writeFile(filePath, input.content as string, 'utf-8');
        return { result: `Successfully wrote to ${filePath}` };
      }

      case 'list_files': {
        const dirPath = path.resolve(cwd, input.path as string);
        if (!existsSync(dirPath)) {
          return { result: `Error: Directory not found: ${dirPath}` };
        }
        const pattern = (input.pattern as string) || '*';
        const files = await glob(pattern, { cwd: dirPath });
        return { result: files.length > 0 ? files.join('\n') : '(no files found)' };
      }

      case 'run_command': {
        const command = input.command as string;
        console.log(chalk.dim(`  Running: ${command}`));
        const { output, metrics } = await executeCommandWithMetrics(command, cwd);
        console.log(chalk.dim(`  └─ CPU: ${metrics.cpuPercent}%, Mem: ${metrics.memoryMB}MB, Time: ${metrics.durationMs}ms`));
        return { result: output, metrics };
      }

      case 'search_files': {
        const searchPath = path.resolve(cwd, (input.path as string) || '.');
        const pattern = input.pattern as string;
        try {
          const cmd = process.platform === 'win32'
            ? `findstr /s /i /m "${pattern}" "${searchPath}\\*"`
            : `grep -r "${pattern}" "${searchPath}" --include="*" -l 2>/dev/null || true`;
          const { output, metrics } = await executeCommandWithMetrics(cmd, cwd);
          return { result: output || 'No matches found', metrics };
        } catch {
          return { result: 'No matches found' };
        }
      }

      default:
        return { result: `Unknown tool: ${name}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}`));
    return { result: `Error: ${message}` };
  }
}

function connect(serverUrl: string, workingDir: string, maxConcurrent: number) {
  console.log(chalk.blue.bold('\n  Expertly VibeCode Local Agent v' + VERSION));
  console.log(chalk.dim('  ─────────────────────────────────────'));
  console.log(chalk.white(`  Server:      ${serverUrl}`));
  console.log(chalk.white(`  CWD:         ${workingDir}`));
  console.log(chalk.white(`  Max parallel: ${maxConcurrent}`));
  console.log(chalk.white(`  CPU limit:   ${MAX_CPU_PERCENT}%`));
  console.log(chalk.white(`  Memory limit: ${MAX_MEMORY_PERCENT}%`));
  console.log(chalk.dim('  ─────────────────────────────────────\n'));

  const ws = new WebSocket(serverUrl);
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let pingInterval: NodeJS.Timeout | null = null;
  let statusInterval: NodeJS.Timeout | null = null;

  // Task management
  let activeCommands = 0;
  const taskQueue: QueuedTask[] = [];

  // Process queued tasks
  function processQueue() {
    const metrics = getSystemMetrics(activeCommands, taskQueue.length);

    while (taskQueue.length > 0 &&
           activeCommands < maxConcurrent &&
           !isSystemOverloaded(metrics)) {
      const task = taskQueue.shift()!;
      const waitTime = Date.now() - task.queuedAt;
      console.log(chalk.cyan(`  ▶ Dequeued: ${task.request.tool} (waited ${waitTime}ms)`));
      executeTask(task.request, false);
    }
  }

  // Execute a task
  function executeTask(request: ToolRequest, wasQueued: boolean) {
    activeCommands++;
    const queuePosition = wasQueued ? 0 : undefined;

    console.log(chalk.yellow(`  ◉ Tool: ${request.tool} [${activeCommands} active, ${taskQueue.length} queued]`));

    executeTool(
      request.tool,
      request.input,
      request.cwd || workingDir
    ).then(({ result, metrics }) => {
      const response: ToolResponse = {
        type: 'tool_response',
        requestId: request.requestId,
        sessionId: request.sessionId,
        result,
        metrics,
        queued: wasQueued,
        queuePosition
      };

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(response));
      }
      activeCommands--;
      console.log(chalk.green(`  ✓ Completed: ${request.tool} [${activeCommands} active, ${taskQueue.length} queued]`));

      // Try to process more queued tasks
      processQueue();
    }).catch((error) => {
      const response: ToolResponse = {
        type: 'tool_response',
        requestId: request.requestId,
        sessionId: request.sessionId,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(response));
      }
      activeCommands--;
      console.log(chalk.red(`  ✗ Failed: ${request.tool} [${activeCommands} active, ${taskQueue.length} queued]`));

      // Try to process more queued tasks
      processQueue();
    });
  }

  ws.on('open', () => {
    console.log(chalk.green('  ✓ Connected to server'));

    // Get initial system metrics
    const metrics = getSystemMetrics(0, 0);

    // Register as local agent with system info
    ws.send(JSON.stringify({
      type: 'agent_register',
      workingDir,
      platform: process.platform,
      version: VERSION,
      systemInfo: {
        cpus: os.cpus().length,
        totalMemoryMB: metrics.memoryTotalMB,
        hostname: os.hostname()
      }
    }));

    // Keep alive ping
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    // Send periodic status updates
    statusInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const metrics = getSystemMetrics(activeCommands, taskQueue.length);
        ws.send(JSON.stringify({
          type: 'agent_status_update',
          metrics
        }));
      }
    }, STATUS_INTERVAL_MS);
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'agent_registered') {
        console.log(chalk.green(`  ✓ Registered as agent: ${message.agentId}`));
        const metrics = getSystemMetrics(0, 0);
        console.log(chalk.dim(`  System: ${os.cpus().length} CPUs, ${metrics.memoryTotalMB}MB RAM`));
        console.log(chalk.cyan('\n  Waiting for tool requests...\n'));
      }

      if (message.type === 'tool_request') {
        const request = message as ToolRequest;
        const metrics = getSystemMetrics(activeCommands, taskQueue.length);

        // Check if we should queue this task
        const shouldQueue = activeCommands >= maxConcurrent || isSystemOverloaded(metrics);

        if (shouldQueue && request.tool === 'run_command') {
          // Queue command tasks when overloaded
          taskQueue.push({ request, queuedAt: Date.now() });
          console.log(chalk.magenta(`  ⏸ Queued: ${request.tool} [position ${taskQueue.length}] (CPU: ${metrics.cpuPercent}%, Mem: ${metrics.memoryPercent}%)`));

          // Notify caller that task is queued
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'tool_queued',
              requestId: request.requestId,
              sessionId: request.sessionId,
              queuePosition: taskQueue.length,
              reason: activeCommands >= maxConcurrent
                ? `Max concurrent commands (${maxConcurrent}) reached`
                : `System load high (CPU: ${metrics.cpuPercent}%, Mem: ${metrics.memoryPercent}%)`
            }));
          }
        } else {
          // Execute immediately for non-command tools or when not overloaded
          executeTask(request, false);
        }
      }

      if (message.type === 'get_status') {
        const metrics = getSystemMetrics(activeCommands, taskQueue.length);
        ws.send(JSON.stringify({
          type: 'agent_status_update',
          metrics
        }));
      }
    } catch (error) {
      console.error(chalk.red('  Error processing message:'), error);
    }
  });

  ws.on('close', () => {
    console.log(chalk.yellow('\n  Disconnected from server'));
    if (pingInterval) clearInterval(pingInterval);
    if (statusInterval) clearInterval(statusInterval);

    // Reconnect after delay
    console.log(chalk.dim('  Reconnecting in 5 seconds...'));
    reconnectTimeout = setTimeout(() => {
      connect(serverUrl, workingDir, maxConcurrent);
    }, 5000);
  });

  ws.on('error', (error) => {
    console.error(chalk.red('  Connection error:'), error.message);
  });

  // Handle graceful shutdown
  const shutdown = () => {
    console.log(chalk.yellow('\n  Shutting down...'));
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (pingInterval) clearInterval(pingInterval);
    if (statusInterval) clearInterval(statusInterval);
    ws.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// CLI
const program = new Command();

program
  .name('vibecode-agent')
  .description('Local agent for Expertly VibeCode')
  .version(VERSION)
  .option('-s, --server <url>', 'Server WebSocket URL', 'ws://localhost:3001')
  .option('-d, --dir <path>', 'Working directory', process.cwd())
  .option('-c, --concurrent <n>', 'Max concurrent commands', String(MAX_CONCURRENT_COMMANDS))
  .action((options: { server: string; dir: string; concurrent: string }) => {
    const serverUrl = options.server;
    const workingDir = path.resolve(options.dir);
    const maxConcurrent = parseInt(options.concurrent, 10) || MAX_CONCURRENT_COMMANDS;

    if (!existsSync(workingDir)) {
      console.error(chalk.red(`Error: Working directory not found: ${workingDir}`));
      process.exit(1);
    }

    connect(serverUrl, workingDir, maxConcurrent);
  });

program.parse(process.argv);
