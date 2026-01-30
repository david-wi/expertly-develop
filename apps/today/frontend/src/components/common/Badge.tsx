import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  primary: 'bg-primary-100 text-primary-700',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

// Task status badge helper
export function TaskStatusBadge({ status }: { status: string }) {
  const variants: Record<string, BadgeVariant> = {
    queued: 'default',
    working: 'info',
    blocked: 'warning',
    completed: 'success',
    cancelled: 'error',
  };

  return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
}

// Question status badge helper
export function QuestionStatusBadge({ status }: { status: string }) {
  const variants: Record<string, BadgeVariant> = {
    unanswered: 'warning',
    answered: 'success',
    dismissed: 'default',
  };

  return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
}

// Priority badge
export function PriorityBadge({ priority }: { priority: number }) {
  const variants: Record<number, BadgeVariant> = {
    1: 'error',
    2: 'warning',
    3: 'default',
    4: 'default',
    5: 'default',
  };

  const labels: Record<number, string> = {
    1: 'Urgent',
    2: 'High',
    3: 'Medium',
    4: 'Low',
    5: 'Lowest',
  };

  return <Badge variant={variants[priority] || 'default'}>{labels[priority] || `P${priority}`}</Badge>;
}
