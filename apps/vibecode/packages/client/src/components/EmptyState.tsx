import { Plus, Rocket } from 'lucide-react';
import { useDashboardStore } from '../store/dashboard-store';
import type { useWebSocket } from '../hooks/useWebSocket';

interface EmptyStateProps {
  ws: ReturnType<typeof useWebSocket>;
}

export default function EmptyState({ ws }: EmptyStateProps) {
  const { addWidget } = useDashboardStore();

  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-700/20 flex items-center justify-center mb-6">
        <Rocket className="w-10 h-10 text-brand-500" />
      </div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
        Welcome to Expertly Vibecode
      </h2>
      <p className="text-gray-500 max-w-md mb-8">
        Manage multiple Claude Code sessions in a clean, distraction-free dashboard.
        Create widgets to run parallel tasks locally or remotely.
      </p>
      <button
        onClick={() => addWidget()}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium transition-colors"
      >
        <Plus className="w-5 h-5" />
        Create Your First Widget
      </button>
      <div className="mt-12 grid grid-cols-3 gap-8 text-sm text-gray-600">
        <div>
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-2">
            <span className="text-lg">🎯</span>
          </div>
          <p>Focus on what matters</p>
        </div>
        <div>
          <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center mx-auto mb-2">
            <span className="text-lg">⚡</span>
          </div>
          <p>Run tasks in parallel</p>
        </div>
        <div>
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mx-auto mb-2">
            <span className="text-lg">🌐</span>
          </div>
          <p>Local or remote execution</p>
        </div>
      </div>
    </div>
  );
}
