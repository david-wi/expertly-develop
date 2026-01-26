import { useEffect } from 'react';
import { useDashboardStore } from './store/dashboard-store';
import { useWebSocket } from './hooks/useWebSocket';
import Dashboard from './components/Dashboard';
import Header from './components/Header';
import ConnectionStatus from './components/ConnectionStatus';

export default function App() {
  const { connected } = useDashboardStore();
  const ws = useWebSocket();

  return (
    <div className="h-screen flex flex-col bg-panel-950">
      <Header ws={ws} />
      <main className="flex-1 overflow-hidden">
        <Dashboard ws={ws} />
      </main>
      <ConnectionStatus connected={connected} />
    </div>
  );
}
