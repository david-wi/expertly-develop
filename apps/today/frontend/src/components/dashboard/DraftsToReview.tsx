import { useState } from 'react';
import type { Draft } from '../../types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { usePendingDrafts, useApproveDraft, useRejectDraft } from '../../hooks/useDrafts';

interface DraftsToReviewProps {
  maxItems?: number;
}

export function DraftsToReview({ maxItems = 5 }: DraftsToReviewProps) {
  const { data: drafts = [], isLoading } = usePendingDrafts(maxItems);

  if (isLoading) {
    return (
      <Card title="Drafts to Review">
        <div className="animate-pulse space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card title="Drafts to Review">
      {drafts.length === 0 ? (
        <p className="text-sm text-gray-500">No drafts pending review.</p>
      ) : (
        <ul className="space-y-3">
          {drafts.map((draft) => (
            <DraftItem key={draft.id} draft={draft} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function DraftItem({ draft }: { draft: Draft }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedback, setFeedback] = useState('');

  const approveMutation = useApproveDraft();
  const rejectMutation = useRejectDraft();

  const handleApprove = async () => {
    await approveMutation.mutateAsync({ id: draft.id, feedback: feedback || undefined });
    setIsExpanded(false);
    setFeedback('');
  };

  const handleReject = async () => {
    if (!feedback.trim()) {
      alert('Please provide feedback for rejection');
      return;
    }
    await rejectMutation.mutateAsync({ id: draft.id, feedback });
    setIsExpanded(false);
    setFeedback('');
  };

  const typeIcon = {
    email: '📧',
    slack: '💬',
    document: '📄',
    note: '📝',
  }[draft.type] || '📄';

  return (
    <li className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span>{typeIcon}</span>
            <span className="text-sm font-medium text-gray-900 truncate">
              {draft.subject || `${draft.type.charAt(0).toUpperCase() + draft.type.slice(1)} Draft`}
            </span>
          </div>
          {draft.recipient && (
            <p className="text-xs text-gray-500 mt-1">To: {draft.recipient}</p>
          )}
          <p className="text-xs text-gray-600 mt-2 line-clamp-2">{draft.body}</p>
        </div>
      </div>

      {isExpanded ? (
        <div className="mt-3 space-y-3">
          <div className="p-3 bg-gray-50 rounded-md max-h-48 overflow-y-auto">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{draft.body}</p>
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Feedback (optional for approve, required for reject)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            rows={2}
          />
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              onClick={handleApprove}
              isLoading={approveMutation.isPending}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={handleReject}
              isLoading={rejectMutation.isPending}
            >
              Reject
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsExpanded(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center space-x-2">
          <Button size="sm" onClick={() => setIsExpanded(true)}>
            Review
          </Button>
        </div>
      )}
    </li>
  );
}
