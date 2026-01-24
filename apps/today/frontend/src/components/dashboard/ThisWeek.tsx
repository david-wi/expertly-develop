import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Task } from '../../types';
import { Card } from '../common/Card';
import { useTasks } from '../../hooks/useTasks';
import { PriorityBadge } from '../common/Badge';

interface ThisWeekProps {
  maxItems?: number;
}

export function ThisWeek({ maxItems = 10 }: ThisWeekProps) {
  const { data: allTasks = [], isLoading } = useTasks({
    status: 'queued',
    limit: 50,
  });

  // Filter tasks with due dates within the next 7 days
  const thisWeekTasks = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return allTasks
      .filter((task) => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return dueDate >= now && dueDate <= weekFromNow;
      })
      .sort((a, b) => {
        const dateA = new Date(a.due_date!);
        const dateB = new Date(b.due_date!);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, maxItems);
  }, [allTasks, maxItems]);

  // Also get high-priority tasks without due dates
  const highPriorityTasks = useMemo(() => {
    return allTasks
      .filter((task) => task.priority <= 2 && !task.due_date)
      .slice(0, 3);
  }, [allTasks]);

  if (isLoading) {
    return (
      <Card title="This Week">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      </Card>
    );
  }

  const isEmpty = thisWeekTasks.length === 0 && highPriorityTasks.length === 0;

  return (
    <Card title="This Week">
      {isEmpty ? (
        <p className="text-sm text-gray-500">No upcoming deadlines this week.</p>
      ) : (
        <div className="space-y-4">
          {thisWeekTasks.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Due This Week
              </h4>
              <ul className="space-y-2">
                {thisWeekTasks.map((task) => (
                  <TaskWithDueDate key={task.id} task={task} />
                ))}
              </ul>
            </div>
          )}

          {highPriorityTasks.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                High Priority (No Date)
              </h4>
              <ul className="space-y-2">
                {highPriorityTasks.map((task) => (
                  <TaskWithoutDate key={task.id} task={task} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function TaskWithDueDate({ task }: { task: Task }) {
  const dueDate = new Date(task.due_date!);
  const isToday = dueDate.toDateString() === new Date().toDateString();
  const isTomorrow = dueDate.toDateString() === new Date(Date.now() + 86400000).toDateString();

  let dueDateLabel = dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (isToday) dueDateLabel = 'Today';
  if (isTomorrow) dueDateLabel = 'Tomorrow';

  return (
    <li>
      <Link
        to={`/tasks/${task.id}`}
        className="flex items-center justify-between p-2 -mx-2 rounded hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 truncate">{task.title}</p>
        </div>
        <div className="flex items-center space-x-2 ml-2">
          <PriorityBadge priority={task.priority} />
          <span className={`text-xs font-medium ${isToday ? 'text-red-600' : 'text-gray-500'}`}>
            {dueDateLabel}
          </span>
        </div>
      </Link>
    </li>
  );
}

function TaskWithoutDate({ task }: { task: Task }) {
  return (
    <li>
      <Link
        to={`/tasks/${task.id}`}
        className="flex items-center justify-between p-2 -mx-2 rounded hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 truncate">{task.title}</p>
        </div>
        <PriorityBadge priority={task.priority} />
      </Link>
    </li>
  );
}
