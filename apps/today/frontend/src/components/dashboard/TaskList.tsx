import { Link } from 'react-router-dom';
import type { Task } from '../../types';
import { Card } from '../common/Card';
import { TaskStatusBadge, PriorityBadge } from '../common/Badge';

interface TaskListProps {
  tasks: Task[];
  title?: string;
  emptyMessage?: string;
}

export function TaskList({
  tasks,
  title = 'Tasks',
  emptyMessage = 'No tasks',
}: TaskListProps) {
  return (
    <Card title={title}>
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {tasks.map((task) => (
            <TaskListItem key={task.id} task={task} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function TaskListItem({ task }: { task: Task }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <Link
        to={`/tasks/${task.id}`}
        className="block hover:bg-gray-50 -mx-4 px-4 py-2 rounded-md transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
            {task.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
            )}
            <div className="flex items-center mt-2 space-x-2">
              <TaskStatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              {task.assignee === 'claude' && (
                <span className="inline-flex items-center text-xs text-purple-600">
                  <ClaudeIcon className="w-3 h-3 mr-1" />
                  Claude
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
    </svg>
  );
}
