import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Mail,
  Phone,
  Star,
  Edit2,
  Plus,
  CalendarClock,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { api, axiosInstance } from '@/api/client';
import type {
  Contributor,
  Assignment,
  IntakeSectionInstance,
} from '@/types';

// ── API helpers ──

function fetchContributors(intakeId: string): Promise<Contributor[]> {
  return api.contributors.list(intakeId);
}

function fetchAssignments(intakeId: string): Promise<Assignment[]> {
  return axiosInstance.get<Assignment[]>(`/intakes/${intakeId}/assignments`).then((r) => r.data);
}

function fetchSectionInstances(intakeId: string): Promise<IntakeSectionInstance[]> {
  return api.sections.list(intakeId);
}

// ── Page ──

export default function PeoplePage() {
  const { intakeId } = useParams<{ intakeId: string }>();
  const queryClient = useQueryClient();

  const [showAddContributor, setShowAddContributor] = useState(false);
  const [editingContributor, setEditingContributor] = useState<Contributor | null>(null);
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [expandedContributors, setExpandedContributors] = useState<Set<string>>(new Set());

  const { data: contributors = [], isLoading: loadingContributors } = useQuery({
    queryKey: ['contributors', intakeId],
    queryFn: () => fetchContributors(intakeId!),
    enabled: !!intakeId,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments', intakeId],
    queryFn: () => fetchAssignments(intakeId!),
    enabled: !!intakeId,
  });

  const { data: sectionInstances = [] } = useQuery({
    queryKey: ['section-instances', intakeId],
    queryFn: () => fetchSectionInstances(intakeId!),
    enabled: !!intakeId,
  });

  const createContributor = useMutation({
    mutationFn: (data: { name: string; email?: string; phone?: string; role?: string }) =>
      api.contributors.create(intakeId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributors', intakeId] });
      setShowAddContributor(false);
    },
  });

  const updateContributor = useMutation({
    mutationFn: (data: { contributorId: string; name: string; email?: string; phone?: string; role?: string }) =>
      axiosInstance.put(`/intakes/${intakeId}/contributors/${data.contributorId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributors', intakeId] });
      setEditingContributor(null);
    },
  });

  const createAssignment = useMutation({
    mutationFn: (data: { contributorId: string; intakeSectionInstanceId: string }) =>
      api.contributors.assign(intakeId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments', intakeId] });
      setShowAddAssignment(false);
    },
  });

  const scheduleFollowUp = useMutation({
    mutationFn: (contributorId: string) =>
      api.followUps.create(intakeId!, { description: 'Follow-up', assignedTo: contributorId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups', intakeId] });
    },
  });

  const toggleExpanded = (id: string) => {
    setExpandedContributors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build a lookup for section instances by ID
  const sectionMap = new Map(sectionInstances.map((s) => [s.intakeSectionInstanceId, s]));

  // Build assignments per contributor
  const assignmentsForContributor = (contributorId: string) =>
    assignments.filter((a) => a.contributorId === contributorId);

  if (loadingContributors) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">People &amp; Assignments</h1>
        </div>
        <button
          onClick={() => setShowAddContributor(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Contributor
        </button>
      </div>

      {/* ── Contributors List ── */}
      <section className="space-y-4 mb-10">
        {contributors.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
            No contributors yet. Add your first contributor above.
          </div>
        )}

        {contributors.map((c) => {
          const contribAssignments = assignmentsForContributor(c.contributorId);
          const isExpanded = expandedContributors.has(c.contributorId);
          return (
            <div key={c.contributorId} className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      onClick={() => toggleExpanded(c.contributorId)}
                      className="mt-1 text-gray-400 hover:text-gray-600"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{c.name}</h3>
                        {c.role && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            {c.role === 'primary' && <Star className="w-3 h-3 text-amber-500" />}
                            {c.role}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        {c.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {c.email}
                          </span>
                        )}
                        {c.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {c.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setEditingContributor(c)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => scheduleFollowUp.mutate(c.contributorId)}
                      disabled={scheduleFollowUp.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Schedule Follow-up"
                    >
                      <CalendarClock className="w-4 h-4" />
                      Follow-up
                    </button>
                  </div>
                </div>

                {/* Assigned sections */}
                {isExpanded && (
                  <div className="mt-4 ml-7">
                    {contribAssignments.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assigned Sections
                        </h4>
                        {contribAssignments.map((a) => {
                          const section = sectionMap.get(a.intakeSectionInstanceId);
                          return (
                            <div
                              key={a.assignmentId}
                              className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                            >
                              <span className="text-sm font-medium text-gray-700">
                                {section?.sectionName ?? 'Unknown Section'}
                              </span>
                              {section && (
                                <div className="flex items-center gap-3">
                                  <div className="w-32 bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-indigo-500 h-2 rounded-full transition-all"
                                      style={{ width: `${section.percentComplete}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500 w-10 text-right">
                                    {section.percentComplete}%
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No sections assigned yet.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Assignments Table ── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Assignments</h2>
          <button
            onClick={() => setShowAddAssignment(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Assignment
          </button>
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">
            No assignments yet.
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contributor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Section
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assignments.map((a) => {
                  const contributor = contributors.find(
                    (c) => c.contributorId === a.contributorId,
                  );
                  const section = sectionMap.get(a.intakeSectionInstanceId);
                  return (
                    <tr key={a.assignmentId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {contributor?.name ?? 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {section?.sectionName ?? 'Unknown'}
                      </td>
                      <td className="px-4 py-3">
                        {section ? (
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-indigo-500 h-2 rounded-full transition-all"
                                style={{ width: `${section.percentComplete}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {section.percentComplete}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(a.assignedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Add Contributor Modal ── */}
      {showAddContributor && (
        <ContributorFormModal
          title="Add Contributor"
          onClose={() => setShowAddContributor(false)}
          onSubmit={(data) => createContributor.mutate(data)}
          isPending={createContributor.isPending}
        />
      )}

      {/* ── Edit Contributor Modal ── */}
      {editingContributor && (
        <ContributorFormModal
          title="Edit Contributor"
          initialData={editingContributor}
          onClose={() => setEditingContributor(null)}
          onSubmit={(data) =>
            updateContributor.mutate({
              contributorId: editingContributor.contributorId,
              ...data,
            })
          }
          isPending={updateContributor.isPending}
        />
      )}

      {/* ── Add Assignment Modal ── */}
      {showAddAssignment && (
        <AddAssignmentModal
          contributors={contributors}
          sectionInstances={sectionInstances}
          onClose={() => setShowAddAssignment(false)}
          onSubmit={(data) => createAssignment.mutate(data)}
          isPending={createAssignment.isPending}
        />
      )}
    </div>
  );
}

// ── Sub-components ──

interface ContributorFormData {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
}

function ContributorFormModal({
  title,
  initialData,
  onClose,
  onSubmit,
  isPending,
}: {
  title: string;
  initialData?: Contributor;
  onClose: () => void;
  onSubmit: (data: ContributorFormData) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<ContributorFormData>({
    name: initialData?.name ?? '',
    email: initialData?.email ?? '',
    phone: initialData?.phone ?? '',
    role: initialData?.role ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">-- select --</option>
              <option value="primary">Primary Contact</option>
              <option value="contributor">Contributor</option>
              <option value="reviewer">Reviewer</option>
            </select>
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

function AddAssignmentModal({
  contributors,
  sectionInstances,
  onClose,
  onSubmit,
  isPending,
}: {
  contributors: Contributor[];
  sectionInstances: IntakeSectionInstance[];
  onClose: () => void;
  onSubmit: (data: { contributorId: string; intakeSectionInstanceId: string }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    contributorId: contributors[0]?.contributorId ?? '',
    intakeSectionInstanceId: sectionInstances[0]?.intakeSectionInstanceId ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add Assignment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contributor</label>
            <select
              value={form.contributorId}
              onChange={(e) => setForm({ ...form, contributorId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {contributors.map((c) => (
                <option key={c.contributorId} value={c.contributorId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
            <select
              value={form.intakeSectionInstanceId}
              onChange={(e) =>
                setForm({ ...form, intakeSectionInstanceId: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {sectionInstances.map((s) => (
                <option key={s.intakeSectionInstanceId} value={s.intakeSectionInstanceId}>
                  {s.sectionName}
                  {s.instanceLabel ? ` (${s.instanceLabel})` : ''}
                </option>
              ))}
            </select>
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
              {isPending ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
