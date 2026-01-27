import { useEffect, useState } from 'react'
import { api, Playbook, CreatePlaybookRequest, ScopeType, User, Team } from '../services/api'
import { useAppStore } from '../stores/appStore'

export default function Playbooks() {
  const { user } = useAppStore()
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [formData, setFormData] = useState<{
    name: string
    description: string
    scope_type: ScopeType
    scope_id: string
  }>({
    name: '',
    description: '',
    scope_type: 'user',
    scope_id: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  // Close modals on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false)
        setShowEditModal(false)
        setShowDeleteConfirm(false)
        setShowHistoryModal(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [playbooksData, usersData, teamsData] = await Promise.all([
        api.getPlaybooks(),
        api.getUsers('human'),
        api.getTeams(),
      ])
      setPlaybooks(playbooksData)
      setUsers(usersData)
      setTeams(teamsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getScopeLabel = (playbook: Playbook): string => {
    if (playbook.scope_type === 'user') {
      if (playbook.scope_id === user?.id) {
        return `Private (${user?.name || 'You'})`
      }
      const scopeUser = users.find(u => u.id === playbook.scope_id)
      return `Private (${scopeUser?.name || 'User'})`
    }
    if (playbook.scope_type === 'team') {
      const team = teams.find(t => t.id === playbook.scope_id)
      return `Team: ${team?.name || 'Unknown'}`
    }
    return 'Everyone'
  }

  const getScopeBadgeColor = (scopeType: ScopeType): string => {
    switch (scopeType) {
      case 'user':
        return 'bg-blue-100 text-blue-800'
      case 'team':
        return 'bg-purple-100 text-purple-800'
      case 'organization':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setSaving(true)
    try {
      const newPlaybook: CreatePlaybookRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        scope_type: formData.scope_type,
        scope_id: formData.scope_type === 'organization' ? undefined : formData.scope_id || undefined,
      }
      await api.createPlaybook(newPlaybook)
      await loadData()
      setShowCreateModal(false)
      resetForm()
    } catch (error) {
      console.error('Failed to create playbook:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlaybook || !formData.name.trim()) return

    setSaving(true)
    try {
      await api.updatePlaybook(selectedPlaybook.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        scope_type: formData.scope_type,
        scope_id: formData.scope_type === 'organization' ? undefined : formData.scope_id || undefined,
      })
      await loadData()
      setShowEditModal(false)
      setSelectedPlaybook(null)
      resetForm()
    } catch (error) {
      console.error('Failed to update playbook:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedPlaybook) return

    setSaving(true)
    try {
      await api.deletePlaybook(selectedPlaybook.id)
      await loadData()
      setShowDeleteConfirm(false)
      setSelectedPlaybook(null)
    } catch (error) {
      console.error('Failed to delete playbook:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicate = async (playbook: Playbook) => {
    try {
      await api.duplicatePlaybook(playbook.id)
      await loadData()
    } catch (error) {
      console.error('Failed to duplicate playbook:', error)
    }
  }

  const openCreateModal = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const openEditModal = (playbook: Playbook) => {
    setSelectedPlaybook(playbook)
    setFormData({
      name: playbook.name,
      description: playbook.description || '',
      scope_type: playbook.scope_type,
      scope_id: playbook.scope_id || '',
    })
    setShowEditModal(true)
  }

  const openDeleteConfirm = (playbook: Playbook) => {
    setSelectedPlaybook(playbook)
    setShowDeleteConfirm(true)
  }

  const openHistoryModal = (playbook: Playbook) => {
    setSelectedPlaybook(playbook)
    setShowHistoryModal(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      scope_type: 'user',
      scope_id: '',
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Playbooks</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            className="text-gray-600 hover:text-gray-700 text-sm"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={openCreateModal}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 transition-colors"
          >
            New Playbook
          </button>
        </div>
      </div>

      {/* Playbooks List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Playbook
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scope
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  Version
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                  Updated
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {playbooks.map((playbook) => (
                <tr key={playbook.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{playbook.name}</p>
                      {playbook.description && (
                        <p className="text-xs text-gray-500 truncate max-w-md">
                          {playbook.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getScopeBadgeColor(playbook.scope_type)}`}>
                      {getScopeLabel(playbook)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-600">v{playbook.version}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">{formatDate(playbook.updated_at)}</span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {playbook.history.length > 0 && (
                      <button
                        onClick={() => openHistoryModal(playbook)}
                        className="text-gray-600 hover:text-gray-800 text-sm"
                      >
                        History
                      </button>
                    )}
                    <button
                      onClick={() => handleDuplicate(playbook)}
                      className="text-gray-600 hover:text-gray-800 text-sm"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => openEditModal(playbook)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDeleteConfirm(playbook)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {playbooks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No playbooks found. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Playbook Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Playbook</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Customer Onboarding, Bug Triage"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={2}
                  placeholder="Brief description of this playbook"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visibility
                </label>
                <select
                  value={formData.scope_type}
                  onChange={(e) => setFormData({ ...formData, scope_type: e.target.value as ScopeType, scope_id: '' })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="user">Private (just me)</option>
                  <option value="team">Team</option>
                  <option value="organization">Everyone</option>
                </select>
              </div>
              {formData.scope_type === 'team' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Team
                  </label>
                  <select
                    value={formData.scope_id}
                    onChange={(e) => setFormData({ ...formData, scope_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Choose a team...</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Playbook Modal */}
      {showEditModal && selectedPlaybook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Playbook</h3>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visibility
                </label>
                <select
                  value={formData.scope_type}
                  onChange={(e) => setFormData({ ...formData, scope_type: e.target.value as ScopeType, scope_id: '' })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="user">Private (just me)</option>
                  <option value="team">Team</option>
                  <option value="organization">Everyone</option>
                </select>
              </div>
              {formData.scope_type === 'team' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Team
                  </label>
                  <select
                    value={formData.scope_id}
                    onChange={(e) => setFormData({ ...formData, scope_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Choose a team...</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedPlaybook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Playbook?</h3>
            <p className="text-gray-500 mb-4">
              Are you sure you want to delete "{selectedPlaybook.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedPlaybook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Version History: {selectedPlaybook.name}
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {/* Current version */}
              <div className="border-l-4 border-blue-500 pl-3 py-1">
                <p className="font-medium text-gray-900">
                  v{selectedPlaybook.version} (current)
                </p>
                <p className="text-sm text-gray-500">{selectedPlaybook.name}</p>
              </div>
              {/* Historical versions */}
              {selectedPlaybook.history.slice().reverse().map((entry, idx) => (
                <div key={idx} className="border-l-4 border-gray-300 pl-3 py-1">
                  <p className="font-medium text-gray-700">v{entry.version}</p>
                  <p className="text-sm text-gray-500">{entry.name}</p>
                  <p className="text-xs text-gray-400">{formatDate(entry.changed_at)}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
