import { useState, useEffect } from 'react';
import { useDashboardStore } from './store/dashboard-store';
import { useWebSocket } from './hooks/useWebSocket';
import Dashboard from './components/Dashboard';
import { Sidebar } from './components/Sidebar';
import ConnectionStatus from './components/ConnectionStatus';
import DownloadBanner from './components/DownloadBanner';
import LandingPage from './pages/LandingPage';
import DownloadPage from './pages/DownloadPage';
import ChangelogPage from './pages/Changelog';
import { useSidebarCollapsed } from '@expertly/ui';

function MainApp() {
  const { connected, serverConfig } = useDashboardStore();
  const ws = useWebSocket();
  const [sidebarCollapsed] = useSidebarCollapsed();

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <DownloadBanner hasAgent={serverConfig.hasLocalAgent} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar ws={ws} />
        <main className={`flex-1 ${sidebarCollapsed ? 'ml-16' : 'ml-72'} overflow-hidden transition-[margin] duration-200 ease-in-out`}>
          <Dashboard ws={ws} />
        </main>
      </div>
      <ConnectionStatus connected={connected} />
    </div>
  );
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Simple routing
  if (currentPath === '/landing') {
    return <LandingPage />;
  }
  if (currentPath === '/download') {
    return <DownloadPage />;
  }
  if (currentPath === '/changelog') {
    return <ChangelogPage />;
  }

  return <MainApp />;
}
