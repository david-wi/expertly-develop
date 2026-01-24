import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Calendar, Clock, Key } from 'lucide-react';
import { Button, Card } from '../components/ui';
import { staff as staffApi, users as usersApi } from '../services/api';
import type { Staff } from '../types';
import { StaffDetailModal } from '../components/staff/StaffDetailModal';
import { ScheduleOverrideModal } from '../components/staff/ScheduleOverrideModal';
import { StaffLoginModal } from '../components/staff/StaffLoginModal';

export function StaffPage() {
  const queryClient = useQueryClient();
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleStaff, setScheduleStaff] = useState<Staff | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginStaff, setLoginStaff] = useState<Staff | null>(null);

  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list(),
  });

  // Fetch users to check login status
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(true),
  });

  const getStaffLoginStatus = (staffId: string) => {
    const user = users.find((u) => u.staff_id === staffId);
    return user ? { hasLogin: true, isActive: user.is_active, role: user.role } : null;
  };

  const openLoginModal = (staff: Staff) => {
    setLoginStaff(staff);
    setShowLoginModal(true);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => staffApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });

  const openCreateModal = () => {
    setSelectedStaff(null);
    setModalMode('create');
  };

  const openEditModal = (staff: Staff) => {
    setSelectedStaff(staff);
    setModalMode('edit');
  };

  const openScheduleModal = (staff: Staff) => {
    setScheduleStaff(staff);
    setShowScheduleModal(true);
  };

  const closeModal = () => {
    setSelectedStaff(null);
    setModalMode('view');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-warm-800">Staff</h1>
        <Button onClick={openCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
          Add Staff
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-warm-500">Loading...</div>
      ) : staffList.length === 0 ? (
        <div className="text-center py-12 text-warm-500">No staff members yet</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {staffList.map((member) => (
            <Card key={member.id}>
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold overflow-hidden flex-shrink-0"
                  style={{ backgroundColor: member.avatar_url ? undefined : member.color }}
                >
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.first_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      {member.first_name[0]}
                      {member.last_name[0]}
                    </>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-warm-800">
                    {member.first_name} {member.last_name}
                  </h3>
                  {member.display_name && (
                    <p className="text-sm text-warm-500">Goes by "{member.display_name}"</p>
                  )}
                  {member.email && (
                    <p className="text-sm text-warm-600 truncate">{member.email}</p>
                  )}
                  {member.phone && <p className="text-sm text-warm-600">{member.phone}</p>}

                  {/* Quick schedule summary */}
                  <div className="mt-2 flex items-center gap-2 text-xs text-warm-500">
                    <Clock className="w-3 h-3" />
                    <span>
                      {member.working_hours?.schedule
                        ? Object.values(member.working_hours.schedule).filter(
                            (d) => d.is_working
                          ).length + ' days/week'
                        : 'No schedule set'}
                    </span>
                  </div>

                  {/* Login status */}
                  {(() => {
                    const loginStatus = getStaffLoginStatus(member.id);
                    return (
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <Key className="w-3 h-3" />
                        {loginStatus ? (
                          <span className={loginStatus.isActive ? 'text-success-600' : 'text-warm-400'}>
                            {loginStatus.isActive ? 'Can log in' : 'Login disabled'}
                            {loginStatus.role !== 'staff' && ` (${loginStatus.role})`}
                          </span>
                        ) : (
                          <span className="text-warm-400">No login</span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => openEditModal(member)}
                    className="p-1.5 rounded-lg text-warm-500 hover:bg-warm-100 hover:text-warm-700"
                    title="Edit staff"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openScheduleModal(member)}
                    className="p-1.5 rounded-lg text-warm-500 hover:bg-warm-100 hover:text-warm-700"
                    title="Manage time off"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openLoginModal(member)}
                    className="p-1.5 rounded-lg text-warm-500 hover:bg-warm-100 hover:text-warm-700"
                    title="Manage login"
                  >
                    <Key className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to remove this staff member?')) {
                        deleteMutation.mutate(member.id);
                      }
                    }}
                    className="p-1.5 rounded-lg text-warm-500 hover:bg-red-100 hover:text-red-600"
                    title="Delete staff"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Staff Detail/Edit Modal */}
      <StaffDetailModal
        staff={selectedStaff}
        isOpen={modalMode !== 'view' || selectedStaff !== null}
        onClose={closeModal}
        mode={modalMode}
      />

      {/* Schedule Override Modal */}
      {scheduleStaff && (
        <ScheduleOverrideModal
          staff={scheduleStaff}
          isOpen={showScheduleModal}
          onClose={() => {
            setShowScheduleModal(false);
            setScheduleStaff(null);
          }}
        />
      )}

      {/* Staff Login Modal */}
      {loginStaff && (
        <StaffLoginModal
          staff={loginStaff}
          isOpen={showLoginModal}
          onClose={() => {
            setShowLoginModal(false);
            setLoginStaff(null);
          }}
        />
      )}
    </div>
  );
}
