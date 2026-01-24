import { useState } from 'react';
import type { Question } from '../../types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { PriorityBadge } from '../common/Badge';
import { useAnswerQuestion, useDismissQuestion } from '../../hooks/useQuestions';

interface QuestionsListProps {
  questions: Question[];
  title?: string;
  emptyMessage?: string;
}

export function QuestionsList({
  questions,
  title = 'Questions for You',
  emptyMessage = 'No questions pending',
}: QuestionsListProps) {
  return (
    <Card title={title}>
      {questions.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <ul className="space-y-4">
          {questions.map((question) => (
            <QuestionItem key={question.id} question={question} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function QuestionItem({ question }: { question: Question }) {
  const [answer, setAnswer] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const answerMutation = useAnswerQuestion();
  const dismissMutation = useDismissQuestion();

  const handleAnswer = async () => {
    if (!answer.trim()) return;
    try {
      await answerMutation.mutateAsync({ id: question.id, answer });
      setAnswer('');
      setIsExpanded(false);
    } catch (error) {
      console.error('Failed to answer question:', error);
    }
  };

  const handleDismiss = async () => {
    try {
      await dismissMutation.mutateAsync({ id: question.id, reason: 'Not relevant' });
    } catch (error) {
      console.error('Failed to dismiss question:', error);
    }
  };

  return (
    <li className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <PriorityBadge priority={question.priority} />
            <span className="text-xs text-gray-500">
              {new Date(question.created_at).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900">{question.text}</p>

          {question.why_asking && (
            <p className="text-xs text-gray-500 mt-2">
              <span className="font-medium">Why I'm asking:</span> {question.why_asking}
            </p>
          )}

          {question.what_claude_will_do && (
            <p className="text-xs text-gray-500 mt-1">
              <span className="font-medium">What I'll do with this:</span>{' '}
              {question.what_claude_will_do}
            </p>
          )}

          {question.context && (
            <p className="text-xs text-gray-400 mt-2 italic">Context: {question.context}</p>
          )}
        </div>
      </div>

      {/* Answer section */}
      <div className="mt-4">
        {isExpanded ? (
          <div className="space-y-3">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                onClick={handleAnswer}
                isLoading={answerMutation.isPending}
                disabled={!answer.trim()}
              >
                Submit Answer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsExpanded(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Button size="sm" onClick={() => setIsExpanded(true)}>
              Answer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              isLoading={dismissMutation.isPending}
            >
              Dismiss
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
