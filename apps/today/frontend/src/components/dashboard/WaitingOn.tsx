import { useState } from 'react';
import type { WaitingItem } from '../../types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useActiveWaitingItems, useResolveWaitingItem } from '../../hooks/useWaitingItems';

interface WaitingOnProps {
  maxItems?: number;
}

export function WaitingOn({ maxItems = 5 }: WaitingOnProps) {
  const { data: items = [], isLoading } = useActiveWaitingItems(maxItems);

  if (isLoading) {
    return (
      <Card title="Waiting On">
        <div className="animate-pulse space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card title="Waiting On">
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing pending.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <WaitingItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function WaitingItem({ item }: { item: WaitingItem }) {
  const [isResolving, setIsResolving] = useState(false);
  const [notes, setNotes] = useState('');
  const resolveMutation = useResolveWaitingItem();

  const handleResolve = async () => {
    await resolveMutation.mutateAsync({ id: item.id, notes: notes || undefined });
    setIsResolving(false);
    setNotes('');
  };

  const daysWaiting = item.since
    ? Math.floor((Date.now() - new Date(item.since).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isOverdue = item.follow_up_date && new Date(item.follow_up_date) < new Date();

  return (
    <li className={`border rounded-lg p-3 ${isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{item.what}</p>
          <div className="flex items-center space-x-2 mt-1">
            {item.who && (
              <span className="text-xs text-gray-600">
                <PersonIcon className="w-3 h-3 inline mr-1" />
                {item.who}
              </span>
            )}
            {daysWaiting !== null && daysWaiting > 0 && (
              <span className={`text-xs ${daysWaiting > 7 ? 'text-red-600' : 'text-gray-500'}`}>
                {daysWaiting}d ago
              </span>
            )}
            {item.follow_up_date && (
              <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                {isOverdue ? 'Overdue' : `Follow up: ${new Date(item.follow_up_date).toLocaleDateString()}`}
              </span>
            )}
          </div>
          {item.why_it_matters && (
            <p className="text-xs text-gray-500 mt-2 italic">{item.why_it_matters}</p>
          )}
        </div>
      </div>

      {isResolving ? (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Resolution notes (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              onClick={handleResolve}
              isLoading={resolveMutation.isPending}
            >
              Mark Resolved
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsResolving(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <Button size="sm" variant="secondary" onClick={() => setIsResolving(true)}>
            Resolve
          </Button>
        </div>
      )}
    </li>
  );
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
