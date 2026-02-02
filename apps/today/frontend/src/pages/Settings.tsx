import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  timezone: string;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  api_calls_this_month: number;
  created_at: string;
  usage: {
    total_users: number;
    total_tasks: number;
    tasks_completed_this_month: number;
    tasks_created_this_month: number;
    api_calls_this_month: number;
  };
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'organization' | 'users'>('organization');
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', role: 'member' });

  // Fetch organization data
  const { data: org, isLoading: orgLoading } = useQuery<Organization>({
    queryKey: ['organization'],
    queryFn: () => api.getOrganization(),
  });

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
  });

  // For now, assume current user is first user (would need a /me endpoint)
  const currentUser = users?.[0];

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (data: typeof newUser) => api.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowNewUserForm(false);
      setNewUser({ email: '', name: '', role: 'member' });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => api.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--theme-text-heading)] mb-6">Settings</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('organization')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'organization'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Organization
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Users
          </button>
        </nav>
      </div>

      {/* Organization Tab */}
      {activeTab === 'organization' && (
        <div className="space-y-6">
          {orgLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ) : org ? (
            <>
              {/* Organization Info */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Organization Details</h2>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">{org.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Organization ID</dt>
                    <dd className="mt-1 text-sm text-gray-500 font-mono text-xs">{org.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Created</dt>
                    <dd className="mt-1 text-sm text-gray-900">{new Date(org.created_at).toLocaleDateString()}</dd>
                  </div>
                </dl>
              </div>

              {/* Usage Stats */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Usage This Month</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{org.usage.total_users}</div>
                    <div className="text-sm text-gray-500">Total Users</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{org.usage.total_tasks}</div>
                    <div className="text-sm text-gray-500">Total Tasks</div>
                  </div>
                  <div className="bg-primary-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-primary-600">{org.usage.tasks_created_this_month}</div>
                    <div className="text-sm text-gray-500">Tasks Created</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{org.usage.tasks_completed_this_month}</div>
                    <div className="text-sm text-gray-500">Tasks Completed</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">{org.usage.api_calls_this_month}</div>
                    <div className="text-sm text-gray-500">API Calls</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-500">Failed to load organization data</p>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Add User Button */}
          {isAdmin && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowNewUserForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                + Add User
              </button>
            </div>
          )}

          {/* New User Form */}
          {showNewUserForm && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New User</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createUserMutation.mutate(newUser);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    required
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={createUserMutation.isPending}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                  >
                    {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewUserForm(false)}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
                {createUserMutation.isError && (
                  <p className="text-red-600 text-sm">Failed to create user. Please try again.</p>
                )}
              </form>
            </div>
          )}

          {/* Users List */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timezone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  {isAdmin && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usersLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      Loading users...
                    </td>
                  </tr>
                ) : users && users.length > 0 ? (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 font-medium">
                              {(user.name || user.email).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.name || 'No name'}
                              {user.id === currentUser?.id && (
                                <span className="ml-2 text-xs text-blue-600">(You)</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            user.role === 'admin'
                              ? 'bg-primary-100 text-primary-800'
                              : user.role === 'viewer'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.timezone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {user.id !== currentUser?.id && (
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this user?')) {
                                  deleteUserMutation.mutate(user.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
