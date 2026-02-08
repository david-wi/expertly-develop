import { useEffect, useState } from 'react'
import {
  Shield,
  Plus,
  Edit3,
  Trash2,
  Loader2,
  Check,
  X,
  Users,
  Lock,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Search,
} from 'lucide-react'

// ============================================================================
// Types (local to this page)
// ============================================================================

interface RoleData {
  id: string
  name: string
  description?: string
  permissions: string[]
  is_system_role: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

interface PermissionGroup {
  resource: string
  permissions: string[]
}

interface UserWithRoles {
  user_id: string
  roles: {
    assignment_id: string
    role_id: string
    role_name: string
    assigned_by?: string
    assigned_at?: string
  }[]
}

type TabId = 'roles' | 'users' | 'permissions'

// ============================================================================
// Constants
// ============================================================================

const RESOURCE_LABELS: Record<string, string> = {
  shipments: 'Shipments',
  quotes: 'Quotes',
  carriers: 'Carriers',
  customers: 'Customers',
  invoices: 'Invoices',
  billing: 'Billing',
  communications: 'Communications',
  documents: 'Documents',
  analytics: 'Analytics',
  admin: 'Administration',
}

const RESOURCE_COLORS: Record<string, string> = {
  shipments: 'bg-blue-100 text-blue-700',
  quotes: 'bg-purple-100 text-purple-700',
  carriers: 'bg-orange-100 text-orange-700',
  customers: 'bg-teal-100 text-teal-700',
  invoices: 'bg-green-100 text-green-700',
  billing: 'bg-emerald-100 text-emerald-700',
  communications: 'bg-indigo-100 text-indigo-700',
  documents: 'bg-yellow-100 text-yellow-700',
  analytics: 'bg-pink-100 text-pink-700',
  admin: 'bg-red-100 text-red-700',
}

// ============================================================================
// Local API helpers (to be merged into services/api.ts)
// ============================================================================

import { httpErrorMessage } from '../utils/httpErrors'

const API_BASE = import.meta.env.VITE_API_URL || ''

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || httpErrorMessage(response.status))
  }
  return response.json()
}

const rbacApi = {
  getRoles: (params?: { is_active?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active))
    const query = searchParams.toString()
    return apiRequest<RoleData[]>(`/api/v1/rbac/roles${query ? `?${query}` : ''}`)
  },
  getRole: (id: string) => apiRequest<RoleData>(`/api/v1/rbac/roles/${id}`),
  createRole: (data: { name: string; description?: string; permissions: string[] }) =>
    apiRequest<RoleData>('/api/v1/rbac/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, data: { name?: string; description?: string; permissions?: string[]; is_active?: boolean }) =>
    apiRequest<RoleData>(`/api/v1/rbac/roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRole: (id: string) =>
    apiRequest<{ status: string }>(`/api/v1/rbac/roles/${id}`, { method: 'DELETE' }),
  assignRole: (data: { user_id: string; role_id: string; assigned_by?: string }) =>
    apiRequest<unknown>('/api/v1/rbac/assign', { method: 'POST', body: JSON.stringify(data) }),
  removeRole: (data: { user_id: string; role_id: string }) =>
    apiRequest<unknown>('/api/v1/rbac/remove', { method: 'POST', body: JSON.stringify(data) }),
  getUsersWithRoles: () =>
    apiRequest<UserWithRoles[]>('/api/v1/rbac/users'),
  getPermissionGroups: () =>
    apiRequest<PermissionGroup[]>('/api/v1/rbac/permissions'),
}

// ============================================================================
// Component
// ============================================================================

export default function RoleManagement() {
  const [activeTab, setActiveTab] = useState<TabId>('roles')
  const [loading, setLoading] = useState(true)

  // Roles
  const [roles, setRoles] = useState<RoleData[]>([])
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([])
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleData | null>(null)
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  })

  // Users
  const [usersWithRoles, setUsersWithRoles] = useState<UserWithRoles[]>([])
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignForm, setAssignForm] = useState({
    user_id: '',
    role_id: '',
  })

  // Permission matrix
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set())
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<string | null>(null)

  // Search
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [rolesData, permsData] = await Promise.all([
        rbacApi.getRoles(),
        rbacApi.getPermissionGroups(),
      ])
      setRoles(rolesData)
      setPermissionGroups(permsData)

      if (activeTab === 'users') {
        const usersData = await rbacApi.getUsersWithRoles()
        setUsersWithRoles(usersData)
      }
    } catch (error) {
      console.error('Failed to fetch RBAC data:', error)
    } finally {
      setLoading(false)
    }
  }

  // ---- Role CRUD ----

  const openRoleModal = (role?: RoleData) => {
    if (role) {
      setEditingRole(role)
      setRoleForm({
        name: role.name,
        description: role.description || '',
        permissions: [...role.permissions],
      })
    } else {
      setEditingRole(null)
      setRoleForm({ name: '', description: '', permissions: [] })
    }
    setShowRoleModal(true)
  }

  const saveRole = async () => {
    try {
      if (editingRole) {
        await rbacApi.updateRole(editingRole.id, {
          name: roleForm.name,
          description: roleForm.description || undefined,
          permissions: roleForm.permissions,
        })
      } else {
        await rbacApi.createRole({
          name: roleForm.name,
          description: roleForm.description || undefined,
          permissions: roleForm.permissions,
        })
      }
      setShowRoleModal(false)
      await fetchData()
    } catch (error: any) {
      alert(error.message || 'Failed to save role')
    }
  }

  const deleteRole = async (id: string) => {
    if (!confirm('Delete this role? All user assignments will be removed.')) return
    try {
      await rbacApi.deleteRole(id)
      await fetchData()
    } catch (error: any) {
      alert(error.message || 'Cannot delete this role')
    }
  }

  // ---- Permission Helpers ----

  const togglePermission = (perm: string) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }))
  }

  const toggleResourcePermissions = (resource: string) => {
    const group = permissionGroups.find((g) => g.resource === resource)
    if (!group) return

    const allSelected = group.permissions.every((p) => roleForm.permissions.includes(p))
    if (allSelected) {
      setRoleForm((prev) => ({
        ...prev,
        permissions: prev.permissions.filter((p) => !group.permissions.includes(p)),
      }))
    } else {
      setRoleForm((prev) => ({
        ...prev,
        permissions: [
          ...new Set([...prev.permissions, ...group.permissions]),
        ],
      }))
    }
  }

  const toggleExpandResource = (resource: string) => {
    setExpandedResources((prev) => {
      const next = new Set(prev)
      if (next.has(resource)) {
        next.delete(resource)
      } else {
        next.add(resource)
      }
      return next
    })
  }

  // ---- User Assignment ----

  const assignRole = async () => {
    if (!assignForm.user_id || !assignForm.role_id) return
    try {
      await rbacApi.assignRole({
        user_id: assignForm.user_id,
        role_id: assignForm.role_id,
      })
      setShowAssignModal(false)
      setAssignForm({ user_id: '', role_id: '' })
      await fetchData()
    } catch (error: any) {
      alert(error.message || 'Failed to assign role')
    }
  }

  const removeRoleAssignment = async (userId: string, roleId: string) => {
    if (!confirm('Remove this role from the user?')) return
    try {
      await rbacApi.removeRole({ user_id: userId, role_id: roleId })
      await fetchData()
    } catch (error) {
      console.error('Failed to remove role:', error)
    }
  }

  // ---- Format Helpers ----

  const formatPermName = (perm: string) => {
    const parts = perm.split('.')
    return parts[1]
      ? parts[1]
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : perm
  }

  const filteredUsers = userSearch
    ? usersWithRoles.filter(
        (u) =>
          u.user_id.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.roles.some((r) => r.role_name.toLowerCase().includes(userSearch.toLowerCase()))
      )
    : usersWithRoles

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-7 w-7 text-violet-600" />
            Role Management
          </h1>
          <p className="text-gray-500">
            Manage roles, permissions, and user access control
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(
          [
            { id: 'roles' as TabId, label: 'Roles', icon: Shield },
            { id: 'users' as TabId, label: 'User Assignments', icon: Users },
            { id: 'permissions' as TabId, label: 'Permissions', icon: Lock },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">Loading...</p>
        </div>
      ) : (
        <>
          {/* ======== Roles Tab ======== */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => openRoleModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
                >
                  <Plus className="h-4 w-4" />
                  New Role
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className="bg-white rounded-xl border border-gray-200 p-5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{role.name}</h3>
                          {role.is_system_role && (
                            <span className="text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">
                              System
                            </span>
                          )}
                          {!role.is_active && (
                            <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-600">
                              Inactive
                            </span>
                          )}
                        </div>
                        {role.description && (
                          <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openRoleModal(role)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                          title="Edit"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        {!role.is_system_role && (
                          <button
                            onClick={() => deleteRole(role.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Permission summary */}
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {/* Group by resource for display */}
                        {permissionGroups.map((group) => {
                          const count = group.permissions.filter((p) =>
                            role.permissions.includes(p)
                          ).length
                          if (count === 0) return null
                          const total = group.permissions.length
                          return (
                            <span
                              key={group.resource}
                              className={`text-xs px-2 py-0.5 rounded font-medium ${
                                RESOURCE_COLORS[group.resource] || 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {RESOURCE_LABELS[group.resource] || group.resource}{' '}
                              ({count}/{total})
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======== User Assignments Tab ======== */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users..."
                    className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 w-64"
                  />
                </div>
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
                >
                  <UserPlus className="h-4 w-4" />
                  Assign Role
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200">
                {filteredUsers.length === 0 ? (
                  <div className="p-12 text-center">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-900 font-medium">No user role assignments</p>
                    <p className="text-gray-500 mt-1">
                      Assign roles to users to control their access
                    </p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">User ID</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Roles</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredUsers.map((user) => (
                        <tr key={user.user_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{user.user_id}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {user.roles.map((role) => (
                                <span
                                  key={role.assignment_id}
                                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-violet-100 text-violet-700 font-medium"
                                >
                                  <Shield className="h-3 w-3" />
                                  {role.role_name}
                                  <button
                                    onClick={() =>
                                      removeRoleAssignment(user.user_id, role.role_id)
                                    }
                                    className="ml-1 hover:text-red-600"
                                    title="Remove role"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs text-gray-400">
                              {user.roles.length} role{user.roles.length !== 1 ? 's' : ''}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ======== Permissions Tab ======== */}
          {activeTab === 'permissions' && (
            <div className="space-y-4">
              {/* Role selector for matrix view */}
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">View permissions for:</label>
                <select
                  value={selectedRoleForMatrix || ''}
                  onChange={(e) => setSelectedRoleForMatrix(e.target.value || null)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">All permissions</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Permission Matrix */}
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
                {permissionGroups.map((group) => {
                  const isExpanded = expandedResources.has(group.resource)
                  const selectedRole = roles.find((r) => r.id === selectedRoleForMatrix)
                  const rolePerms = selectedRole?.permissions || []

                  const matchCount = selectedRoleForMatrix
                    ? group.permissions.filter((p) => rolePerms.includes(p)).length
                    : group.permissions.length

                  return (
                    <div key={group.resource}>
                      <button
                        onClick={() => toggleExpandResource(group.resource)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-medium ${
                              RESOURCE_COLORS[group.resource] || 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {RESOURCE_LABELS[group.resource] || group.resource}
                          </span>
                          <span className="text-sm text-gray-600">
                            {group.permissions.length} permission{group.permissions.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {selectedRoleForMatrix && (
                          <span className="text-sm text-gray-500">
                            {matchCount}/{group.permissions.length} granted
                          </span>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="px-8 pb-4">
                          {selectedRoleForMatrix ? (
                            // Show permissions with check/x for selected role
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {group.permissions.map((perm) => {
                                const hasIt = rolePerms.includes(perm)
                                return (
                                  <div
                                    key={perm}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                                      hasIt
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-gray-50 text-gray-400'
                                    }`}
                                  >
                                    {hasIt ? (
                                      <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <X className="h-4 w-4 text-gray-300" />
                                    )}
                                    {formatPermName(perm)}
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            // Show all permissions and which roles have them
                            <div className="space-y-2">
                              {group.permissions.map((perm) => (
                                <div key={perm} className="flex items-center justify-between py-1">
                                  <span className="text-sm text-gray-700 font-mono">
                                    {perm}
                                  </span>
                                  <div className="flex gap-1">
                                    {roles
                                      .filter((r) => r.permissions.includes(perm))
                                      .map((r) => (
                                        <span
                                          key={r.id}
                                          className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700"
                                        >
                                          {r.name}
                                        </span>
                                      ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ======== Role Create/Edit Modal ======== */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingRole ? 'Edit Role' : 'New Role'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  placeholder="e.g. Senior Dispatcher"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500"
                  disabled={editingRole?.is_system_role}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  placeholder="What this role is for..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permissions ({roleForm.permissions.length} selected)
                </label>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-96 overflow-y-auto">
                  {permissionGroups.map((group) => {
                    const allSelected = group.permissions.every((p) =>
                      roleForm.permissions.includes(p)
                    )
                    const someSelected =
                      !allSelected &&
                      group.permissions.some((p) => roleForm.permissions.includes(p))

                    return (
                      <div key={group.resource} className="py-3 px-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = someSelected
                              }}
                              onChange={() => toggleResourcePermissions(group.resource)}
                              className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                            />
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-medium ${
                                RESOURCE_COLORS[group.resource] || 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {RESOURCE_LABELS[group.resource] || group.resource}
                            </span>
                          </label>
                          <span className="text-xs text-gray-400">
                            {group.permissions.filter((p) => roleForm.permissions.includes(p))
                              .length}
                            /{group.permissions.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 pl-6">
                          {group.permissions.map((perm) => (
                            <label
                              key={perm}
                              className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 hover:text-gray-900 py-0.5"
                            >
                              <input
                                type="checkbox"
                                checked={roleForm.permissions.includes(perm)}
                                onChange={() => togglePermission(perm)}
                                className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                              />
                              {formatPermName(perm)}
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveRole}
                  disabled={!roleForm.name}
                  className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                >
                  {editingRole ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======== Assign Role Modal ======== */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Assign Role to User</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                <input
                  type="text"
                  value={assignForm.user_id}
                  onChange={(e) => setAssignForm({ ...assignForm, user_id: e.target.value })}
                  placeholder="Enter user ID..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={assignForm.role_id}
                  onChange={(e) => setAssignForm({ ...assignForm, role_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Select a role...</option>
                  {roles
                    .filter((r) => r.is_active)
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}{' '}
                        {role.is_system_role ? '(System)' : ''} - {role.permissions.length} permissions
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowAssignModal(false)
                    setAssignForm({ user_id: '', role_id: '' })
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={assignRole}
                  disabled={!assignForm.user_id || !assignForm.role_id}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  Assign Role
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
