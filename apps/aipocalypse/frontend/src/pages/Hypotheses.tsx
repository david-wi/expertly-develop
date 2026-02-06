import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Lightbulb, Plus, ChevronDown, ChevronUp, Archive, RotateCcw, Trash2, Edit2, ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react'
import { hypothesesApi } from '../services/api'
import { ConfidenceMeter } from '../components/ConfidenceMeter'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import type { Hypothesis, ThesisType, ImpactDirection } from '../types'

const thesisTypeLabels: Record<ThesisType, string> = {
  disruption: 'Disruption',
  secular_trend: 'Secular Trend',
  macro: 'Macro',
  regulatory: 'Regulatory',
}

const impactIcons: Record<ImpactDirection, React.ReactNode> = {
  positive: <ArrowUpRight className="w-4 h-4 text-green-500" />,
  negative: <ArrowDownRight className="w-4 h-4 text-red-500" />,
  mixed: <ArrowRight className="w-4 h-4 text-yellow-500" />,
}

export function Hypotheses() {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    thesis_type: 'disruption' as ThesisType,
    impact_direction: 'negative' as ImpactDirection,
    confidence_level: 50,
    tags: '',
    supporting_evidence: '',
    counter_arguments: '',
  })

  const { data: hypotheses, isLoading } = useQuery({
    queryKey: ['hypotheses'],
    queryFn: () => hypothesesApi.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Hypothesis>) => hypothesesApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hypotheses'] }); closeModal() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Hypothesis> }) => hypothesesApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hypotheses'] }); closeModal() },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => hypothesesApi.archive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hypotheses'] }),
  })

  const activateMutation = useMutation({
    mutationFn: (id: string) => hypothesesApi.activate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hypotheses'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hypothesesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hypotheses'] }),
  })

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setForm({ title: '', description: '', thesis_type: 'disruption', impact_direction: 'negative', confidence_level: 50, tags: '', supporting_evidence: '', counter_arguments: '' })
  }

  const openEdit = (h: Hypothesis) => {
    setEditingId(h.id)
    setForm({
      title: h.title,
      description: h.description,
      thesis_type: h.thesis_type,
      impact_direction: h.impact_direction,
      confidence_level: h.confidence_level,
      tags: h.tags.join(', '),
      supporting_evidence: h.supporting_evidence.join('\n'),
      counter_arguments: h.counter_arguments.join('\n'),
    })
    setShowModal(true)
  }

  const handleSubmit = () => {
    const data = {
      title: form.title,
      description: form.description,
      thesis_type: form.thesis_type,
      impact_direction: form.impact_direction,
      confidence_level: form.confidence_level,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      supporting_evidence: form.supporting_evidence.split('\n').map(e => e.trim()).filter(Boolean),
      counter_arguments: form.counter_arguments.split('\n').map(a => a.trim()).filter(Boolean),
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const active = hypotheses?.filter(h => h.status === 'active') ?? []
  const archived = hypotheses?.filter(h => h.status === 'archived') ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Investment Hypotheses</h1>
          <p className="text-gray-500 mt-1">Define and track your investment theses</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Hypothesis
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : active.length === 0 && archived.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No hypotheses yet"
          description="Create investment hypotheses to track how AI will impact different companies and industries."
          action={{ label: 'Create Hypothesis', onClick: () => setShowModal(true) }}
        />
      ) : (
        <div className="space-y-4">
          {active.map(h => (
            <HypothesisCard
              key={h.id}
              hypothesis={h}
              expanded={expanded === h.id}
              onToggle={() => setExpanded(expanded === h.id ? null : h.id)}
              onEdit={() => openEdit(h)}
              onArchive={() => archiveMutation.mutate(h.id)}
              onDelete={() => { if (confirm('Delete this hypothesis?')) deleteMutation.mutate(h.id) }}
            />
          ))}
          {archived.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-gray-400 uppercase mt-8 mb-2">Archived</h3>
              {archived.map(h => (
                <HypothesisCard
                  key={h.id}
                  hypothesis={h}
                  expanded={expanded === h.id}
                  onToggle={() => setExpanded(expanded === h.id ? null : h.id)}
                  onEdit={() => openEdit(h)}
                  onActivate={() => activateMutation.mutate(h.id)}
                  onDelete={() => { if (confirm('Delete this hypothesis?')) deleteMutation.mutate(h.id) }}
                />
              ))}
            </>
          )}
        </div>
      )}

      <Modal open={showModal} onClose={closeModal} title={editingId ? 'Edit Hypothesis' : 'New Hypothesis'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g., AI Coding Tools Devastate IT Services"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Describe your investment thesis..."
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.thesis_type}
                onChange={e => setForm({ ...form, thesis_type: e.target.value as ThesisType })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {Object.entries(thesisTypeLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Impact Direction</label>
              <select
                value={form.impact_direction}
                onChange={e => setForm({ ...form, impact_direction: e.target.value as ImpactDirection })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="negative">Negative</option>
                <option value="positive">Positive</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confidence: {form.confidence_level}%</label>
              <input
                type="range"
                min={0}
                max={100}
                value={form.confidence_level}
                onChange={e => setForm({ ...form, confidence_level: Number(e.target.value) })}
                className="w-full mt-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={form.tags}
              onChange={e => setForm({ ...form, tags: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="ai-coding, it-services, disruption"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supporting Evidence (one per line)</label>
            <textarea
              value={form.supporting_evidence}
              onChange={e => setForm({ ...form, supporting_evidence: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Counter Arguments (one per line)</label>
            <textarea
              value={form.counter_arguments}
              onChange={e => setForm({ ...form, counter_arguments: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={!form.title || !form.description || createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function HypothesisCard({
  hypothesis: h,
  expanded,
  onToggle,
  onEdit,
  onArchive,
  onActivate,
  onDelete,
}: {
  hypothesis: Hypothesis
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onArchive?: () => void
  onActivate?: () => void
  onDelete: () => void
}) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${h.status === 'archived' ? 'opacity-60' : ''}`}>
      <div className="px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 cursor-pointer" onClick={onToggle}>
            <div className="flex items-center gap-3 mb-2">
              {impactIcons[h.impact_direction]}
              <h3 className="font-semibold text-gray-900">{h.title}</h3>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {thesisTypeLabels[h.thesis_type]}
              </span>
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">{h.description}</p>
            <div className="flex items-center gap-4 mt-3">
              <div className="w-32">
                <ConfidenceMeter value={h.confidence_level} label="Confidence" />
              </div>
              <div className="flex gap-1">
                {h.tags.slice(0, 4).map(tag => (
                  <span key={tag} className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 ml-4">
            <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-gray-600 rounded" title="Edit">
              <Edit2 className="w-4 h-4" />
            </button>
            {onArchive && (
              <button onClick={onArchive} className="p-1.5 text-gray-400 hover:text-gray-600 rounded" title="Archive">
                <Archive className="w-4 h-4" />
              </button>
            )}
            {onActivate && (
              <button onClick={onActivate} className="p-1.5 text-gray-400 hover:text-green-600 rounded" title="Activate">
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onToggle} className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-6 pb-4 border-t border-gray-100 pt-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-green-700 mb-2">Supporting Evidence</h4>
              <ul className="space-y-1">
                {h.supporting_evidence.map((e, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">+</span> {e}
                  </li>
                ))}
                {h.supporting_evidence.length === 0 && <li className="text-sm text-gray-400 italic">No evidence added</li>}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-red-700 mb-2">Counter Arguments</h4>
              <ul className="space-y-1">
                {h.counter_arguments.map((a, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">-</span> {a}
                  </li>
                ))}
                {h.counter_arguments.length === 0 && <li className="text-sm text-gray-400 italic">No counter arguments</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
