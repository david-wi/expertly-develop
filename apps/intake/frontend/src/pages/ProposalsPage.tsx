import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardCheck,
  Check,
  Pencil,
  X,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { api } from '@/api/client';
import type { Proposal, IntakeSectionInstance, IntakeQuestionInstance } from '@/types';

// ── API helpers ──

function fetchProposals(intakeId: string) {
  return api.get<Proposal[]>(`/intakes/${intakeId}/proposals`).then((r) => r.data);
}

function fetchSectionInstances(intakeId: string) {
  return api
    .get<IntakeSectionInstance[]>(`/intakes/${intakeId}/section-instances`)
    .then((r) => r.data);
}

function fetchQuestionInstances(intakeId: string) {
  return api
    .get<IntakeQuestionInstance[]>(`/intakes/${intakeId}/question-instances`)
    .then((r) => r.data);
}

// ── Page ──

export default function ProposalsPage() {
  const { intakeId } = useParams<{ intakeId: string }>();
  const queryClient = useQueryClient();

  const [sourceFilter, setSourceFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['proposals', intakeId],
    queryFn: () => fetchProposals(intakeId!),
    enabled: !!intakeId,
  });

  const { data: sectionInstances = [] } = useQuery({
    queryKey: ['section-instances', intakeId],
    queryFn: () => fetchSectionInstances(intakeId!),
    enabled: !!intakeId,
  });

  const { data: questionInstances = [] } = useQuery({
    queryKey: ['question-instances', intakeId],
    queryFn: () => fetchQuestionInstances(intakeId!),
    enabled: !!intakeId,
  });

  // Build lookups
  const questionMap = new Map(
    questionInstances.map((q) => [q.intakeQuestionInstanceId, q]),
  );

  // Filter proposals
  const pendingProposals = proposals.filter((p) => {
    if (p.status !== 'pending') return false;
    if (sourceFilter && p.source !== sourceFilter) return false;
    if (sectionFilter) {
      const question = questionMap.get(p.intakeQuestionInstanceId);
      if (!question) return false;
      const sectionInstance = sectionInstances.find(
        (s) => s.intakeSectionInstanceId === question.intakeSectionInstanceId,
      );
      if (!sectionInstance || sectionInstance.intakeSectionInstanceId !== sectionFilter) {
        return false;
      }
    }
    return true;
  });

  const acceptMutation = useMutation({
    mutationFn: ({ proposalId, answer }: { proposalId: string; answer?: string }) =>
      api.post(`/intakes/${intakeId}/proposals/${proposalId}/accept`, {
        answer: answer ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', intakeId] });
      setEditingId(null);
      setEditText('');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ proposalId, reason }: { proposalId: string; reason: string }) =>
      api.post(`/intakes/${intakeId}/proposals/${proposalId}/reject`, {
        rejectionReason: reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', intakeId] });
      setRejectingId(null);
      setRejectReason('');
    },
  });

  const handleAcceptAndEdit = (proposal: Proposal) => {
    setEditingId(proposal.proposalId);
    setEditText(proposal.proposedAnswer);
    setRejectingId(null);
  };

  const handleRejectStart = (proposalId: string) => {
    setRejectingId(proposalId);
    setRejectReason('');
    setEditingId(null);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Loading proposals...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <ClipboardCheck className="w-6 h-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Review Proposals</h1>
        {pendingProposals.length > 0 && (
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            {pendingProposals.length} pending
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-white rounded-lg border border-gray-200">
        <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Sources</option>
              <option value="phoneCall">Phone Call</option>
              <option value="fileUpload">File Upload</option>
              <option value="urlRefresh">URL Refresh</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Section</label>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Sections</option>
              {sectionInstances.map((s) => (
                <option key={s.intakeSectionInstanceId} value={s.intakeSectionInstanceId}>
                  {s.sectionName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Proposal cards */}
      {pendingProposals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-700 mb-1">No proposals to review</h3>
          <p className="text-sm text-gray-500">
            All proposals have been reviewed, or no proposals match the current filters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingProposals.map((proposal) => {
            const question = questionMap.get(proposal.intakeQuestionInstanceId);
            const section = question
              ? sectionInstances.find(
                  (s) => s.intakeSectionInstanceId === question.intakeSectionInstanceId,
                )
              : undefined;
            const confidence = proposal.confidenceScore ?? 0;

            return (
              <div
                key={proposal.proposalId}
                className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
              >
                <div className="p-5">
                  {/* Section & question */}
                  <div className="mb-3">
                    {section && (
                      <span className="text-xs font-medium text-indigo-600 uppercase tracking-wider">
                        {section.sectionName}
                      </span>
                    )}
                    <h3 className="text-base font-semibold text-gray-900 mt-1">
                      {question?.questionText ?? 'Unknown Question'}
                    </h3>
                  </div>

                  {/* Proposed answer */}
                  <div className="mb-4">
                    {editingId === proposal.proposalId ? (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Edit Answer
                        </label>
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        />
                      </div>
                    ) : (
                      <div>
                        <span className="block text-xs font-medium text-gray-500 mb-1">
                          Proposed Answer
                        </span>
                        <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3">
                          {proposal.proposedAnswer}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confidence bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Confidence</span>
                      <span>{Math.round(confidence * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          confidence >= 0.8
                            ? 'bg-green-500'
                            : confidence >= 0.5
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${confidence * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Source */}
                  <div className="mb-4 bg-blue-50 rounded-lg p-3">
                    <span className="block text-xs font-medium text-blue-700 mb-1">Source</span>
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-sm text-blue-900">{proposal.source}</span>
                    </div>
                  </div>

                  {/* Rejection reason input */}
                  {rejectingId === proposal.proposalId && (
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Rejection Reason
                      </label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                        placeholder="Why is this proposal being rejected?"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                      />
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    {editingId === proposal.proposalId ? (
                      <>
                        <button
                          onClick={() =>
                            acceptMutation.mutate({
                              proposalId: proposal.proposalId,
                              answer: editText,
                            })
                          }
                          disabled={acceptMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          Save &amp; Accept
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : rejectingId === proposal.proposalId ? (
                      <>
                        <button
                          onClick={() =>
                            rejectMutation.mutate({
                              proposalId: proposal.proposalId,
                              reason: rejectReason,
                            })
                          }
                          disabled={rejectMutation.isPending || !rejectReason.trim()}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                          Confirm Reject
                        </button>
                        <button
                          onClick={() => setRejectingId(null)}
                          className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            acceptMutation.mutate({ proposalId: proposal.proposalId })
                          }
                          disabled={acceptMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          Accept
                        </button>
                        <button
                          onClick={() => handleAcceptAndEdit(proposal)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                        >
                          <Pencil className="w-4 h-4" />
                          Accept &amp; Edit
                        </button>
                        <button
                          onClick={() => handleRejectStart(proposal.proposalId)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                        >
                          <X className="w-4 h-4" />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
