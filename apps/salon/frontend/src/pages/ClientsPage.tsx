import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Phone, Mail, Calendar } from 'lucide-react';
import { Button, Input, Card, Modal, ModalFooter } from '../components/ui';
import { clients as clientsApi } from '../services/api';
import type { Client, ClientCreate } from '../types';

export function ClientsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Fetch clients
  const { data: clientList = [], isLoading } = useQuery({
    queryKey: ['clients', searchQuery],
    queryFn: () =>
      searchQuery ? clientsApi.search(searchQuery) : clientsApi.list(),
  });

  // Create client mutation
  const createMutation = useMutation({
    mutationFn: (data: ClientCreate) => clientsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsCreateModalOpen(false);
    },
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-warm-800">Clients</h1>
        <Button onClick={() => setIsCreateModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
          Add Client
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-warm-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
        </div>
      </div>

      {/* Client list */}
      {isLoading ? (
        <div className="text-center py-12 text-warm-500">Loading...</div>
      ) : clientList.length === 0 ? (
        <div className="text-center py-12 text-warm-500">
          {searchQuery ? 'No clients found' : 'No clients yet'}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clientList.map((client) => (
            <Card
              key={client.id}
              className="cursor-pointer hover:shadow-warm-lg transition-shadow"
              onClick={() => setSelectedClient(client)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-warm-800">
                    {client.full_name}
                  </h3>
                  {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-warm-600 mt-1">
                      <Phone className="w-3.5 h-3.5" />
                      {client.phone}
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-2 text-sm text-warm-600 mt-1">
                      <Mail className="w-3.5 h-3.5" />
                      {client.email}
                    </div>
                  )}
                </div>
                <div className="text-right text-sm">
                  <div className="flex items-center gap-1 text-warm-500">
                    <Calendar className="w-3.5 h-3.5" />
                    {client.stats.completed_appointments} visits
                  </div>
                </div>
              </div>
              {client.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {client.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs rounded-full bg-accent-100 text-accent-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create client modal */}
      <CreateClientModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />

      {/* Client detail modal */}
      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </div>
  );
}

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ClientCreate) => void;
  isLoading: boolean;
}

function CreateClientModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: CreateClientModalProps) {
  const [formData, setFormData] = useState<ClientCreate>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Client">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name"
            value={formData.first_name}
            onChange={(e) =>
              setFormData({ ...formData, first_name: e.target.value })
            }
            required
          />
          <Input
            label="Last Name"
            value={formData.last_name}
            onChange={(e) =>
              setFormData({ ...formData, last_name: e.target.value })
            }
            required
          />
        </div>
        <Input
          label="Phone"
          type="tel"
          value={formData.phone || ''}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
        <Input
          label="Email"
          type="email"
          value={formData.email || ''}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Add Client
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

interface ClientDetailModalProps {
  client: Client;
  onClose: () => void;
}

function ClientDetailModal({ client, onClose }: ClientDetailModalProps) {
  return (
    <Modal isOpen={true} onClose={onClose} title={client.full_name} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-warm-500">Phone</span>
            <p className="font-medium">{client.phone || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-warm-500">Email</span>
            <p className="font-medium">{client.email || '-'}</p>
          </div>
        </div>

        <div className="border-t border-warm-200 pt-4">
          <h4 className="font-medium text-warm-800 mb-2">Statistics</h4>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary-500">
                {client.stats.completed_appointments}
              </p>
              <p className="text-xs text-warm-500">Visits</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-warm-600">
                {client.stats.cancelled_appointments}
              </p>
              <p className="text-xs text-warm-500">Cancelled</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-error-500">
                {client.stats.no_shows}
              </p>
              <p className="text-xs text-warm-500">No Shows</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-accent-600">
                ${(client.stats.total_spent / 100).toFixed(0)}
              </p>
              <p className="text-xs text-warm-500">Total Spent</p>
            </div>
          </div>
        </div>

        {client.notes && (
          <div className="border-t border-warm-200 pt-4">
            <h4 className="font-medium text-warm-800 mb-2">Notes</h4>
            <p className="text-warm-600 text-sm">{client.notes}</p>
          </div>
        )}

        {client.preferences && (
          <div className="border-t border-warm-200 pt-4">
            <h4 className="font-medium text-warm-800 mb-2">Preferences</h4>
            <p className="text-warm-600 text-sm">{client.preferences}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
