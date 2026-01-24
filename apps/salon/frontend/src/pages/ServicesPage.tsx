import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Clock, DollarSign } from 'lucide-react';
import { Button, Input, Card, Modal, ModalFooter } from '../components/ui';
import { services as servicesApi } from '../services/api';
import type { Service, ServiceCreate } from '../types';

export function ServicesPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const { data: serviceList = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: ServiceCreate) => servicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setIsCreateModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ServiceCreate> }) =>
      servicesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setEditingService(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => servicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-warm-800">Services</h1>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Service
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-warm-500">Loading...</div>
      ) : serviceList.length === 0 ? (
        <div className="text-center py-12 text-warm-500">No services yet</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {serviceList.map((service) => (
            <Card key={service.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-warm-800">{service.name}</h3>
                  {service.description && (
                    <p className="text-sm text-warm-500 mt-1 line-clamp-2">
                      {service.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1 text-sm text-warm-600">
                      <Clock className="w-4 h-4" />
                      {service.duration_minutes} min
                    </div>
                    <div className="flex items-center gap-1 text-sm font-medium text-accent-600">
                      <DollarSign className="w-4 h-4" />
                      {service.price_display}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditingService(service)}
                    className="p-1.5 rounded-lg text-warm-500 hover:bg-warm-100 hover:text-warm-700"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to remove this service?')) {
                        deleteMutation.mutate(service.id);
                      }
                    }}
                    className="p-1.5 rounded-lg text-warm-500 hover:bg-error-100 hover:text-error-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create modal */}
      <ServiceFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
        title="Add Service"
      />

      {/* Edit modal */}
      {editingService && (
        <ServiceFormModal
          isOpen={true}
          onClose={() => setEditingService(null)}
          onSubmit={(data) =>
            updateMutation.mutate({ id: editingService.id, data })
          }
          isLoading={updateMutation.isPending}
          title="Edit Service"
          initialData={editingService}
        />
      )}
    </div>
  );
}

interface ServiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ServiceCreate) => void;
  isLoading: boolean;
  title: string;
  initialData?: Service;
}

function ServiceFormModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  title,
  initialData,
}: ServiceFormModalProps) {
  const [formData, setFormData] = useState<ServiceCreate>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    duration_minutes: initialData?.duration_minutes || 30,
    buffer_minutes: initialData?.buffer_minutes || 0,
    price: initialData?.price || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Service Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="e.g., Haircut, Color, etc."
        />
        <Input
          label="Description"
          value={formData.description || ''}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="Optional description"
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Duration (minutes)"
            type="number"
            value={formData.duration_minutes}
            onChange={(e) =>
              setFormData({
                ...formData,
                duration_minutes: parseInt(e.target.value) || 0,
              })
            }
            min={5}
            max={480}
            required
          />
          <Input
            label="Buffer Time (minutes)"
            type="number"
            value={formData.buffer_minutes || 0}
            onChange={(e) =>
              setFormData({
                ...formData,
                buffer_minutes: parseInt(e.target.value) || 0,
              })
            }
            min={0}
            max={60}
            hint="Cleanup time after service"
          />
        </div>
        <Input
          label="Price ($)"
          type="number"
          value={(formData.price / 100).toFixed(2)}
          onChange={(e) =>
            setFormData({
              ...formData,
              price: Math.round(parseFloat(e.target.value) * 100) || 0,
            })
          }
          min={0}
          step={0.01}
          required
        />

        <ModalFooter>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {initialData ? 'Save Changes' : 'Add Service'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
