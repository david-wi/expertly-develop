import { useEffect, useState } from 'react'
import {
  usersApi,
  imagesApi,
  User,
  CreateUserRequest,
  UpdateUserRequest,
  getOrganizationId,
} from '../services/api'

type UserFilter = 'all' | 'human' | 'bot'

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<UserFilter>('all')

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Avatar generation
  const [generatingAvatar, setGeneratingAvatar] = useState(false)
  const [showAppearanceModal, setShowAppearanceModal] = useState(false)
  const [appearanceDescription, setAppearanceDescription] = useState('')

  // Advanced section toggle for bots
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Form state
  const [formData, setFormData] = useState<CreateUserRequest>({
    name: '',
    email: '',
    user_type: 'human',
    role: 'member',
    avatar_url: '',
    title: '',
    responsibilities: '',
    bot_config: undefined,
  })

  const orgId = getOrganizationId()

  useEffect(() => {
    if (orgId) {
      loadUsers()
    }
  }, [filter, orgId])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const userType = filter === 'all' ? undefined : filter
      const data = await usersApi.list(userType)
      setUsers(data)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setSaving(true)
    try {
      const result = await usersApi.create({
        ...formData,
        name: formData.name.trim(),
        email: formData.email?.trim() || undefined,
        avatar_url: formData.avatar_url?.trim() || undefined,
        title: formData.title?.trim() || undefined,
        responsibilities: formData.responsibilities?.trim() || undefined,
        bot_config: formData.user_type === 'bot' ? formData.bot_config : undefined,
      })
      setNewApiKey(result.api_key)
      setShowCreateModal(false)
      setShowApiKeyModal(true)
      await loadUsers()
      resetForm()
    } catch (error) {
      console.error('Failed to create user:', error)
      alert(error instanceof Error ? error.message : 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    setSaving(true)
    try {
      const updateData: UpdateUserRequest = {
        name: formData.name.trim(),
        email: formData.email?.trim() || undefined,
        role: formData.role,
        avatar_url: formData.avatar_url?.trim() || undefined,
        title: formData.title?.trim() || undefined,
        responsibilities: formData.responsibilities?.trim() || undefined,
        bot_config: selectedUser.user_type === 'bot' ? formData.bot_config : undefined,
      }
      await usersApi.update(selectedUser.id, updateData)
      await loadUsers()
      setShowEditModal(false)
      setSelectedUser(null)
    } catch (error) {
      console.error('Failed to update user:', error)
      alert(error instanceof Error ? error.message : 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedUser) return

    setSaving(true)
    try {
      await usersApi.delete(selectedUser.id)
      await loadUsers()
      setShowDeleteConfirm(false)
      setSelectedUser(null)
    } catch (error) {
      console.error('Failed to delete user:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete user')
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerateApiKey = async (user: User) => {
    try {
      const result = await usersApi.regenerateApiKey(user.id)
      setNewApiKey(result.api_key)
      setSelectedUser(user)
      setShowApiKeyModal(true)
    } catch (error) {
      console.error('Failed to regenerate API key:', error)
      alert(error instanceof Error ? error.message : 'Failed to regenerate API key')
    }
  }

  const resetForm = (userType: 'human' | 'bot' = 'human') => {
    setFormData({
      name: '',
      email: '',
      user_type: userType,
      role: 'member',
      avatar_url: '',
      title: '',
      responsibilities: '',
      bot_config: userType === 'bot' ? {} : undefined,
    })
    setShowAdvanced(false)
  }

  const generateBotAvatar = async () => {
    if (!formData.responsibilities?.trim()) {
      alert('Please enter responsibilities first to generate an avatar')
      return
    }
    setGeneratingAvatar(true)
    try {
      const result = await imagesApi.generateAvatar('bot', formData.responsibilities, formData.name)
      setFormData({ ...formData, avatar_url: result.url })
    } catch (error) {
      console.error('Failed to generate avatar:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate avatar')
    } finally {
      setGeneratingAvatar(false)
    }
  }

  const generateHumanAvatar = async () => {
    if (!appearanceDescription.trim()) {
      alert('Please describe your appearance')
      return
    }
    setGeneratingAvatar(true)
    try {
      const result = await imagesApi.generateAvatar('human', appearanceDescription, formData.name)
      setFormData({ ...formData, avatar_url: result.url })
      setShowAppearanceModal(false)
      setAppearanceDescription('')
    } catch (error) {
      console.error('Failed to generate avatar:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate avatar')
    } finally {
      setGeneratingAvatar(false)
    }
  }

  const openEditModal = (user: User) => {
    setSelectedUser(user)
    setFormData({
      name: user.name,
      email: user.email || '',
      user_type: user.user_type,
      role: user.role,
      avatar_url: user.avatar_url || '',
      title: user.title || '',
      responsibilities: user.responsibilities || '',
      bot_config: user.bot_config || undefined,
    })
    setShowAdvanced(false)
    setShowEditModal(true)
  }

  const openDeleteConfirm = (user: User) => {
    setSelectedUser(user)
    setShowDeleteConfirm(true)
  }

  const getUserAvatar = (user: User) => {
    if (user.avatar_url) {
      return (
        <img
          src={user.avatar_url}
          alt={user.name}
          className="w-10 h-10 rounded-full object-cover"
        />
      )
    }
    const initials = user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    const bgColor = user.user_type === 'bot' ? 'bg-purple-500' : 'bg-blue-500'
    return (
      <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center text-white text-sm font-medium`}>
        {initials}
      </div>
    )
  }

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
        <h2 className="text-2xl font-bold text-gray-900">Users & Bots</h2>
        <div className="flex items-center space-x-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as UserFilter)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="human">Humans</option>
            <option value="bot">Bots</option>
          </select>
          <button
            onClick={() => {
              resetForm('human')
              setShowCreateModal(true)
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors"
          >
            Add User
          </button>
          <button
            onClick={() => {
              resetForm('bot')
              setShowCreateModal(true)
            }}
            className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm hover:bg-purple-700 transition-colors"
          >
            Add Bot
          </button>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-gray-500 text-center">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      {getUserAvatar(user)}
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        {user.email && <p className="text-sm text-gray-500">{user.email}</p>}
                        {user.title && <p className="text-xs text-gray-400">{user.title}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.user_type === 'bot'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {user.user_type === 'bot' ? 'Bot' : 'Human'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-700 capitalize">{user.role}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleRegenerateApiKey(user)}
                      className="text-gray-600 hover:text-gray-800 text-sm"
                    >
                      Key
                    </button>
                    <button
                      onClick={() => openEditModal(user)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </button>
                    {!user.is_default && (
                      <button
                        onClick={() => openDeleteConfirm(user)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {showEditModal ? 'Edit User' : `Add New ${formData.user_type === 'bot' ? 'Bot' : 'User'}`}
            </h3>
            <form onSubmit={showEditModal ? handleEdit : handleCreate} className="space-y-4">
              {/* Type toggle (only for create) */}
              {!showEditModal && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <div className="flex rounded-md overflow-hidden border border-gray-300">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, user_type: 'human', bot_config: undefined })}
                      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                        formData.user_type === 'human'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      User
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, user_type: 'bot', bot_config: {} })}
                      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                        formData.user_type === 'bot'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Bot
                    </button>
                  </div>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder={formData.user_type === 'bot' ? 'e.g., Research Bot' : 'e.g., John Smith'}
                  required
                />
              </div>

              {/* Email (shown for humans, under Advanced for bots) */}
              {formData.user_type === 'human' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="user@example.com"
                  />
                </div>
              )}

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'owner' | 'admin' | 'member' })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Senior Developer"
                />
              </div>

              {/* Responsibilities */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.user_type === 'bot' ? 'Responsibilities' : 'Responsibilities (optional)'}
                </label>
                <textarea
                  value={formData.responsibilities || ''}
                  onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                  placeholder={formData.user_type === 'bot'
                    ? 'Describe what this bot does...'
                    : 'Describe their responsibilities...'}
                />
              </div>

              {/* Avatar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Avatar</label>
                <div className="space-y-2">
                  {formData.avatar_url && (
                    <div className="flex items-center space-x-3">
                      <img
                        src={formData.avatar_url}
                        alt="Avatar preview"
                        className="w-16 h-16 rounded-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, avatar_url: '' })}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {formData.user_type === 'bot' ? (
                    <button
                      type="button"
                      onClick={generateBotAvatar}
                      disabled={generatingAvatar || !formData.responsibilities?.trim()}
                      className="w-full px-3 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors disabled:opacity-50 text-sm"
                    >
                      {generatingAvatar ? 'Generating...' : 'Generate Avatar from Responsibilities'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAppearanceModal(true)}
                      disabled={generatingAvatar}
                      className="w-full px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors disabled:opacity-50 text-sm"
                    >
                      {generatingAvatar ? 'Generating...' : 'Describe Appearance to Generate Avatar'}
                    </button>
                  )}
                  <input
                    type="url"
                    value={formData.avatar_url || ''}
                    onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Or paste avatar URL directly"
                  />
                </div>
              </div>

              {/* Bot-specific config */}
              {(formData.user_type === 'bot' || selectedUser?.user_type === 'bot') && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Bot Configuration</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      What I can help with
                    </label>
                    <textarea
                      value={formData.bot_config?.what_i_can_help_with || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bot_config: {
                            ...formData.bot_config,
                            what_i_can_help_with: e.target.value,
                          },
                        })
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      rows={3}
                      placeholder="e.g., LinkedIn posting, research, content writing..."
                    />
                  </div>
                </div>
              )}

              {/* Advanced section for bots */}
              {formData.user_type === 'bot' && (
                <div className="border-t pt-4 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    {showAdvanced ? '− Hide' : '+ Show'} Advanced
                  </button>
                  {showAdvanced && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email (optional)
                      </label>
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="bot@example.com"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setShowEditModal(false)
                    setSelectedUser(null)
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : showEditModal ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete {selectedUser.user_type === 'bot' ? 'Bot' : 'User'}?</h3>
            <p className="text-gray-500 mb-4">
              Are you sure you want to delete "{selectedUser.name}"? This action cannot be undone.
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

      {/* API Key Modal */}
      {showApiKeyModal && newApiKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">API Key</h3>
            <p className="text-gray-500 mb-4">
              Save this API key now. You won't be able to see it again.
            </p>
            <div className="bg-gray-100 rounded-md p-3 font-mono text-sm break-all mb-4">
              {newApiKey}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newApiKey)
                alert('Copied to clipboard!')
              }}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors mb-3"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={() => {
                setShowApiKeyModal(false)
                setNewApiKey(null)
                setSelectedUser(null)
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Appearance Description Modal */}
      {showAppearanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Describe Your Appearance</h3>
            <p className="text-gray-500 mb-4 text-sm">
              Describe what you look like and we'll generate a stylized avatar illustration.
            </p>
            <textarea
              value={appearanceDescription}
              onChange={(e) => setAppearanceDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4"
              rows={4}
              placeholder="e.g., Woman with short brown hair and glasses, friendly smile, wearing a blue blazer"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAppearanceModal(false)
                  setAppearanceDescription('')
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={generateHumanAvatar}
                disabled={generatingAvatar || !appearanceDescription.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {generatingAvatar ? 'Generating...' : 'Generate Avatar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
