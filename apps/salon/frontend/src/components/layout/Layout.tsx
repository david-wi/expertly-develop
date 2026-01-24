import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useWebSocket } from '../../hooks/useWebSocket';

export function Layout() {
  // Connect to WebSocket for real-time calendar updates
  const { isConnected } = useWebSocket();

  return (
    <div className="flex h-screen bg-warm-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Connection status indicator (optional, for debugging) */}
      {import.meta.env.DEV && (
        <div
          className={`fixed bottom-2 right-2 w-2 h-2 rounded-full ${
            isConnected ? 'bg-success-500' : 'bg-warm-400'
          }`}
          title={isConnected ? 'Real-time connected' : 'Real-time disconnected'}
        />
      )}
    </div>
  );
}
