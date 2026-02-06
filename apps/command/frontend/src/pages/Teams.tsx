import { useEffect, useState, useMemo } from 'react'
import { Modal, ModalFooter } from '@expertly/ui'
import { api, Team, User, CreateTeamRequest } from '../services/api'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState<CreateTeamRequest>({
    name: '',
    description: '',
    member_ids: [],
    lead_id: undefined,
  })

  // Track unsaved changes for create modal
  const hasCreateChanges = useMemo(() => {
    if (!showCreateModal) return false
    return formData.name.trim() !== '' || (formData.description?.trim() || '') !== ''
  }, [showCreateModal, formData.name, formData.description])

  // Track unsaved changes for edit modal
  const hasEditChanges = useMemo(() => {
    if (!showEditModal || !selectedTeam) return false
    return formData.name !== selectedTeam.name ||
           (formData.description || '') !== (selectedTeam.description || '') ||
           formData.lead_id !== selectedTeam.lead_id
  }, [showEditModal, selectedTeam, formData.name, formData.description, formData.lead_id])

  const hasUnsavedChanges = hasCreateChanges || hasEditChanges
  const { confirmClose } = useUnsavedChanges(hasUnsavedChanges)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [teamsData, usersData] = await Promise.all([api.getTeams(), api.getUsers()])
      setTeams(teamsData)
      setUsers(usersData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setSaving(true)
    try {
      await api.createTeam({
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        member_ids: formData.member_ids,
        lead_id: formData.lead_id || undefined,
      })
      await loadData()
      setShowCreateModal(false)
      resetForm()
    } catch (error) {
      console.error('Failed to create team:', error)
      alert(error instanceof Error ? error.message : 'Failed to create team')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeam) return

    const teamId = selectedTeam._id || selectedTeam.id
    setSaving(true)
    try {
      await api.updateTeam(teamId, {
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        lead_id: formData.lead_id || undefined,
      })
      await loadData()
      setShowEditModal(false)
      setSelectedTeam(null)
    } catch (error) {
      console.error('Failed to update team:', error)
      alert(error instanceof Error ? error.message : 'Failed to update team')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedTeam) return

    const teamId = selectedTeam._id || selectedTeam.id
    setSaving(true)
    try {
      await api.deleteTeam(teamId)
      await loadData()
      setShowDeleteConfirm(false)
      setSelectedTeam(null)
    } catch (error) {
      console.error('Failed to delete team:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete team')
    } finally {
      setSaving(false)
    }
  }

  const handleAddMember = async (userId: string) => {
    if (!selectedTeam) return

    const teamId = selectedTeam._id || selectedTeam.id
    try {
      const updatedTeam = await api.addTeamMember(teamId, userId)
      setTeams(teams.map((t) => ((t._id || t.id) === teamId ? updatedTeam : t)))
      setSelectedTeam(updatedTeam)
    } catch (error) {
      console.error('Failed to add member:', error)
      alert(error instanceof Error ? error.message : 'Failed to add member')
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeam) return

    const teamId = selectedTeam._id || selectedTeam.id
    try {
      const updatedTeam = await api.removeTeamMember(teamId, userId)
      setTeams(teams.map((t) => ((t._id || t.id) === teamId ? updatedTeam : t)))
      setSelectedTeam(updatedTeam)
    } catch (error) {
      console.error('Failed to remove member:', error)
      alert(error instanceof Error ? error.message : 'Failed to remove member')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      member_ids: [],
      lead_id: undefined,
    })
  }

  const openEditModal = (team: Team) => {
    setSelectedTeam(team)
    setFormData({
      name: team.name,
      description: team.description || '',
      member_ids: team.member_ids,
      lead_id: team.lead_id,
    })
    setShowEditModal(true)
  }

  const openMembersModal = (team: Team) => {
    setSelectedTeam(team)
    setShowMembersModal(true)
  }

  const openDeleteConfirm = (team: Team) => {
    setSelectedTeam(team)
    setShowDeleteConfirm(true)
  }

  const getUserById = (id: string): User | undefined => {
    return users.find((u) => (u._id || u.id) === id)
  }

  const getTeamMembers = (team: Team): User[] => {
    return team.member_ids.map((id) => getUserById(id)).filter((u): u is User => u !== undefined)
  }

  const getNonMembers = (team: Team): User[] => {
    return users.filter((u) => !team.member_ids.includes(u._id || u.id))
  }

  const getUserAvatar = (user: User, size = 'sm') => {
    const sizeClass = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'
    if (user.avatar_url) {
      return (
        <img
          src={user.avatar_url}
          alt={user.name}
          className={`${sizeClass} rounded-full object-cover`}
        />
      )
    }
    const initials = user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    const bgColor = user.user_type === 'virtual' ? 'bg-primary-500' : 'bg-blue-500'
    return (
      <div
        className={`${sizeClass} rounded-full ${bgColor} flex items-center justify-center text-white font-medium`}
      >
        {initials}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--theme-text-heading)]">Teams</h2>
        <button
          onClick={() => {
            resetForm()
            setShowCreateModal(true)
          }}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 transition-colors"
        >
          New Team
        </button>
      </div>

      {/* Teams List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lead
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Members
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teams.map((team) => {
                const teamId = team._id || team.id
                const lead = team.lead_id ? getUserById(team.lead_id) : null
                const members = getTeamMembers(team)

                return (
                  <tr key={teamId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{team.name}</p>
                        {team.description && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">{team.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {lead ? (
                        <div className="flex items-center space-x-2">
                          {getUserAvatar(lead)}
                          <span className="text-sm text-gray-700">{lead.name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No lead</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="flex -space-x-2">
                          {members.slice(0, 5).map((member) => (
                            <div
                              key={member._id || member.id}
                              className="ring-2 ring-white rounded-full"
                              title={member.name}
                            >
                              {getUserAvatar(member)}
                            </div>
                          ))}
                        </div>
                        {members.length > 5 && (
                          <span className="ml-2 text-xs text-gray-500">+{members.length - 5}</span>
                        )}
                        {members.length === 0 && (
                          <span className="text-sm text-gray-400">No members</span>
                        )}
                        <button
                          onClick={() => openMembersModal(team)}
                          className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                        >
                          Manage
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditModal(team)}
                        className="text-blue-600 hover:text-blue-800 text-sm mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(team)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
              {teams.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No teams found. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Team Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={confirmClose(() => setShowCreateModal(false))}
        title="Create New Team"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g., Marketing Team"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (responsibilities)
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
              placeholder="Describe the team's responsibilities..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Lead</label>
            <select
              value={formData.lead_id || ''}
              onChange={(e) => setFormData({ ...formData, lead_id: e.target.value || undefined })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">No lead</option>
              {users.map((user) => (
                <option key={user._id || user.id} value={user._id || user.id}>
                  {user.name} ({user.user_type === 'virtual' ? 'Bot' : 'Human'})
                </option>
              ))}
            </select>
          </div>
          <ModalFooter>
            <button
              type="button"
              onClick={confirmClose(() => setShowCreateModal(false))}
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
          </ModalFooter>
        </form>
      </Modal>

      {/* Edit Team Modal */}
      <Modal
        isOpen={showEditModal && !!selectedTeam}
        onClose={confirmClose(() => setShowEditModal(false))}
        title="Edit Team"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
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
              Description (responsibilities)
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Lead</label>
            <select
              value={formData.lead_id || ''}
              onChange={(e) => setFormData({ ...formData, lead_id: e.target.value || undefined })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">No lead</option>
              {users.map((user) => (
                <option key={user._id || user.id} value={user._id || user.id}>
                  {user.name} ({user.user_type === 'virtual' ? 'Bot' : 'Human'})
                </option>
              ))}
            </select>
          </div>
          <ModalFooter>
            <button
              type="button"
              onClick={confirmClose(() => setShowEditModal(false))}
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
          </ModalFooter>
        </form>
      </Modal>

      {/* Manage Members Modal */}
      <Modal
        isOpen={showMembersModal && !!selectedTeam}
        onClose={() => {
          setShowMembersModal(false)
          setSelectedTeam(null)
        }}
        title={`Manage Members - ${selectedTeam?.name || ''}`}
        size="lg"
      >
        {/* Current Members */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Current Members ({selectedTeam ? getTeamMembers(selectedTeam).length : 0})
          </h4>
          <div className="space-y-2">
            {selectedTeam && getTeamMembers(selectedTeam).map((member) => (
              <div
                key={member._id || member.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
              >
                <div className="flex items-center space-x-2">
                  {getUserAvatar(member, 'md')}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.name}</p>
                    <p className="text-xs text-gray-500">
                      {member.user_type === 'virtual' ? 'Bot' : 'Human'} - {member.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveMember(member._id || member.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
            {selectedTeam && getTeamMembers(selectedTeam).length === 0 && (
              <p className="text-sm text-gray-500 py-2">No members yet.</p>
            )}
          </div>
        </div>

        {/* Add Members */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Add Members</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedTeam && getNonMembers(selectedTeam).map((user) => (
              <div
                key={user._id || user.id}
                className="flex items-center justify-between p-2 border rounded-md hover:bg-gray-50"
              >
                <div className="flex items-center space-x-2">
                  {getUserAvatar(user, 'md')}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">
                      {user.user_type === 'virtual' ? 'Bot' : 'Human'} - {user.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleAddMember(user._id || user.id)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Add
                </button>
              </div>
            ))}
            {selectedTeam && getNonMembers(selectedTeam).length === 0 && (
              <p className="text-sm text-gray-500 py-2">All users are already members.</p>
            )}
          </div>
        </div>

        <ModalFooter>
          <button
            onClick={() => {
              setShowMembersModal(false)
              setSelectedTeam(null)
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Done
          </button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm && !!selectedTeam}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Team?"
        size="sm"
      >
        <p className="text-gray-500 mb-4">
          Are you sure you want to delete "{selectedTeam?.name}"? This action cannot be undone.
        </p>
        <ModalFooter>
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
        </ModalFooter>
      </Modal>
    </div>
  )
}
