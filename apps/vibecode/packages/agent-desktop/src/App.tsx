import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import StatusWindow from "./components/StatusWindow";
import Settings from "./components/Settings";

type View = "status" | "settings";

export interface LogEntry {
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

export interface SystemMetrics {
  cpuPercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  memoryPercent: number;
  activeCommands: number;
  queuedTasks: number;
}

export interface AgentSettings {
  serverUrl: string;
  workingDirectory: string;
  maxConcurrentCommands: number;
  autoStartOnLogin: boolean;
  autoConnectOnLaunch: boolean;
}

export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "connecting"
  | "working"
  | "paused";

interface StatusUpdate {
  status: ConnectionStatus;
  metrics: SystemMetrics;
  logs: LogEntry[];
  agentId: string | null;
}

function App() {
  const [view, setView] = useState<View>("status");
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpuPercent: 0,
    memoryUsedMb: 0,
    memoryTotalMb: 0,
    memoryPercent: 0,
    activeCommands: 0,
    queuedTasks: 0,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<{
    version: string;
    body: string;
  } | null>(null);

  useEffect(() => {
    // Load initial settings
    invoke<AgentSettings>("get_settings").then(setSettings);
    invoke<LogEntry[]>("get_logs").then(setLogs);

    // Listen for status updates
    const unlisten = listen<StatusUpdate>("status-update", (event) => {
      setStatus(event.payload.status);
      setMetrics(event.payload.metrics);
      setLogs(event.payload.logs);
      if (event.payload.agentId) {
        setAgentId(event.payload.agentId);
      }
    });

    // Listen for tray events
    const unlistenSettings = listen("tray-settings", () => {
      setView("settings");
    });

    // Listen for update available
    const unlistenUpdate = listen<{ version: string; body: string }>(
      "update-available",
      (event) => {
        setUpdateAvailable(event.payload);
      }
    );

    return () => {
      unlisten.then((fn) => fn());
      unlistenSettings.then((fn) => fn());
      unlistenUpdate.then((fn) => fn());
    };
  }, []);

  const handleConnect = async () => {
    await invoke("connect");
  };

  const handleDisconnect = async () => {
    await invoke("disconnect");
    setStatus("disconnected");
  };

  const handleSaveSettings = async (newSettings: AgentSettings) => {
    await invoke("update_settings", { settings: newSettings });
    setSettings(newSettings);
    setView("status");
  };

  const handleCheckUpdates = async () => {
    const hasUpdate = await invoke<boolean>("check_for_updates");
    if (!hasUpdate) {
      // Could show a toast/notification
    }
  };

  const handleInstallUpdate = async () => {
    await invoke("install_update");
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-expertly-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {view === "status" ? (
        <StatusWindow
          status={status}
          metrics={metrics}
          logs={logs}
          settings={settings}
          agentId={agentId}
          updateAvailable={updateAvailable}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onOpenSettings={() => setView("settings")}
          onCheckUpdates={handleCheckUpdates}
          onInstallUpdate={handleInstallUpdate}
        />
      ) : (
        <Settings
          settings={settings}
          onSave={handleSaveSettings}
          onCancel={() => setView("status")}
        />
      )}
    </div>
  );
}

export default App;
