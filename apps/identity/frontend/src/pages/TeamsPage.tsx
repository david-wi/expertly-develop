import { useEffect, useState } from 'react'
import { Modal, ModalFooter } from '@expertly/ui'
import { teamsApi, usersApi, Team, TeamDetail, TeamMember, User, getOrganizationId } from '../services/api'

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form data
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [selectedUserId, setSelectedUserId] = useState('')

  const orgId = getOrganizationId()

  useEffect(() => {
    if (orgId) {
      loadData()
    }
  }, [orgId])


  const loadData = async () => {
    setLoading(true)
    try {
      const [teamsData, usersData] = await Promise.all([
        teamsApi.list(),
        usersApi.list(),
      ])
      setTeams(teamsData)
      setUsers(usersData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTeamDetail = async (teamId: string) => {
    try {
      const detail = await teamsApi.get(teamId)
      setSelectedTeam(detail)
    } catch (error) {
      console.error('Failed to load team:', error)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setSaving(true)
    try {
      await teamsApi.create(formData.name.trim(), formData.description.trim() || undefined)
      await loadData()
      setShowCreateModal(false)
      setFormData({ name: '', description: '' })
    } catch (error) {
      console.error('Failed to create team:', error)
      alert('Failed to create team')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeam || !formData.name.trim()) return

    setSaving(true)
    try {
      await teamsApi.update(selectedTeam.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      })
      await loadData()
      setShowEditModal(false)
      setSelectedTeam(null)
    } catch (error) {
      console.error('Failed to update team:', error)
      alert('Failed to update team')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedTeam) return

    setSaving(true)
    try {
      await teamsApi.delete(selectedTeam.id)
      await loadData()
      setShowDeleteConfirm(false)
      setSelectedTeam(null)
    } catch (error) {
      console.error('Failed to delete team:', error)
      alert('Failed to delete team')
    } finally {
      setSaving(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeam || !selectedUserId) return

    setSaving(true)
    try {
      await teamsApi.addMember(selectedTeam.id, selectedUserId)
      await loadTeamDetail(selectedTeam.id)
      setShowAddMemberModal(false)
      setSelectedUserId('')
    } catch (error) {
      console.error('Failed to add member:', error)
      alert('Failed to add member')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeam) return

    try {
      await teamsApi.removeMember(selectedTeam.id, userId)
      await loadTeamDetail(selectedTeam.id)
    } catch (error) {
      console.error('Failed to remove member:', error)
      alert('Failed to remove member')
    }
  }

  const openEditModal = (team: Team) => {
    setFormData({ name: team.name, description: team.description || '' })
    loadTeamDetail(team.id).then(() => setShowEditModal(true))
  }

  const openTeamDetail = (team: Team) => {
    loadTeamDetail(team.id)
  }

  const getUserAvatar = (member: TeamMember) => {
    if (member.user_avatar_url) {
      return (
        <img
          src={member.user_avatar_url}
          alt={member.user_name}
          className="w-8 h-8 rounded-full object-cover"
        />
      )
    }
    const initials = member.user_name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    const bgColor = member.user_type === 'bot' ? 'bg-primary-500' : 'bg-blue-500'
    return (
      <div className={`w-8 h-8 rounded-full ${bgColor} flex items-center justify-center text-white text-xs font-medium`}>
        {initials}
      </div>
    )
  }

  const availableUsers = selectedTeam
    ? users.filter((u) => !selectedTeam.members.some((m) => m.user_id === u.id))
    : users

  if (!orgId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please select an organization first.</p>
        <a href="/organizations" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
          Go to Organizations
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Teams</h2>
        <button
          onClick={() => {
            setFormData({ name: '', description: '' })
            setShowCreateModal(true)
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors"
        >
          Create Team
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teams List */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8 text-gray-500 text-center">Loading...</div>
            ) : teams.length === 0 ? (
              <div className="p-8 text-gray-500 text-center">No teams yet.</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {teams.map((team) => (
                  <li
                    key={team.id}
                    onClick={() => openTeamDetail(team)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedTeam?.id === team.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{team.name}</p>
                        <p className="text-sm text-gray-500">{team.member_count} members</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Team Detail */}
        <div className="lg:col-span-2">
          {selectedTeam ? (
            <div className="bg-white shadow rounded-lg">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{selectedTeam.name}</h3>
                    {selectedTeam.description && (
                      <p className="text-gray-500 mt-1">{selectedTeam.description}</p>
                    )}
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={() => openEditModal(selectedTeam)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">Members ({selectedTeam.members.length})</h4>
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    + Add Member
                  </button>
                </div>

                {selectedTeam.members.length === 0 ? (
                  <p className="text-gray-500 text-sm">No members yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {selectedTeam.members.map((member) => (
                      <li key={member.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getUserAvatar(member)}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{member.user_name}</p>
                            <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              member.user_type === 'bot'
                                ? 'bg-primary-100 text-primary-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {member.user_type === 'bot' ? 'Bot' : 'Human'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(member.user_id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
              Select a team to view details
            </div>
          )}
        </div>
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create Team"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="e.g., Engineering"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
                placeholder="What does this team do?"
              />
            </div>
            <ModalFooter>
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
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Edit Team Modal */}
      {showEditModal && selectedTeam && (
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
              />
            </div>
            <ModalFooter>
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
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedTeam && (
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="Delete Team?"
          size="sm"
        >
          <p className="text-gray-500 mb-4">
            Are you sure you want to delete "{selectedTeam.name}"? This action cannot be undone.
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
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && selectedTeam && (
        <Modal
          isOpen={showAddMemberModal}
          onClose={() => {
            setShowAddMemberModal(false)
            setSelectedUserId('')
          }}
          title="Add Team Member"
        >
          <form onSubmit={handleAddMember} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                <option value="">Choose a user...</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.user_type === 'bot' ? 'Bot' : 'Human'})
                  </option>
                ))}
              </select>
            </div>
            <ModalFooter>
              <button
                type="button"
                onClick={() => {
                  setShowAddMemberModal(false)
                  setSelectedUserId('')
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !selectedUserId}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add'}
              </button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </div>
  )
}
