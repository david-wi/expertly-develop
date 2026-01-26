import { Plus, Settings, Sparkles } from 'lucide-react';
import { useDashboardStore } from '../store/dashboard-store';
import type { useWebSocket } from '../hooks/useWebSocket';

interface HeaderProps {
  ws: ReturnType<typeof useWebSocket>;
}

export default function Header({ ws }: HeaderProps) {
  const { addWidget, widgets } = useDashboardStore();

  const handleNewWidget = () => {
    addWidget();
  };

  return (
    <header className="flex-none h-14 border-b border-panel-800 bg-panel-900/50 backdrop-blur-sm">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-panel-100">
              Cowork Dash
            </h1>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm text-panel-400">
          <span>{widgets.length} widget{widgets.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewWidget}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel-800 hover:bg-panel-700 text-panel-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">New Widget</span>
          </button>
          <button className="p-2 rounded-lg hover:bg-panel-800 text-panel-400 hover:text-panel-200 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
