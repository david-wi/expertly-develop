import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Modal, ModalFooter, InlineVoiceTranscription } from '@expertly/ui'
import {
  usersApi,
  imagesApi,
  membershipsApi,
  User,
  UpdateUserRequest,
  UserOrganization,
  getOrganizationId,
} from '../services/api'

// Common feminine first names for gender detection
const FEMININE_NAMES = new Set([
  'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica',
  'sarah', 'karen', 'nancy', 'lisa', 'betty', 'margaret', 'sandra', 'ashley', 'kimberly',
  'emily', 'donna', 'michelle', 'dorothy', 'carol', 'amanda', 'melissa', 'deborah',
  'stephanie', 'rebecca', 'sharon', 'laura', 'cynthia', 'kathleen', 'amy', 'angela',
  'shirley', 'anna', 'brenda', 'pamela', 'emma', 'nicole', 'helen', 'samantha',
  'katherine', 'christine', 'debra', 'rachel', 'carolyn', 'janet', 'catherine',
  'maria', 'heather', 'diane', 'ruth', 'julie', 'olivia', 'joyce', 'virginia',
  'victoria', 'kelly', 'lauren', 'christina', 'joan', 'evelyn', 'judith', 'megan',
  'andrea', 'cheryl', 'hannah', 'jacqueline', 'martha', 'gloria', 'teresa', 'ann',
  'sara', 'madison', 'frances', 'kathryn', 'janice', 'jean', 'abigail', 'alice',
  'judy', 'sophia', 'grace', 'denise', 'amber', 'doris', 'marilyn', 'danielle',
  'beverly', 'isabella', 'theresa', 'diana', 'natalie', 'brittany', 'charlotte',
  'marie', 'kayla', 'alexis', 'lori', 'jane', 'claire', 'julia', 'elena', 'eva',
])

function getDefaultAppearanceDescription(name: string | undefined): string {
  if (!name) return 'Person with brown short hair'
  const firstName = name.split(' ')[0].toLowerCase()
  const isFeminine = FEMININE_NAMES.has(firstName)
  return isFeminine
    ? 'Woman with brown short hair'
    : 'Man with brown short hair'
}

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Form state
  const [formData, setFormData] = useState<UpdateUserRequest>({})

  // Avatar generation and upload
  const [generatingAvatar, setGeneratingAvatar] = useState(false)
  const [showAppearanceModal, setShowAppearanceModal] = useState(false)
  const [appearanceDescription, setAppearanceDescription] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Password change
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // API Key
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)

  // Organization memberships
  const [userOrgs, setUserOrgs] = useState<UserOrganization[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(false)

  // Expertly Admin toggle
  const [isExpertlyAdmin, setIsExpertlyAdmin] = useState(false)
  const [savingAdmin, setSavingAdmin] = useState(false)

  const orgId = getOrganizationId()

  useEffect(() => {
    if (userId && orgId) {
      loadUser()
    }
  }, [userId, orgId])

  const loadUser = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await usersApi.get(userId)
      setUser(data)
      setIsExpertlyAdmin(data.is_expertly_admin || false)
      setFormData({
        name: data.name,
        email: data.email || '',
        role: data.role,
        avatar_url: data.avatar_url || '',
        title: data.title || '',
        responsibilities: data.responsibilities || '',
        bot_config: data.bot_config || undefined,
      })
      // Load user's organization memberships
      loadUserOrgs(userId)
    } catch (error) {
      console.error('Failed to load user:', error)
      navigate('/users')
    } finally {
      setLoading(false)
    }
  }

  const loadUserOrgs = async (uid: string) => {
    setLoadingOrgs(true)
    try {
      const orgs = await membershipsApi.listUserOrgs(uid)
      setUserOrgs(orgs)
    } catch (error) {
      console.error('Failed to load user organizations:', error)
    } finally {
      setLoadingOrgs(false)
    }
  }

  const handleToggleExpertlyAdmin = async () => {
    if (!user) return
    setSavingAdmin(true)
    try {
      const newValue = !isExpertlyAdmin
      await usersApi.update(user.id, { is_expertly_admin: newValue })
      setIsExpertlyAdmin(newValue)
      setUser({ ...user, is_expertly_admin: newValue })
    } catch (error) {
      console.error('Failed to update Expertly Admin status:', error)
      alert('Failed to update Expertly Admin status')
    } finally {
      setSavingAdmin(false)
    }
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    try {
      const updateData: UpdateUserRequest = {
        name: formData.name?.trim(),
        email: formData.email?.trim() || undefined,
        role: formData.role,
        avatar_url: formData.avatar_url?.trim() || undefined,
        title: formData.title?.trim() || undefined,
        responsibilities: formData.responsibilities?.trim() || undefined,
        bot_config: user.user_type === 'bot' ? formData.bot_config : undefined,
      }
      const updated = await usersApi.update(user.id, updateData)
      setUser(updated)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update user:', error)
      alert(error instanceof Error ? error.message : 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!user) return

    setSaving(true)
    try {
      await usersApi.delete(user.id)
      navigate('/users')
    } catch (error) {
      console.error('Failed to delete user:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete user')
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerateApiKey = async () => {
    if (!user) return
    try {
      const result = await usersApi.regenerateApiKey(user.id)
      setNewApiKey(result.api_key)
      setShowApiKeyModal(true)
    } catch (error) {
      console.error('Failed to regenerate API key:', error)
      alert(error instanceof Error ? error.message : 'Failed to regenerate API key')
    }
  }

  const handleSetPassword = async () => {
    if (!user) return

    setPasswordError(null)

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }

    setChangingPassword(true)
    try {
      await usersApi.setPassword(user.id, newPassword)
      setPasswordSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      const detail = error.response?.data?.detail
      if (typeof detail === 'object' && detail.errors) {
        setPasswordError(detail.errors.join(', '))
      } else if (typeof detail === 'string') {
        setPasswordError(detail)
      } else {
        setPasswordError('Failed to set password')
      }
    } finally {
      setChangingPassword(false)
    }
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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB')
      return
    }

    setUploadingAvatar(true)
    try {
      // Convert to base64 data URL for preview and storage
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        // For now, use data URL directly - backend can be updated later to handle file uploads
        setFormData({ ...formData, avatar_url: dataUrl })
        setShowAppearanceModal(false)
        setUploadingAvatar(false)
      }
      reader.onerror = () => {
        alert('Failed to read image file')
        setUploadingAvatar(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Failed to upload image:', error)
      alert('Failed to upload image')
      setUploadingAvatar(false)
    }

    // Reset the input so the same file can be selected again
    event.target.value = ''
  }

  const openAppearanceModal = () => {
    // Set default appearance description based on name
    setAppearanceDescription(getDefaultAppearanceDescription(formData.name))
    setShowAppearanceModal(true)
  }

  const getUserAvatar = (size: 'sm' | 'lg' = 'lg') => {
    const sizeClasses = size === 'lg' ? 'w-24 h-24 text-2xl' : 'w-10 h-10 text-sm'
    const avatarUrl = isEditing ? formData.avatar_url : user?.avatar_url

    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={user?.name}
          className={`${sizeClasses} rounded-full object-cover`}
        />
      )
    }
    const initials = (user?.name || '')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    const bgColor = user?.user_type === 'bot' ? 'bg-primary-500' : 'bg-blue-500'
    return (
      <div className={`${sizeClasses} rounded-full ${bgColor} flex items-center justify-center text-white font-medium`}>
        {initials}
      </div>
    )
  }

  if (!orgId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please select an organization first.</p>
        <Link to="/organizations" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
          Go to Organizations
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">User not found.</p>
        <Link to="/users" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
          Back to Users
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/users"
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Profile' : 'User Profile'}
          </h2>
        </div>
        <div className="flex items-center space-x-3">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false)
                  setFormData({
                    name: user.name,
                    email: user.email || '',
                    role: user.role,
                    avatar_url: user.avatar_url || '',
                    title: user.title || '',
                    responsibilities: user.responsibilities || '',
                    bot_config: user.bot_config || undefined,
                  })
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Edit Profile
              </button>
              {!user.is_default && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-6">
          <div className="flex items-start space-x-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {getUserAvatar('lg')}
              {isEditing && (
                <div className="mt-3 space-y-2">
                  {user.user_type === 'bot' ? (
                    <button
                      type="button"
                      onClick={generateBotAvatar}
                      disabled={generatingAvatar || !formData.responsibilities?.trim()}
                      className="w-full px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs hover:bg-primary-200 transition-colors disabled:opacity-50"
                    >
                      {generatingAvatar ? 'Generating...' : 'Generate'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openAppearanceModal}
                      disabled={generatingAvatar || uploadingAvatar}
                      className="w-full px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors disabled:opacity-50"
                    >
                      {generatingAvatar || uploadingAvatar ? 'Processing...' : 'Change'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="space-y-4">
                  {/* Name & Email */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.name || ''}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                          required
                        />
                        <InlineVoiceTranscription
                          tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                          onTranscribe={(text) => setFormData({ ...formData, name: formData.name ? formData.name + ' ' + text : text })}
                          size="md"
                          className="self-center"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder={user.user_type === 'bot' ? 'Optional for bots' : 'user@example.com'}
                      />
                    </div>
                  </div>

                  {/* Title & Role */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.title || ''}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                          placeholder="e.g., Senior Developer"
                        />
                        <InlineVoiceTranscription
                          tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                          onTranscribe={(text) => setFormData({ ...formData, title: formData.title ? formData.title + ' ' + text : text })}
                          size="md"
                          className="self-center"
                        />
                      </div>
                    </div>
                    {user.user_type === 'human' && (
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
                    )}
                  </div>

                  {/* Responsibilities */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Responsibilities</label>
                    <div className="flex gap-2">
                      <textarea
                        value={formData.responsibilities || ''}
                        onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                        rows={2}
                        placeholder={user.user_type === 'bot' ? 'Describe what this bot does...' : 'Describe responsibilities...'}
                      />
                      <InlineVoiceTranscription
                        tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                        onTranscribe={(text) => setFormData({ ...formData, responsibilities: formData.responsibilities ? formData.responsibilities + ' ' + text : text })}
                        size="md"
                        className="self-start mt-1"
                      />
                    </div>
                  </div>

                  {/* Avatar URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Avatar URL</label>
                    <input
                      type="url"
                      value={formData.avatar_url || ''}
                      onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="Or paste avatar URL directly"
                    />
                  </div>

                  {/* Bot-specific config */}
                  {user.user_type === 'bot' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">What I can help with</label>
                      <div className="flex gap-2">
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
                          className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                          rows={2}
                          placeholder="e.g., LinkedIn posting, research, content writing..."
                        />
                        <InlineVoiceTranscription
                          tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                          onTranscribe={(text) =>
                            setFormData({
                              ...formData,
                              bot_config: {
                                ...formData.bot_config,
                                what_i_can_help_with: formData.bot_config?.what_i_can_help_with ? formData.bot_config.what_i_can_help_with + ' ' + text : text,
                              },
                            })
                          }
                          size="md"
                          className="self-start mt-1"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center space-x-3">
                    <h3 className="text-xl font-semibold text-gray-900">{user.name}</h3>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.user_type === 'bot'
                          ? 'bg-primary-100 text-primary-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {user.user_type === 'bot' ? 'Bot' : 'Human'}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {user.is_default && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Default
                      </span>
                    )}
                    {user.is_expertly_admin && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Expertly Admin
                      </span>
                    )}
                  </div>

                  {user.title && (
                    <p className="mt-1 text-gray-600">{user.title}</p>
                  )}

                  {user.email && (
                    <p className="mt-1 text-gray-500">{user.email}</p>
                  )}

                  {user.user_type === 'human' && (
                    <p className="mt-2 text-sm text-gray-500">
                      Role: <span className="capitalize font-medium">{user.role}</span>
                    </p>
                  )}

                  {user.responsibilities && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700">Responsibilities</h4>
                      <p className="mt-1 text-gray-600">{user.responsibilities}</p>
                    </div>
                  )}

                  {user.user_type === 'bot' && user.bot_config?.what_i_can_help_with && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700">What I can help with</h4>
                      <p className="mt-1 text-gray-600">{user.bot_config.what_i_can_help_with}</p>
                    </div>
                  )}

                  <div className="mt-4 text-sm text-gray-500">
                    <p>Created: {new Date(user.created_at).toLocaleDateString()}</p>
                    <p>Updated: {new Date(user.updated_at).toLocaleDateString()}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        {!isEditing && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRegenerateApiKey}
                className="text-gray-600 hover:text-gray-800 text-sm underline hover:no-underline"
              >
                Regenerate API Key
              </button>
              {user.user_type === 'human' && (
                <button
                  onClick={() => {
                    setShowPasswordModal(true)
                    setPasswordSuccess(false)
                    setPasswordError(null)
                    setNewPassword('')
                    setConfirmPassword('')
                  }}
                  className="text-gray-600 hover:text-gray-800 text-sm underline hover:no-underline"
                >
                  Set Password
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expertly Admin Section */}
      {user.user_type === 'human' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Expertly Admin Access</h3>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-700">Grant access to all organizations</p>
                <p className="text-sm text-gray-500 mt-1">
                  Expertly Admins can access and manage all organizations in the system.
                </p>
              </div>
              <button
                onClick={handleToggleExpertlyAdmin}
                disabled={savingAdmin}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  isExpertlyAdmin ? 'bg-purple-600' : 'bg-gray-200'
                } ${savingAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isExpertlyAdmin ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Organization Memberships Section */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Organization Memberships</h3>
        </div>
        <div className="p-6">
          {loadingOrgs ? (
            <p className="text-gray-500">Loading organizations...</p>
          ) : userOrgs.length === 0 ? (
            <p className="text-gray-500">
              No additional organization memberships.
              {user.is_expertly_admin && (
                <span className="block mt-1 text-sm">
                  As an Expertly Admin, this user has access to all organizations.
                </span>
              )}
            </p>
          ) : (
            <div className="space-y-3">
              {userOrgs.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{org.organization_name}</p>
                    <p className="text-sm text-gray-500">
                      {org.organization_slug} • {org.role}
                      {org.is_primary && ' • Primary'}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400">
                    Joined {new Date(org.joined_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title={`Delete ${user.user_type === 'bot' ? 'Bot' : 'User'}?`}
          size="sm"
        >
          <p className="text-gray-500 mb-4">
            Are you sure you want to delete "{user.name}"? This action cannot be undone.
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

      {/* API Key Modal */}
      {showApiKeyModal && newApiKey && (
        <Modal
          isOpen={showApiKeyModal}
          onClose={() => {
            setShowApiKeyModal(false)
            setNewApiKey(null)
          }}
          title="API Key"
        >
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
            }}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </Modal>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <Modal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          title="Set Password"
        >
          {passwordSuccess ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-600 mb-4">Password has been set successfully.</p>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-gray-500 mb-4">
                Set a new password for {user.name}.
              </p>
              {passwordError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                  {passwordError}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Enter new password"
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Confirm new password"
                    minLength={8}
                  />
                </div>
                <div className="text-xs text-gray-500">
                  Password must be at least 8 characters and meet complexity requirements.
                </div>
              </div>
              <ModalFooter>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetPassword}
                  disabled={changingPassword || !newPassword || !confirmPassword}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {changingPassword ? 'Setting...' : 'Set Password'}
                </button>
              </ModalFooter>
            </>
          )}
        </Modal>
      )}

      {/* Appearance Description Modal */}
      {showAppearanceModal && (
        <Modal
          isOpen={showAppearanceModal}
          onClose={() => {
            setShowAppearanceModal(false)
            setAppearanceDescription('')
          }}
          title="Customize Avatar"
        >
          {/* Hidden file input for uploads */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />

          {/* Upload option */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Upload an image</h4>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar || generatingAvatar}
              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
            >
              {uploadingAvatar ? 'Uploading...' : 'Click to upload image'}
            </button>
            <p className="text-xs text-gray-400 mt-1">Max 5MB, JPG/PNG/GIF</p>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 bg-white text-sm text-gray-400">or generate one</span>
            </div>
          </div>

          {/* Generation option */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Generate from description</h4>
            <p className="text-gray-500 mb-3 text-sm">
              Describe the appearance and we'll generate a stylized avatar illustration.
            </p>
            <div className="flex gap-2 mb-4">
              <textarea
                value={appearanceDescription}
                onChange={(e) => setAppearanceDescription(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                rows={3}
                placeholder="e.g., Woman with short brown hair and glasses, friendly smile, wearing a blue blazer"
              />
              <InlineVoiceTranscription
                tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                onTranscribe={(text) => setAppearanceDescription(appearanceDescription ? appearanceDescription + ' ' + text : text)}
                size="md"
                className="self-start mt-1"
              />
            </div>
          </div>

          <ModalFooter>
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
              disabled={generatingAvatar || uploadingAvatar || !appearanceDescription.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {generatingAvatar ? 'Generating...' : 'Generate Avatar'}
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  )
}
