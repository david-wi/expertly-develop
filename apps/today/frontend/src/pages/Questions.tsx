import { useState } from 'react';
import { useQuestions, useAnswerQuestion, useDismissQuestion } from '../hooks/useQuestions';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { PriorityBadge } from '../components/common/Badge';
import type { Question, QuestionStatus } from '../types';

type StatusFilter = 'all' | 'unanswered' | 'answered' | 'dismissed';

export function Questions() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('unanswered');
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [dismissReason, setDismissReason] = useState('');
  const [showDismissForm, setShowDismissForm] = useState(false);

  const { data: questions = [], isLoading, error } = useQuestions(
    statusFilter === 'all' ? {} : { status: statusFilter }
  );

  const answerQuestion = useAnswerQuestion();
  const dismissQuestion = useDismissQuestion();

  const handleAnswer = async () => {
    if (!selectedQuestion || !answerText.trim()) return;
    await answerQuestion.mutateAsync({ id: selectedQuestion.id, answer: answerText });
    setSelectedQuestion(null);
    setAnswerText('');
  };

  const handleDismiss = async () => {
    if (!selectedQuestion) return;
    await dismissQuestion.mutateAsync({ id: selectedQuestion.id, reason: dismissReason || undefined });
    setSelectedQuestion(null);
    setDismissReason('');
    setShowDismissForm(false);
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
        <p className="text-red-600">Failed to load questions</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--theme-text-heading)]">Questions</h1>
          <p className="text-sm text-gray-500">Questions from Claude that need your input</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-2">
        {(['unanswered', 'all', 'answered', 'dismissed'] as StatusFilter[]).map((status) => (
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
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Question list */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {statusFilter === 'all' ? 'All Questions' : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Questions`}
          </h2>
          {questions.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              {statusFilter === 'unanswered'
                ? 'No questions waiting for your input!'
                : 'No questions found.'}
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {questions.map((question) => (
                <QuestionRow
                  key={question.id}
                  question={question}
                  isSelected={selectedQuestion?.id === question.id}
                  onClick={() => setSelectedQuestion(question)}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Question detail / answer panel */}
        <div>
          {selectedQuestion ? (
            <Card>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Question Details</h2>
                  <QuestionStatusBadge status={selectedQuestion.status} />
                </div>

                {/* Question text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Question
                  </label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-md">
                    {selectedQuestion.text}
                  </p>
                </div>

                {/* Context */}
                {selectedQuestion.context && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Context
                    </label>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                      {selectedQuestion.context}
                    </p>
                  </div>
                )}

                {/* Why asking */}
                {selectedQuestion.why_asking && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Why Claude is asking
                    </label>
                    <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                      {selectedQuestion.why_asking}
                    </p>
                  </div>
                )}

                {/* What Claude will do */}
                {selectedQuestion.what_claude_will_do && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      What Claude will do with the answer
                    </label>
                    <p className="text-sm text-gray-600 bg-green-50 p-3 rounded-md">
                      {selectedQuestion.what_claude_will_do}
                    </p>
                  </div>
                )}

                {/* Priority */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Priority:</span>
                  <PriorityBadge priority={selectedQuestion.priority} />
                </div>

                {/* Answer section - only for unanswered questions */}
                {selectedQuestion.status === 'unanswered' && !showDismissForm && (
                  <div className="pt-4 border-t">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Answer
                    </label>
                    <textarea
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      rows={4}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Type your answer here..."
                    />
                    <div className="flex items-center justify-between mt-3">
                      <Button
                        variant="ghost"
                        onClick={() => setShowDismissForm(true)}
                      >
                        Dismiss Instead
                      </Button>
                      <Button
                        onClick={handleAnswer}
                        isLoading={answerQuestion.isPending}
                        disabled={!answerText.trim()}
                      >
                        Submit Answer
                      </Button>
                    </div>
                  </div>
                )}

                {/* Dismiss form */}
                {selectedQuestion.status === 'unanswered' && showDismissForm && (
                  <div className="pt-4 border-t">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Dismiss Reason (optional)
                    </label>
                    <textarea
                      value={dismissReason}
                      onChange={(e) => setDismissReason(e.target.value)}
                      rows={2}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Why are you dismissing this question?"
                    />
                    <div className="flex items-center justify-between mt-3">
                      <Button
                        variant="ghost"
                        onClick={() => setShowDismissForm(false)}
                      >
                        Back to Answer
                      </Button>
                      <Button
                        variant="danger"
                        onClick={handleDismiss}
                        isLoading={dismissQuestion.isPending}
                      >
                        Dismiss Question
                      </Button>
                    </div>
                  </div>
                )}

                {/* Show answer for answered questions */}
                {selectedQuestion.status === 'answered' && selectedQuestion.answer && (
                  <div className="pt-4 border-t">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Answer
                    </label>
                    <p className="text-gray-900 bg-green-50 p-3 rounded-md">
                      {selectedQuestion.answer}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Answered {selectedQuestion.answered_at ? new Date(selectedQuestion.answered_at).toLocaleString() : 'unknown'} by {selectedQuestion.answered_by || 'unknown'}
                    </p>
                  </div>
                )}

                {/* Close button */}
                <div className="pt-4">
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setSelectedQuestion(null);
                      setAnswerText('');
                      setDismissReason('');
                      setShowDismissForm(false);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="text-center py-12">
                <QuestionIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-gray-500">
                  Select a question to view details and provide an answer
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionRow({
  question,
  isSelected,
  onClick,
}: {
  question: Question;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left py-4 -mx-4 px-4 transition-colors ${
        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 line-clamp-2">
            {question.text}
          </p>
          {question.context && (
            <p className="mt-1 text-xs text-gray-500 line-clamp-1">
              {question.context}
            </p>
          )}
          <div className="mt-2 flex items-center space-x-3">
            <QuestionStatusBadge status={question.status} />
            <PriorityBadge priority={question.priority} />
            <span className="text-xs text-gray-400">
              {new Date(question.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        <ChevronRightIcon className="w-5 h-5 text-gray-400 ml-2 flex-shrink-0" />
      </div>
    </button>
  );
}

function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  const colors = {
    unanswered: 'bg-yellow-100 text-yellow-800',
    answered: 'bg-green-100 text-green-800',
    dismissed: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status]}`}>
      {status}
    </span>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function QuestionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
