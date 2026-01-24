import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTasks, useCreateTask } from '../hooks/useTasks';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { TaskStatusBadge, PriorityBadge } from '../components/common/Badge';
import type { Task } from '../types';

type StatusFilter = 'all' | 'queued' | 'working' | 'blocked' | 'completed';

export function Tasks() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);

  const { data: tasks = [], isLoading, error } = useTasks(
    statusFilter === 'all' ? {} : { status: statusFilter }
  );

  const createTask = useCreateTask();

  const handleCreateTask = async (title: string, description: string, priority: number) => {
    await createTask.mutateAsync({ title, description, priority });
    setShowNewTaskForm(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load tasks</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500">Manage and track all tasks</p>
        </div>
        <Button onClick={() => setShowNewTaskForm(true)}>New Task</Button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-2">
        {(['all', 'queued', 'working', 'blocked', 'completed'] as StatusFilter[]).map(
          (status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                statusFilter === status
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          )
        )}
      </div>

      {/* New task form */}
      {showNewTaskForm && (
        <NewTaskForm
          onSubmit={handleCreateTask}
          onCancel={() => setShowNewTaskForm(false)}
          isLoading={createTask.isPending}
        />
      )}

      {/* Task list */}
      <Card>
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No tasks found. Create one to get started!
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  return (
    <Link
      to={`/tasks/${task.id}`}
      className="block py-4 hover:bg-gray-50 -mx-4 px-4 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3">
            <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
            <TaskStatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
          {task.description && (
            <p className="mt-1 text-xs text-gray-500 line-clamp-1">{task.description}</p>
          )}
          <div className="mt-2 flex items-center text-xs text-gray-400 space-x-4">
            <span>
              Created {new Date(task.created_at).toLocaleDateString()}
            </span>
            {task.assignee === 'claude' && (
              <span className="text-purple-600">Assigned to Claude</span>
            )}
          </div>
        </div>
        <ChevronRightIcon className="w-5 h-5 text-gray-400" />
      </div>
    </Link>
  );
}

function NewTaskForm({
  onSubmit,
  onCancel,
  isLoading,
}: {
  onSubmit: (title: string, description: string, priority: number) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSubmit(title.trim(), description.trim(), priority);
    }
  };

  return (
    <Card title="New Task">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="What needs to be done?"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description (optional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Add more details..."
          />
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
            Priority
          </label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value={1}>1 - Urgent</option>
            <option value={2}>2 - High</option>
            <option value={3}>3 - Medium</option>
            <option value={4}>4 - Low</option>
            <option value={5}>5 - Lowest</option>
          </select>
        </div>

        <div className="flex items-center space-x-3">
          <Button type="submit" isLoading={isLoading}>
            Create Task
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
