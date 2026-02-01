import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import type { Staff } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { StaffScheduleEditor } from './StaffScheduleEditor';
import { ScheduleOverrideModal } from './ScheduleOverrideModal';
import { PhotoUpload } from '../ui/PhotoUpload';

interface Props {
  staff: Staff | null;
  isOpen: boolean;
  onClose: () => void;
  mode: 'view' | 'edit' | 'create';
}

type TabType = 'info' | 'schedule' | 'services';

export function StaffDetailModal({ staff, isOpen, onClose, mode }: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [showOverrides, setShowOverrides] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    first_name: staff?.first_name || '',
    last_name: staff?.last_name || '',
    email: staff?.email || '',
    phone: staff?.phone || '',
    display_name: staff?.display_name || '',
    color: staff?.color || '#D4A5A5',
    avatar_url: staff?.avatar_url || '',
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (mode === 'create') {
        const response = await api.post('/staff', data);
        return response.data;
      } else {
        const response = await api.put(`/staff/${staff!.id}`, data);
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    },
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoChange = (url: string) => {
    setFormData((prev) => ({ ...prev, avatar_url: url }));
  };

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const tabs = [
    { id: 'info' as const, label: 'Info' },
    { id: 'schedule' as const, label: 'Schedule' },
  ];

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={mode === 'create' ? 'Add Staff Member' : `${staff?.first_name} ${staff?.last_name}`}
        size="lg"
      >
        {/* Tabs */}
        {mode !== 'create' && (
          <div className="flex border-b border-warm-200 mb-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-warm-500 hover:text-warm-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Info Tab */}
        {(activeTab === 'info' || mode === 'create') && (
          <div className="space-y-4">
            {/* Photo Upload */}
            <div className="flex items-start gap-4">
              <PhotoUpload
                currentUrl={formData.avatar_url}
                onUpload={handlePhotoChange}
                color={formData.color}
                name={`${formData.first_name} ${formData.last_name}`}
              />
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    required
                    autoFocus
                  />
                  <Input
                    label="Last Name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    required
                  />
                </div>
                <Input
                  label="Display Name"
                  value={formData.display_name}
                  onChange={(e) => handleInputChange('display_name', e.target.value)}
                  placeholder="Name shown to clients"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
              <Input
                label="Phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-warm-700 mb-1">
                Calendar Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => handleInputChange('color', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-warm-300"
                />
                <div className="flex gap-2">
                  {['#D4A5A5', '#C9A86C', '#A8C5A8', '#8BB8D0', '#B8A8D4', '#D4B8A8'].map(
                    (color) => (
                      <button
                        key={color}
                        onClick={() => handleInputChange('color', color)}
                        className={`w-8 h-8 rounded-full border-2 ${
                          formData.color === color
                            ? 'border-warm-800'
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-warm-200">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && staff && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowOverrides(true)}
              >
                Manage Time Off
              </Button>
            </div>
            <StaffScheduleEditor staff={staff} onClose={onClose} />
          </div>
        )}
      </Modal>

      {/* Schedule Overrides Modal */}
      {staff && (
        <ScheduleOverrideModal
          staff={staff}
          isOpen={showOverrides}
          onClose={() => setShowOverrides(false)}
        />
      )}
    </>
  );
}
