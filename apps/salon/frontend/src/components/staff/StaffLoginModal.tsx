import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Mail, Shield, UserCheck, UserX, Trash2 } from 'lucide-react';
import { Button, Input } from '../ui';
import { users as usersApi } from '../../services/api';
import type { Staff, User } from '../../types';

interface StaffLoginModalProps {
  staff: Staff;
  isOpen: boolean;
  onClose: () => void;
}

export function StaffLoginModal({ staff, isOpen, onClose }: StaffLoginModalProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'view' | 'create'>('view');
  const [formData, setFormData] = useState({
    email: staff.email || '',
    password: '',
    confirmPassword: '',
    role: 'staff',
  });
  const [error, setError] = useState('');

  // Fetch users to find if this staff has a login
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(true),
    enabled: isOpen,
  });

  const staffUser = users.find((u) => u.staff_id === staff.id);

  useEffect(() => {
    if (staffUser) {
      setMode('view');
    } else {
      setMode('create');
    }
  }, [staffUser]);

  useEffect(() => {
    setFormData({
      email: staff.email || '',
      password: '',
      confirmPassword: '',
      role: 'staff',
    });
    setError('');
  }, [staff, isOpen]);

  const createMutation = useMutation({
    mutationFn: (data: {
      email: string;
      password: string;
      first_name: string;
      last_name: string;
      role: string;
      staff_id: string;
    }) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setMode('view');
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create login');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: string; is_active?: boolean } }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to update user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setMode('create');
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to delete user');
    },
  });

  const handleCreate = () => {
    setError('');

    if (!formData.email) {
      setError('Email is required');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    createMutation.mutate({
      email: formData.email,
      password: formData.password,
      first_name: staff.first_name,
      last_name: staff.last_name,
      role: formData.role,
      staff_id: staff.id,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-warm-200">
          <h2 className="text-lg font-semibold text-warm-800">
            Login Account - {staff.first_name} {staff.last_name}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-warm-100 rounded-lg">
            <X className="w-5 h-5 text-warm-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-error-100 text-error-700 text-sm">{error}</div>
          )}

          {staffUser ? (
            // View/Edit existing user
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-success-50 border border-success-200">
                <div className="flex items-center gap-2 text-success-700">
                  <UserCheck className="w-5 h-5" />
                  <span className="font-medium">Login Enabled</span>
                </div>
                <p className="text-sm text-success-600 mt-1">
                  This staff member can log in to the system.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-warm-700 mb-1">Email</label>
                  <div className="flex items-center gap-2 text-warm-600">
                    <Mail className="w-4 h-4" />
                    {staffUser.email}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-warm-700 mb-1">Role</label>
                  <select
                    value={staffUser.role}
                    onChange={(e) =>
                      updateMutation.mutate({
                        id: staffUser.id,
                        data: { role: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-warm-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="staff">Staff - View own appointments</option>
                    <option value="manager">Manager - Manage staff & appointments</option>
                    <option value="admin">Admin - Full access</option>
                  </select>
                  <p className="text-xs text-warm-500 mt-1">
                    {staffUser.role === 'staff' && 'Can view and manage their own appointments only.'}
                    {staffUser.role === 'manager' &&
                      'Can manage staff schedules, services, and all appointments.'}
                    {staffUser.role === 'admin' && 'Full access to all settings and features.'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-warm-700 mb-1">Status</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        updateMutation.mutate({
                          id: staffUser.id,
                          data: { is_active: !staffUser.is_active },
                        })
                      }
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                        staffUser.is_active
                          ? 'bg-success-100 text-success-700'
                          : 'bg-warm-100 text-warm-600'
                      }`}
                    >
                      {staffUser.is_active ? (
                        <>
                          <UserCheck className="w-4 h-4" />
                          Active
                        </>
                      ) : (
                        <>
                          <UserX className="w-4 h-4" />
                          Disabled
                        </>
                      )}
                    </button>
                    <span className="text-xs text-warm-500">
                      {staffUser.is_active
                        ? 'User can log in'
                        : 'User cannot log in'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-warm-200">
                <button
                  onClick={() => {
                    if (
                      confirm(
                        'Are you sure you want to remove this login account? The staff member will no longer be able to access the system.'
                      )
                    ) {
                      deleteMutation.mutate(staffUser.id);
                    }
                  }}
                  className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Login Account
                </button>
              </div>
            </div>
          ) : (
            // Create new user
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-warm-50 border border-warm-200">
                <div className="flex items-center gap-2 text-warm-700">
                  <UserX className="w-5 h-5" />
                  <span className="font-medium">No Login Account</span>
                </div>
                <p className="text-sm text-warm-600 mt-1">
                  Create a login so this staff member can access the system.
                </p>
              </div>

              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="staff@example.com"
              />

              <Input
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Minimum 8 characters"
              />

              <Input
                label="Confirm Password"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Re-enter password"
              />

              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-warm-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="staff">Staff - View own appointments</option>
                  <option value="manager">Manager - Manage staff & appointments</option>
                  <option value="admin">Admin - Full access</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-warm-200">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {!staffUser && (
            <Button onClick={handleCreate} isLoading={createMutation.isPending}>
              Create Login
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
