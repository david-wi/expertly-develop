import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Plus,
  GripVertical,
  Repeat,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import { api } from '@/api/client';
import type { TemplateVersion, TemplateSection, TemplateQuestion, AnswerType } from '@/types';

// ── API helpers ──

function fetchTemplateVersion(versionId: string) {
  return api.get<TemplateVersion>(`/templates/${versionId}`).then((r) => r.data);
}

// ── Page ──

export default function TemplateEditorPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState<TemplateSection | null>(null);
  const [showQuestionModal, setShowQuestionModal] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<TemplateQuestion | null>(null);

  const { data: template, isLoading } = useQuery({
    queryKey: ['template-version', versionId],
    queryFn: () => fetchTemplateVersion(versionId!),
    enabled: !!versionId,
  });

  const publishMutation = useMutation({
    mutationFn: () => api.post(`/templates/${versionId}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-version', versionId] });
    },
  });

  const addSectionMutation = useMutation({
    mutationFn: (data: {
      sectionName: string;
      sectionOrder: number;
      isRepeatable: boolean;
      repeatKeyName?: string;
      applicabilityRuleText?: string;
    }) => api.post(`/templates/${versionId}/sections`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-version', versionId] });
      setShowSectionModal(false);
      setEditingSection(null);
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({
      sectionId,
      ...data
    }: {
      sectionId: string;
      sectionName: string;
      sectionOrder: number;
      isRepeatable: boolean;
      repeatKeyName?: string;
      applicabilityRuleText?: string;
    }) => api.put(`/templates/${versionId}/sections/${sectionId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-version', versionId] });
      setShowSectionModal(false);
      setEditingSection(null);
    },
  });

  const addQuestionMutation = useMutation({
    mutationFn: ({
      sectionId,
      ...data
    }: {
      sectionId: string;
      questionKey: string;
      questionText: string;
      questionHelpText?: string;
      questionOrder: number;
      isRequired: boolean;
      answerType: AnswerType;
      applicabilityRuleText?: string;
    }) => api.post(`/templates/${versionId}/sections/${sectionId}/questions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-version', versionId] });
      setShowQuestionModal(null);
      setEditingQuestion(null);
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({
      sectionId,
      questionId,
      ...data
    }: {
      sectionId: string;
      questionId: string;
      questionKey: string;
      questionText: string;
      questionHelpText?: string;
      questionOrder: number;
      isRequired: boolean;
      answerType: AnswerType;
      applicabilityRuleText?: string;
    }) =>
      api.put(
        `/templates/${versionId}/sections/${sectionId}/questions/${questionId}`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-version', versionId] });
      setShowQuestionModal(null);
      setEditingQuestion(null);
    },
  });

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading || !template) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Loading template...</div>
      </div>
    );
  }

  const sections = [...(template.sections ?? [])].sort(
    (a, b) => a.sectionOrder - b.sectionOrder,
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/templates')}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{template.templateName}</h1>
              {template.isPublished ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <CheckCircle2 className="w-3 h-3" />
                  Published
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  Draft
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Version: {template.versionLabel}</p>
          </div>
        </div>

        {!template.isPublished && (
          <button
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {publishMutation.isPending ? 'Publishing...' : 'Publish'}
          </button>
        )}
      </div>

      {/* Sections list */}
      <div className="space-y-3 mb-6">
        {sections.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
            No sections yet. Add your first section below.
          </div>
        )}

        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.templateSectionId);
          const questions = [...(section.questions ?? [])].sort(
            (a, b) => a.questionOrder - b.questionOrder,
          );

          return (
            <div
              key={section.templateSectionId}
              className="bg-white rounded-lg border border-gray-200 shadow-sm"
            >
              {/* Section header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <GripVertical className="w-4 h-4 text-gray-300" />
                  <button
                    onClick={() => toggleSection(section.templateSectionId)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-400">
                        #{section.sectionOrder}
                      </span>
                      <h3 className="font-semibold text-gray-900">{section.sectionName}</h3>
                      {section.isRepeatable && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          <Repeat className="w-3 h-3" />
                          Repeatable
                        </span>
                      )}
                    </div>
                    {section.applicabilityRuleText && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Rule: {section.applicabilityRuleText}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {questions.length} question{questions.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => {
                      setEditingSection(section);
                      setShowSectionModal(true);
                    }}
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Questions */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-4 pb-4">
                  {questions.length === 0 ? (
                    <p className="text-sm text-gray-400 py-3 ml-11">No questions in this section.</p>
                  ) : (
                    <div className="space-y-2 mt-3 ml-11">
                      {questions.map((q) => (
                        <div
                          key={q.templateQuestionId}
                          className="flex items-start justify-between bg-gray-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100"
                          onClick={() => {
                            setEditingQuestion(q);
                            setShowQuestionModal(section.templateSectionId);
                          }}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 font-mono">
                                {q.questionKey}
                              </span>
                              {q.isRequired && (
                                <span className="text-xs text-red-500">required</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-800 mt-0.5">{q.questionText}</p>
                            {q.questionHelpText && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {q.questionHelpText}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-3">
                            {q.answerType}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 ml-11">
                    <button
                      onClick={() => {
                        setEditingQuestion(null);
                        setShowQuestionModal(section.templateSectionId);
                      }}
                      className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add Question
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add section button */}
      <button
        onClick={() => {
          setEditingSection(null);
          setShowSectionModal(true);
        }}
        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Section
      </button>

      {/* Section modal */}
      {showSectionModal && (
        <SectionFormModal
          section={editingSection}
          nextOrder={sections.length + 1}
          onClose={() => {
            setShowSectionModal(false);
            setEditingSection(null);
          }}
          onSubmit={(data) => {
            if (editingSection) {
              updateSectionMutation.mutate({
                sectionId: editingSection.templateSectionId,
                ...data,
              });
            } else {
              addSectionMutation.mutate(data);
            }
          }}
          isPending={addSectionMutation.isPending || updateSectionMutation.isPending}
        />
      )}

      {/* Question modal */}
      {showQuestionModal && (
        <QuestionFormModal
          question={editingQuestion}
          sectionId={showQuestionModal}
          nextOrder={
            (
              sections.find((s) => s.templateSectionId === showQuestionModal)?.questions ?? []
            ).length + 1
          }
          onClose={() => {
            setShowQuestionModal(null);
            setEditingQuestion(null);
          }}
          onSubmit={(data) => {
            if (editingQuestion) {
              updateQuestionMutation.mutate({
                sectionId: showQuestionModal,
                questionId: editingQuestion.templateQuestionId,
                ...data,
              });
            } else {
              addQuestionMutation.mutate({
                sectionId: showQuestionModal,
                ...data,
              });
            }
          }}
          isPending={addQuestionMutation.isPending || updateQuestionMutation.isPending}
        />
      )}
    </div>
  );
}

// ── Section Form Modal ──

interface SectionFormData {
  sectionName: string;
  sectionOrder: number;
  isRepeatable: boolean;
  repeatKeyName?: string;
  applicabilityRuleText?: string;
}

function SectionFormModal({
  section,
  nextOrder,
  onClose,
  onSubmit,
  isPending,
}: {
  section: TemplateSection | null;
  nextOrder: number;
  onClose: () => void;
  onSubmit: (data: SectionFormData) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<SectionFormData>({
    sectionName: section?.sectionName ?? '',
    sectionOrder: section?.sectionOrder ?? nextOrder,
    isRepeatable: section?.isRepeatable ?? false,
    repeatKeyName: section?.repeatKeyName ?? '',
    applicabilityRuleText: section?.applicabilityRuleText ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {section ? 'Edit Section' : 'Add Section'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section Name</label>
            <input
              type="text"
              required
              value={form.sectionName}
              onChange={(e) => setForm({ ...form, sectionName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
            <input
              type="number"
              min={1}
              value={form.sectionOrder}
              onChange={(e) =>
                setForm({ ...form, sectionOrder: parseInt(e.target.value) || 1 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isRepeatable"
              checked={form.isRepeatable}
              onChange={(e) => setForm({ ...form, isRepeatable: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isRepeatable" className="text-sm text-gray-700">
              Repeatable section
            </label>
          </div>
          {form.isRepeatable && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Repeat Key Name
              </label>
              <input
                type="text"
                value={form.repeatKeyName}
                onChange={(e) => setForm({ ...form, repeatKeyName: e.target.value })}
                placeholder="e.g. location_name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Applicability Rule
            </label>
            <input
              type="text"
              value={form.applicabilityRuleText}
              onChange={(e) => setForm({ ...form, applicabilityRuleText: e.target.value })}
              placeholder="e.g. answers.hasMultipleLocations === true"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave blank if this section always applies.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Question Form Modal ──

const ANSWER_TYPES: { value: AnswerType; label: string }[] = [
  { value: 'shortText', label: 'Short Text' },
  { value: 'longText', label: 'Long Text' },
  { value: 'yesNo', label: 'Yes / No' },
  { value: 'list', label: 'List' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
  { value: 'uploadRequested', label: 'Upload Requested' },
];

interface QuestionFormData {
  questionKey: string;
  questionText: string;
  questionHelpText?: string;
  questionOrder: number;
  isRequired: boolean;
  answerType: AnswerType;
  applicabilityRuleText?: string;
}

function QuestionFormModal({
  question,
  sectionId: _sectionId,
  nextOrder,
  onClose,
  onSubmit,
  isPending,
}: {
  question: TemplateQuestion | null;
  sectionId: string;
  nextOrder: number;
  onClose: () => void;
  onSubmit: (data: QuestionFormData) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<QuestionFormData>({
    questionKey: question?.questionKey ?? '',
    questionText: question?.questionText ?? '',
    questionHelpText: question?.questionHelpText ?? '',
    questionOrder: question?.questionOrder ?? nextOrder,
    isRequired: question?.isRequired ?? false,
    answerType: question?.answerType ?? 'shortText',
    applicabilityRuleText: question?.applicabilityRuleText ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">
            {question ? 'Edit Question' : 'Add Question'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question Key</label>
            <input
              type="text"
              required
              value={form.questionKey}
              onChange={(e) => setForm({ ...form, questionKey: e.target.value })}
              placeholder="e.g. company_name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
            <textarea
              required
              value={form.questionText}
              onChange={(e) => setForm({ ...form, questionText: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Help Text</label>
            <textarea
              value={form.questionHelpText}
              onChange={(e) => setForm({ ...form, questionHelpText: e.target.value })}
              rows={2}
              placeholder="Additional guidance for contributors"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
              <input
                type="number"
                min={1}
                value={form.questionOrder}
                onChange={(e) =>
                  setForm({ ...form, questionOrder: parseInt(e.target.value) || 1 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Answer Type</label>
              <select
                value={form.answerType}
                onChange={(e) =>
                  setForm({ ...form, answerType: e.target.value as AnswerType })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {ANSWER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isRequired"
              checked={form.isRequired}
              onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isRequired" className="text-sm text-gray-700">
              Required
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Applicability Rule
            </label>
            <input
              type="text"
              value={form.applicabilityRuleText}
              onChange={(e) =>
                setForm({ ...form, applicabilityRuleText: e.target.value })
              }
              placeholder="Leave blank if always applicable"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
