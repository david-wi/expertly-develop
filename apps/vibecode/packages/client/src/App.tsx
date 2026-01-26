import { useDashboardStore } from './store/dashboard-store';
import { useWebSocket } from './hooks/useWebSocket';
import Dashboard from './components/Dashboard';
import { Sidebar } from './components/Sidebar';
import ConnectionStatus from './components/ConnectionStatus';

export default function App() {
  const { connected } = useDashboardStore();
  const ws = useWebSocket();

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar ws={ws} />
      <main className="flex-1 ml-64 overflow-hidden">
        <Dashboard ws={ws} />
      </main>
      <ConnectionStatus connected={connected} />
    </div>
  );
}
