import type { Task } from '../../types';
import { Card } from '../common/Card';

interface ClaudeWorkingStatusProps {
  task: Task | null;
}

export function ClaudeWorkingStatus({ task }: ClaudeWorkingStatusProps) {
  return (
    <Card title="Claude is working on">
      {task ? (
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <ClaudeIcon className="w-6 h-6 text-primary-600" />
              </div>
              {/* Pulsing indicator */}
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-500"></span>
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
              <p className="text-xs text-gray-500">
                Started {task.started_at ? formatRelativeTime(task.started_at) : 'recently'}
              </p>
            </div>
          </div>

          {task.description && (
            <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
          )}

          {/* Progress bar (simulated) */}
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-primary-600 h-1.5 rounded-full animate-pulse"
              style={{ width: '60%' }}
            ></div>
          </div>
        </div>
      ) : (
        <div className="flex items-center space-x-3 text-gray-500">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <ClaudeIcon className="w-6 h-6 text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-medium">Claude is idle</p>
            <p className="text-xs">Ready for new tasks</p>
          </div>
        </div>
      )}
    </Card>
  );
}

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
