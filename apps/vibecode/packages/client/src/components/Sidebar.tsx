import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Plus, Trash2, Terminal, Wifi, WifiOff, Cpu, HardDrive, Activity, Download, ExternalLink, MessageCircle, Building2, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useDashboardStore } from '../store/dashboard-store';
import type { useWebSocket } from '../hooks/useWebSocket';
import { Sidebar as SharedSidebar, createDefaultUserMenu } from '@expertly/ui';

// Try to launch the desktop agent via custom URL scheme
const tryLaunchAgent = () => {
  window.location.href = 'vibecode://connect';
};

// Storage key for tenant ID override
const TENANT_STORAGE_KEY = 'expertly-tenant-id';

// Organization type (simplified - no backend API for Vibecode yet)
interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface SidebarProps {
  ws: ReturnType<typeof useWebSocket>;
}

// Widgets Section Component
function WidgetsSection() {
  const { widgets, sessions, chatConversations, addWidget, addChatWidget, removeWidget } = useDashboardStore();
  const [showWidgetMenu, setShowWidgetMenu] = useState(false);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-500 uppercase">Widgets</h3>
        <div className="relative">
          <button
            onClick={() => setShowWidgetMenu(!showWidgetMenu)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
            title="Add widget"
          >
            <Plus className="w-4 h-4" />
          </button>
          {showWidgetMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowWidgetMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[160px]">
                <button
                  onClick={() => { addWidget('session'); setShowWidgetMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Terminal className="w-4 h-4 text-gray-500" />
                  Session Widget
                </button>
                <button
                  onClick={() => { addChatWidget(); setShowWidgetMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <MessageCircle className="w-4 h-4 text-violet-500" />
                  Chat Widget
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {widgets.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No widgets yet</p>
      ) : (
        <ul className="space-y-1">
          {widgets.map((widget) => {
            // Handle chat widgets
            if (widget.type === 'chat') {
              const conversation = widget.conversationId ? chatConversations[widget.conversationId] : null;
              const title = widget.customName || 'Chat';

              return (
                <li
                  key={widget.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-violet-50 text-gray-700"
                >
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      !conversation ? 'bg-gray-400' :
                      conversation.state === 'busy' ? 'bg-green-500 animate-pulse' :
                      conversation.state === 'idle' ? 'bg-violet-500' :
                      conversation.state === 'error' ? 'bg-red-500' :
                      'bg-gray-400'
                    )}
                  />
                  <MessageCircle className="w-3 h-3 text-violet-500 flex-shrink-0" />
                  <span className="flex-1 truncate">{title}</span>
                  <button
                    onClick={() => removeWidget(widget.id)}
                    className="p-1 hover:bg-violet-200 rounded text-gray-400 hover:text-gray-600"
                    title="Remove widget"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </li>
              );
            }

            // Handle session widgets
            const session = widget.sessionId ? sessions[widget.sessionId] : null;
            const title = widget.customName || session?.name || 'New Widget';
            const isDisconnected = session?.state === 'disconnected';

            return (
              <li
                key={widget.id}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                  isDisconnected ? 'bg-gray-50 text-gray-400' : 'bg-gray-100 text-gray-700'
                )}
              >
                <div
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    !session ? 'bg-gray-400' :
                    session.state === 'busy' ? 'bg-green-500 animate-pulse' :
                    session.state === 'idle' ? 'bg-blue-500' :
                    session.state === 'error' ? 'bg-red-500' :
                    'bg-gray-400'
                  )}
                />
                <span className="flex-1 truncate">{title}</span>
                <button
                  onClick={() => removeWidget(widget.id)}
                  className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                  title="Remove widget"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Agent Status Component
function AgentStatus() {
  const { serverConfig, connected, agents, clearDisconnectedSessions } = useDashboardStore();
  const agent = agents[0];
  const metrics = agent?.metrics;

  const handleLaunchAgent = () => {
    tryLaunchAgent();
  };

  const handleClearDisconnected = () => {
    clearDisconnectedSessions();
  };

  return (
    <>
      {/* Agent Status */}
      <div className="px-4 py-3 border-t bg-gray-50">
        <div className="flex items-center gap-2 text-sm mb-2">
          <Terminal className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600">Local Agent:</span>
          {connected && serverConfig.hasLocalAgent ? (
            <span className="flex items-center gap-1 text-green-600">
              <Wifi className="w-3 h-3" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-gray-400">
              <WifiOff className="w-3 h-3" />
              Not connected
            </span>
          )}
        </div>

        {agent && (
          <div className="space-y-1.5 text-xs">
            <div className="text-gray-500 truncate" title={agent.workingDir}>
              {agent.systemInfo?.hostname || agent.platform} · {agent.workingDir}
            </div>

            {metrics && (
              <>
                {/* CPU */}
                <div className="flex items-center gap-2">
                  <Cpu className="w-3 h-3 text-gray-400" />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">CPU</span>
                      <span className={cn(
                        metrics.cpuPercent > 80 ? 'text-red-600' :
                        metrics.cpuPercent > 50 ? 'text-yellow-600' : 'text-gray-600'
                      )}>
                        {metrics.cpuPercent}%
                      </span>
                    </div>
                    <div className="h-1 bg-gray-200 rounded-full mt-0.5">
                      <div
                        className={cn(
                          'h-1 rounded-full transition-all',
                          metrics.cpuPercent > 80 ? 'bg-red-500' :
                          metrics.cpuPercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
                        )}
                        style={{ width: `${Math.min(100, metrics.cpuPercent)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Memory */}
                <div className="flex items-center gap-2">
                  <HardDrive className="w-3 h-3 text-gray-400" />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Memory</span>
                      <span className={cn(
                        metrics.memoryPercent > 85 ? 'text-red-600' :
                        metrics.memoryPercent > 70 ? 'text-yellow-600' : 'text-gray-600'
                      )}>
                        {Math.round(metrics.memoryUsedMB / 1024 * 10) / 10}GB / {Math.round(metrics.memoryTotalMB / 1024 * 10) / 10}GB
                      </span>
                    </div>
                    <div className="h-1 bg-gray-200 rounded-full mt-0.5">
                      <div
                        className={cn(
                          'h-1 rounded-full transition-all',
                          metrics.memoryPercent > 85 ? 'bg-red-500' :
                          metrics.memoryPercent > 70 ? 'bg-yellow-500' : 'bg-blue-500'
                        )}
                        style={{ width: `${Math.min(100, metrics.memoryPercent)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Active tasks */}
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-600">Tasks:</span>
                  <span className={cn(
                    'font-medium',
                    metrics.activeCommands > 0 ? 'text-blue-600' : 'text-gray-500'
                  )}>
                    {metrics.activeCommands} active
                  </span>
                  {metrics.queuedTasks > 0 && (
                    <span className="text-yellow-600">
                      · {metrics.queuedTasks} queued
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {!serverConfig.hasLocalAgent && (
          <div className="mt-3 space-y-2">
            <button
              onClick={handleLaunchAgent}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Launch Agent
            </button>
            <a
              href="/download"
              className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Agent
            </a>
            <p className="text-xs text-gray-400 text-center">
              Runs in your system tray
            </p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t">
        <button
          onClick={handleClearDisconnected}
          className="w-full px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Clear disconnected sessions
        </button>
      </div>
    </>
  );
}

// Organization Switcher Component (placeholder - Vibecode doesn't have org API yet)
function OrganizationSwitcher({ currentTenantId, onSwitch }: { currentTenantId: string | null; onSwitch: () => void }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOrg = organizations.find((org) => org.id === currentTenantId) || organizations[0];

  useEffect(() => {
    // Vibecode doesn't have its own organizations API yet
    // For now, just show loading briefly then hide
    const timer = setTimeout(() => {
      setLoading(false);
      // When Vibecode gets an organizations API, fetch here:
      // const { items } = await organizationsApi.list();
      // setOrganizations(items);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (org: Organization) => {
    if (org.id === currentTenantId) {
      setIsOpen(false);
      return;
    }

    localStorage.setItem(TENANT_STORAGE_KEY, org.id);
    setIsOpen(false);
    onSwitch();
  };

  const handleClearOverride = () => {
    localStorage.removeItem(TENANT_STORAGE_KEY);
    setIsOpen(false);
    onSwitch();
  };

  if (loading) {
    return null;
  }

  if (organizations.length <= 1) {
    return null;
  }

  const hasOverride = localStorage.getItem(TENANT_STORAGE_KEY) !== null;

  return (
    <div className="px-3 mb-4" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="truncate">{currentOrg?.name || 'Select Organization'}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-3 right-3 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSelect(org)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors ${
                org.id === currentTenantId ? 'bg-violet-50 text-violet-700' : 'text-gray-600'
              }`}
            >
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{org.name}</span>
              {org.id === currentTenantId && (
                <span className="ml-auto text-xs text-violet-600">Current</span>
              )}
            </button>
          ))}
          {hasOverride && (
            <>
              <div className="border-t border-gray-200" />
              <button
                onClick={handleClearOverride}
                className="w-full px-3 py-2 text-sm text-left text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Reset to default
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ ws }: SidebarProps) {
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(
    localStorage.getItem(TENANT_STORAGE_KEY)
  );

  const handleOrgSwitch = () => {
    setCurrentTenantId(localStorage.getItem(TENANT_STORAGE_KEY));
    window.location.reload();
  };

  const handleLogout = useCallback(() => {
    // Redirect to identity login
    window.location.href = 'https://identity.ai.devintensive.com/login';
  }, []);

  // Create user menu config
  const userMenu = useMemo(() => createDefaultUserMenu({
    onLogout: handleLogout,
    buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP,
    gitCommit: import.meta.env.VITE_GIT_COMMIT,
    currentAppCode: 'vibecode',
  }), [handleLogout]);

  return (
    <SharedSidebar
      productCode="vibecode"
      productName="VibeCode"
      navigation={[]} // Vibecode has no standard navigation links
      currentPath="/"
      showThemeSwitcher={false}
      orgSwitcher={
        <OrganizationSwitcher
          currentTenantId={currentTenantId}
          onSwitch={handleOrgSwitch}
        />
      }
      bottomSection={<AgentStatus />}
      userMenu={userMenu}
      renderLink={({ href, className, children, onClick }) => (
        <a href={href} className={className} onClick={onClick}>
          {children}
        </a>
      )}
    >
      <WidgetsSection />
    </SharedSidebar>
  );
}
