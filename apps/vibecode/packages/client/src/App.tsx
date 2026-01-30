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
import { ExternalLink } from 'lucide-react';

function MainApp() {
  const { connected, serverConfig } = useDashboardStore();
  const ws = useWebSocket();

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <DownloadBanner hasAgent={serverConfig.hasLocalAgent} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar ws={ws} />
        <main className="flex-1 ml-72 overflow-hidden">
          <Dashboard ws={ws} />
        </main>
      </div>
      <ConnectionStatus connected={connected} />

      {/* Fixed bottom-right link to marketing page */}
      <a
        href="/landing"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors shadow-lg"
      >
        <ExternalLink className="w-4 h-4" />
        View marketing page
      </a>
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
