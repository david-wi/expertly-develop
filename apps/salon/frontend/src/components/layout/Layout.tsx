import { Outlet } from 'react-router-dom';
import { useSidebarCollapsed } from '@expertly/ui';
import { Sidebar } from './Sidebar';
import { useWebSocket } from '../../hooks/useWebSocket';

export function Layout() {
  // Connect to WebSocket for real-time calendar updates
  const { isConnected } = useWebSocket();
  const [sidebarCollapsed] = useSidebarCollapsed();

  return (
    <div className="min-h-screen bg-theme-bg">
      <Sidebar />
      <div className={`${sidebarCollapsed ? 'pl-16' : 'pl-72'} transition-[padding] duration-200 ease-in-out`}>
        <main className="p-8">
          <Outlet />
        </main>
      </div>

      {/* Connection status indicator (optional, for debugging) */}
      {import.meta.env.DEV && (
        <div
          className={`fixed bottom-2 right-2 w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-gray-400'
          }`}
          title={isConnected ? 'Real-time connected' : 'Real-time disconnected'}
        />
      )}
    </div>
  );
}
