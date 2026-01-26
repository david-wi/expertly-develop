import { Plus, Sparkles } from 'lucide-react';
import { useDashboardStore } from '../store/dashboard-store';
import type { useWebSocket } from '../hooks/useWebSocket';

interface EmptyStateProps {
  ws: ReturnType<typeof useWebSocket>;
}

export default function EmptyState({ ws }: EmptyStateProps) {
  const { addWidget } = useDashboardStore();

  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center mb-6">
        <Sparkles className="w-10 h-10 text-orange-400" />
      </div>
      <h2 className="text-2xl font-semibold text-panel-100 mb-2">
        Welcome to Cowork Dash
      </h2>
      <p className="text-panel-400 max-w-md mb-8">
        Manage multiple Claude Code sessions in a clean, distraction-free dashboard. 
        Create widgets to run parallel tasks.
      </p>
      <button
        onClick={() => addWidget()}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium transition-colors"
      >
        <Plus className="w-5 h-5" />
        Create Your First Widget
      </button>
      <div className="mt-12 grid grid-cols-3 gap-8 text-sm text-panel-500">
        <div>
          <div className="w-10 h-10 rounded-lg bg-panel-800 flex items-center justify-center mx-auto mb-2">
            <span className="text-lg">🎯</span>
          </div>
          <p>Focus on what matters</p>
        </div>
        <div>
          <div className="w-10 h-10 rounded-lg bg-panel-800 flex items-center justify-center mx-auto mb-2">
            <span className="text-lg">⚡</span>
          </div>
          <p>Run tasks in parallel</p>
        </div>
        <div>
          <div className="w-10 h-10 rounded-lg bg-panel-800 flex items-center justify-center mx-auto mb-2">
            <span className="text-lg">🧘</span>
          </div>
          <p>Less visual noise</p>
        </div>
      </div>
    </div>
  );
}
