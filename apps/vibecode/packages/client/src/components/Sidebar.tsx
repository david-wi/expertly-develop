import { useState } from 'react';
import { ChevronDown, Plus, Trash2, Terminal, Wifi, WifiOff, Cpu, HardDrive, Activity, Copy, Check, MessageCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useDashboardStore } from '../store/dashboard-store';
import type { useWebSocket } from '../hooks/useWebSocket';

// Get the WebSocket URL for the agent command
const getAgentCommand = () => {
  const wsUrl = import.meta.env.DEV
    ? 'ws://localhost:3001'
    : `ws://${window.location.host}`;
  return `npx @expertly-vibecode/agent -s ${wsUrl}`;
};

const EXPERTLY_PRODUCTS = [
  { name: 'Define', code: 'define', href: 'http://expertly-define.152.42.152.243.sslip.io', description: 'Requirements management', initials: 'De' },
  { name: 'Develop', code: 'develop', href: 'http://expertly-develop.152.42.152.243.sslip.io', description: 'Visual walkthroughs', initials: 'Dv' },
  { name: 'Manage', code: 'manage', href: 'http://expertly-manage.152.42.152.243.sslip.io', description: 'Task management', initials: 'Ma' },
  { name: 'Salon', code: 'salon', href: 'http://expertly-salon.152.42.152.243.sslip.io', description: 'Booking platform', initials: 'Sa' },
  { name: 'Today', code: 'today', href: 'http://expertly-today.152.42.152.243.sslip.io', description: 'Daily workflow', initials: 'To' },
  { name: 'VibeCode', code: 'vibecode', href: 'http://expertly-vibecode.152.42.152.243.sslip.io', description: 'Multi-agent dashboard', initials: 'VC', current: true },
  { name: 'VibeTest', code: 'vibetest', href: 'http://vibe-qa.152.42.152.243.sslip.io', description: 'Quality assurance', initials: 'VT' },
];

// Expertly Logo SVG component
function ExpertlyLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.8379 24.9606C16.6714 22.9391 17.9566 20.4822 18.571 17.8238L24.2667 20.4657C24.3728 20.4481 24.4733 20.4064 24.5606 20.3436C24.6478 20.2809 24.7194 20.1989 24.7698 20.104C24.8201 20.0091 24.8479 19.9039 24.8509 19.7965C24.8539 19.6892 24.832 19.5826 24.7871 19.485L19.4266 8.14301C19.3632 8.00575 19.2699 7.88442 19.1535 7.78793C19.037 7.69144 18.9004 7.62224 18.7537 7.58542C18.607 7.5486 18.4539 7.54509 18.3057 7.57515C18.1574 7.60521 18.0178 7.66808 17.897 7.75913L7.63363 15.6497C7.10981 16.0196 7.36125 16.9409 7.98285 16.92L14.0452 16.6931C14.0452 16.6931 13.2106 20.2912 8.35301 22.0047L8.27269 22.0326C2.61541 23.4285 -0.000202179 18.7452 -0.000202179 15.7509C-0.00718689 7.22169 7.2006 0.699166 15.1173 0.0570345C17.8181 -0.167956 20.5328 0.274916 23.0218 1.34656C25.5108 2.41821 27.6976 4.08568 29.3891 6.2018C31.0806 8.31791 32.2249 10.8176 32.7209 13.4803C33.2169 16.1429 33.0494 18.8867 32.2332 21.4693C31.4169 24.0519 29.9771 26.3941 28.0407 28.289C26.1043 30.184 23.7309 31.5734 21.13 32.3347C18.5291 33.096 15.7807 33.2058 13.1273 32.6544C10.4738 32.103 7.99705 30.9073 5.91549 29.1728C9.17716 28.7959 12.4772 27.6408 14.8379 24.9606Z" fill="url(#paint0_linear_vibecode)"/>
      <defs>
        <linearGradient id="paint0_linear_vibecode" x1="32.9998" y1="33" x2="-6.71734" y2="18.8377" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9648FF"/>
          <stop offset="1" stopColor="#2C62F9"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

interface SidebarProps {
  ws: ReturnType<typeof useWebSocket>;
}

export function Sidebar({ ws }: SidebarProps) {
  const [showProductSwitcher, setShowProductSwitcher] = useState(false);
  const [copied, setCopied] = useState(false);
  const { widgets, sessions, chatConversations, serverConfig, connected, agents, addWidget, addChatWidget, removeWidget, clearDisconnectedSessions } = useDashboardStore();
  const [showWidgetMenu, setShowWidgetMenu] = useState(false);

  // Get the first agent's metrics (for now, just show one agent)
  const agent = agents[0];
  const metrics = agent?.metrics;

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(getAgentCommand());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleClearDisconnected = () => {
    clearDisconnectedSessions();
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg flex flex-col">
      {/* Logo / Product Switcher */}
      <div className="relative">
        <button
          onClick={() => setShowProductSwitcher(!showProductSwitcher)}
          className="w-full flex h-16 items-center justify-between gap-2 px-6 border-b hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3" title="The place to vibe code">
            <ExpertlyLogo className="w-8 h-8" />
            <span className="font-semibold text-gray-900">Expertly VibeCode</span>
          </div>
          <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', showProductSwitcher && 'rotate-180')} />
        </button>

        {/* Product Dropdown */}
        {showProductSwitcher && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowProductSwitcher(false)}
            />
            <div className="absolute top-full left-0 right-0 bg-white border-b shadow-lg z-50">
              <div className="p-2">
                <p className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Switch Product</p>
                {EXPERTLY_PRODUCTS.map((product) => (
                  <a
                    key={product.code}
                    href={product.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      product.current
                        ? 'bg-violet-50 text-violet-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                    onClick={() => setShowProductSwitcher(false)}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg, #9648FF 0%, #2C62F9 100%)' }}
                    >
                      {product.initials}
                    </div>
                    <div>
                      <p className="font-medium">Expertly {product.name}</p>
                      <p className="text-xs text-gray-500">{product.description}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Widgets Section */}
      <div className="flex-1 overflow-y-auto">
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
      </div>

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
            {/* Host info */}
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
          <div className="mt-2">
            <button
              onClick={handleCopyCommand}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors group"
              title="Click to copy command"
            >
              <span>Run</span>
              <code className="font-mono text-gray-500 group-hover:text-gray-700">npx vibecode-agent</code>
              <span>locally</span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
              )}
            </button>
            {copied && (
              <p className="text-xs text-green-600 mt-1">Copied!</p>
            )}
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
    </aside>
  );
}
