import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'
import { requirementsApi, Requirement } from '@/api/client'

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'ready_to_build', label: 'Ready to Build' },
  { value: 'implemented', label: 'Implemented' },
  { value: 'verified', label: 'Verified' },
]

const priorityOptions = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export default function RequirementDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [requirement, setRequirement] = useState<Requirement | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    what_this_does: '',
    why_this_exists: '',
    not_included: '',
    acceptance_criteria: '',
    status: 'draft',
    priority: 'medium',
  })

  useEffect(() => {
    if (id) fetchRequirement()
  }, [id])

  async function fetchRequirement() {
    try {
      const data = await requirementsApi.get(id!)
      setRequirement(data)
      setForm({
        title: data.title,
        what_this_does: data.what_this_does || '',
        why_this_exists: data.why_this_exists || '',
        not_included: data.not_included || '',
        acceptance_criteria: data.acceptance_criteria || '',
        status: data.status,
        priority: data.priority,
      })
    } catch (error) {
      console.error('Error fetching requirement:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!requirement) return

    setSaving(true)
    try {
      await requirementsApi.update(requirement.id, {
        title: form.title,
        what_this_does: form.what_this_does || undefined,
        why_this_exists: form.why_this_exists || undefined,
        not_included: form.not_included || undefined,
        acceptance_criteria: form.acceptance_criteria || undefined,
        status: form.status,
        priority: form.priority,
      })
      fetchRequirement()
    } catch (error) {
      console.error('Error saving requirement:', error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!requirement || !confirm('Are you sure you want to delete this requirement?')) return

    setDeleting(true)
    try {
      await requirementsApi.delete(requirement.id)
      navigate(`/products/${requirement.product_id}`)
    } catch (error) {
      console.error('Error deleting requirement:', error)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!requirement) {
    return (
      <div className="px-6 py-8 max-w-4xl mx-auto">
        <p className="text-gray-500">Requirement not found</p>
      </div>
    )
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="mb-4">
        <Link
          to={`/products/${requirement.product_id}`}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to product
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">
            {requirement.stable_key}
          </Badge>
          <span className="text-sm text-gray-500">v{requirement.current_version}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Title
              </label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="text-lg font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Status
                </label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm({ ...form, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Priority
                </label>
                <Select
                  value={form.priority}
                  onValueChange={(value) => setForm({ ...form, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                What this does
              </label>
              <Textarea
                placeholder="Users can..."
                value={form.what_this_does}
                onChange={(e) => setForm({ ...form, what_this_does: e.target.value })}
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">One clear sentence starting with "Users can..."</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Why this exists
              </label>
              <Textarea
                placeholder="This helps people..."
                value={form.why_this_exists}
                onChange={(e) => setForm({ ...form, why_this_exists: e.target.value })}
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">One or two sentences in plain English</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Not included
              </label>
              <Textarea
                placeholder="• Branching or merging versions..."
                value={form.not_included}
                onChange={(e) => setForm({ ...form, not_included: e.target.value })}
                rows={4}
              />
              <p className="text-xs text-gray-500 mt-1">Bullets that avoid confusion and scope creep</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Acceptance criteria
              </label>
              <Textarea
                placeholder="• Users can see a list of versions..."
                value={form.acceptance_criteria}
                onChange={(e) => setForm({ ...form, acceptance_criteria: e.target.value })}
                rows={4}
              />
              <p className="text-xs text-gray-500 mt-1">Testable criteria that map to tests</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
