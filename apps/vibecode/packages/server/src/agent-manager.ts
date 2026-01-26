import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

interface SystemInfo {
  cpus: number;
  totalMemoryMB: number;
  hostname: string;
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

interface Agent {
  id: string;
  ws: WebSocket;
  workingDir: string;
  platform: string;
  version: string;
  connectedAt: Date;
  systemInfo?: SystemInfo;
  lastMetrics?: SystemMetrics;
  lastMetricsAt?: Date;
}

interface PendingRequest {
  resolve: (result: string) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class AgentManager {
  private agents = new Map<string, Agent>();
  private pendingRequests = new Map<string, PendingRequest>();

  registerAgent(ws: WebSocket, workingDir: string, platform: string, version: string, systemInfo?: SystemInfo): string {
    const agentId = uuidv4();
    const agent: Agent = {
      id: agentId,
      ws,
      workingDir,
      platform,
      version,
      connectedAt: new Date(),
      systemInfo
    };
    this.agents.set(agentId, agent);
    console.log(`[AgentManager] Agent registered: ${agentId} (${platform}, cwd: ${workingDir})`);
    if (systemInfo) {
      console.log(`[AgentManager]   System: ${systemInfo.cpus} CPUs, ${systemInfo.totalMemoryMB}MB RAM, host: ${systemInfo.hostname}`);
    }
    return agentId;
  }

  updateAgentMetrics(ws: WebSocket, metrics: SystemMetrics): void {
    const agent = this.findAgentBySocket(ws);
    if (agent) {
      agent.lastMetrics = metrics;
      agent.lastMetricsAt = new Date();
    }
  }

  getAgentInfo(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    console.log(`[AgentManager] Agent unregistered: ${agentId}`);
  }

  findAgentBySocket(ws: WebSocket): Agent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.ws === ws) {
        return agent;
      }
    }
    return undefined;
  }

  hasConnectedAgent(): boolean {
    // Check if any agent is connected and has open websocket
    for (const agent of this.agents.values()) {
      if (agent.ws.readyState === WebSocket.OPEN) {
        return true;
      }
    }
    return false;
  }

  getConnectedAgents(): Agent[] {
    return Array.from(this.agents.values()).filter(
      a => a.ws.readyState === WebSocket.OPEN
    );
  }

  getAgentDetails() {
    return this.getConnectedAgents().map(a => ({
      id: a.id,
      workingDir: a.workingDir,
      platform: a.platform,
      version: a.version,
      connectedAt: a.connectedAt,
      systemInfo: a.systemInfo,
      metrics: a.lastMetrics,
      metricsAt: a.lastMetricsAt
    }));
  }

  async executeToolOnAgent(
    tool: string,
    input: Record<string, unknown>,
    cwd: string,
    sessionId: string
  ): Promise<string> {
    const agents = this.getConnectedAgents();
    if (agents.length === 0) {
      throw new Error('No local agent connected. Run vibecode-agent on your machine.');
    }

    // Use the first available agent (could be smarter about selection)
    const agent = agents[0];
    const requestId = uuidv4();

    return new Promise((resolve, reject) => {
      // Set timeout for request
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Tool execution timed out'));
      }, 120000); // 2 minute timeout

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Send tool request to agent
      agent.ws.send(JSON.stringify({
        type: 'tool_request',
        requestId,
        sessionId,
        tool,
        input,
        cwd
      }));
    });
  }

  handleToolResponse(requestId: string, result: string, error?: string): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      console.warn(`[AgentManager] No pending request for: ${requestId}`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);

    if (error) {
      pending.reject(new Error(error));
    } else {
      pending.resolve(result);
    }
  }
}

// Singleton instance
export const agentManager = new AgentManager();
