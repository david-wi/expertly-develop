import type {
  ConnectionStatus,
  SystemMetrics,
  LogEntry,
  AgentSettings,
} from "../App";
import LogViewer from "./LogViewer";

interface StatusWindowProps {
  status: ConnectionStatus;
  metrics: SystemMetrics;
  logs: LogEntry[];
  settings: AgentSettings;
  agentId: string | null;
  updateAvailable: { version: string; body: string } | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onOpenSettings: () => void;
  onCheckUpdates: () => void;
  onInstallUpdate: () => void;
}

const statusColors: Record<ConnectionStatus, string> = {
  connected: "bg-green-500",
  working: "bg-yellow-500 animate-pulse",
  disconnected: "bg-red-500",
  connecting: "bg-gray-400 animate-pulse",
  paused: "bg-gray-400",
};

const statusText: Record<ConnectionStatus, string> = {
  connected: "Connected",
  working: "Working...",
  disconnected: "Disconnected",
  connecting: "Connecting...",
  paused: "Paused",
};

export default function StatusWindow({
  status,
  metrics,
  logs,
  settings,
  agentId,
  updateAvailable,
  onConnect,
  onDisconnect,
  onOpenSettings,
  onCheckUpdates: _onCheckUpdates,
  onInstallUpdate,
}: StatusWindowProps) {
  void _onCheckUpdates; // Can be triggered from tray menu
  const isConnected = status === "connected" || status === "working";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-expertly-primary text-white p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Vibecode Agent</h1>
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${statusColors[status]}`}
            ></span>
            <span className="text-sm">{statusText[status]}</span>
          </div>
        </div>
        {agentId && (
          <div className="text-xs text-indigo-200 mt-1">
            Agent ID: {agentId.substring(0, 8)}...
          </div>
        )}
      </div>

      {/* Update Banner */}
      {updateAvailable && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-blue-800">
            Update available: v{updateAvailable.version}
          </span>
          <button
            onClick={onInstallUpdate}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            Install
          </button>
        </div>
      )}

      {/* Connection Info */}
      <div className="p-4 border-b bg-white">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-wide">
              Server
            </div>
            <div className="font-mono text-xs truncate" title={settings.serverUrl}>
              {settings.serverUrl}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-wide">
              Working Dir
            </div>
            <div
              className="font-mono text-xs truncate"
              title={settings.workingDirectory}
            >
              {settings.workingDirectory}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="p-4 border-b bg-white">
        <div className="grid grid-cols-4 gap-2 text-center">
          <MetricCard
            label="CPU"
            value={`${metrics.cpuPercent.toFixed(1)}%`}
            warning={metrics.cpuPercent > 80}
          />
          <MetricCard
            label="Memory"
            value={`${metrics.memoryPercent.toFixed(1)}%`}
            warning={metrics.memoryPercent > 85}
          />
          <MetricCard
            label="Active"
            value={String(metrics.activeCommands)}
            highlight={metrics.activeCommands > 0}
          />
          <MetricCard
            label="Queued"
            value={String(metrics.queuedTasks)}
            warning={metrics.queuedTasks > 0}
          />
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-hidden">
        <LogViewer logs={logs} />
      </div>

      {/* Actions */}
      <div className="p-4 border-t bg-white flex gap-2">
        {isConnected ? (
          <button
            onClick={onDisconnect}
            className="flex-1 bg-red-100 text-red-700 px-4 py-2 rounded hover:bg-red-200 transition-colors"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          >
            Connect
          </button>
        )}
        <button
          onClick={onOpenSettings}
          className="px-4 py-2 border rounded hover:bg-gray-50 transition-colors"
        >
          Settings
        </button>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  warning?: boolean;
  highlight?: boolean;
}

function MetricCard({ label, value, warning, highlight }: MetricCardProps) {
  return (
    <div
      className={`p-2 rounded ${
        warning
          ? "bg-red-50 text-red-700"
          : highlight
          ? "bg-blue-50 text-blue-700"
          : "bg-gray-50"
      }`}
    >
      <div className="text-xs text-gray-500 uppercase">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
