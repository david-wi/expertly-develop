import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AgentSettings } from "../App";

interface SettingsProps {
  settings: AgentSettings;
  onSave: (settings: AgentSettings) => void;
  onCancel: () => void;
}

export default function Settings({ settings, onSave, onCancel }: SettingsProps) {
  const [formData, setFormData] = useState<AgentSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectDirectory = async () => {
    const dir = await invoke<string | null>("select_directory");
    if (dir) {
      setFormData({ ...formData, workingDirectory: dir });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-expertly-primary text-white p-4">
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Server URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Server URL
          </label>
          <input
            type="text"
            value={formData.serverUrl}
            onChange={(e) =>
              setFormData({ ...formData, serverUrl: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-expertly-primary font-mono text-sm"
            placeholder="ws://vibecode.ai.devintensive.com"
          />
          <p className="mt-1 text-xs text-gray-500">
            WebSocket server address
          </p>
        </div>

        {/* Working Directory */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Working Directory
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.workingDirectory}
              onChange={(e) =>
                setFormData({ ...formData, workingDirectory: e.target.value })
              }
              className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-expertly-primary font-mono text-sm"
            />
            <button
              type="button"
              onClick={handleSelectDirectory}
              className="px-3 py-2 border rounded-md hover:bg-gray-50"
            >
              Browse
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Default directory for file operations
          </p>
        </div>

        {/* Max Concurrent Commands */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Concurrent Commands
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={formData.maxConcurrentCommands}
            onChange={(e) =>
              setFormData({
                ...formData,
                maxConcurrentCommands: parseInt(e.target.value) || 5,
              })
            }
            className="w-24 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-expertly-primary"
          />
          <p className="mt-1 text-xs text-gray-500">
            Maximum number of commands to run simultaneously
          </p>
        </div>

        {/* Checkboxes */}
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.autoStartOnLogin}
              onChange={(e) =>
                setFormData({ ...formData, autoStartOnLogin: e.target.checked })
              }
              className="rounded text-expertly-primary focus:ring-expertly-primary"
            />
            <span className="text-sm text-gray-700">
              Start automatically on login
            </span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.autoConnectOnLaunch}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  autoConnectOnLaunch: e.target.checked,
                })
              }
              className="rounded text-expertly-primary focus:ring-expertly-primary"
            />
            <span className="text-sm text-gray-700">
              Connect automatically on launch
            </span>
          </label>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
          <p className="font-medium">Resource Limits</p>
          <ul className="mt-1 text-xs space-y-1">
            <li>Commands are queued when CPU &gt; 80%</li>
            <li>Commands are queued when Memory &gt; 85%</li>
            <li>Command timeout: 2 minutes</li>
          </ul>
        </div>
      </form>

      {/* Actions */}
      <div className="p-4 border-t bg-white flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border rounded hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="flex-1 bg-expertly-primary text-white px-4 py-2 rounded hover:bg-expertly-secondary transition-colors disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
