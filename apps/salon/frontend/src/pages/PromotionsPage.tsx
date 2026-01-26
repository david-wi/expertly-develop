import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { promotions } from '../services/api';
import type { Promotion, PromotionCreate, PromotionType, DiscountType } from '../types';

const typeLabels: Record<PromotionType, string> = {
  birthday: 'Birthday',
  referral: 'Referral',
  new_client: 'New Client',
  loyalty: 'Loyalty',
  seasonal: 'Seasonal',
  custom: 'Custom',
};

const typeColors: Record<PromotionType, string> = {
  birthday: 'bg-pink-100 text-pink-800',
  referral: 'bg-purple-100 text-purple-800',
  new_client: 'bg-green-100 text-green-800',
  loyalty: 'bg-amber-100 text-amber-800',
  seasonal: 'bg-blue-100 text-blue-800',
  custom: 'bg-gray-100 text-gray-800',
};

export default function PromotionsPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  const { data: promoList = [], isLoading } = useQuery({
    queryKey: ['promotions', showActiveOnly],
    queryFn: () => promotions.list(showActiveOnly ? true : undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => promotions.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      promotions.update(id, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });

  // Close modals on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddModal) setShowAddModal(false);
        if (editingPromo) setEditingPromo(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showAddModal, editingPromo]);

  const formatDiscount = (promo: Promotion) => {
    if (promo.discount_type === 'percentage') {
      return `${promo.discount_value}% off`;
    } else if (promo.discount_type === 'fixed') {
      return `$${(promo.discount_value / 100).toFixed(0)} off`;
    }
    return 'Free service';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Promotions & Discounts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage birthday discounts, referral rewards, and promo codes
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-rose-500 rounded-lg hover:bg-rose-600"
        >
          Create Promotion
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showActiveOnly}
            onChange={(e) => setShowActiveOnly(e.target.checked)}
            className="rounded border-gray-300 text-rose-500 focus:ring-rose-500"
          />
          Show active only
        </label>
      </div>

      {/* Promotions Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : promoList.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <p className="text-gray-500">No promotions found</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-2 text-rose-600 hover:text-rose-700 text-sm"
          >
            Create your first promotion
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promoList.map((promo) => (
            <div
              key={promo.id}
              className={`bg-white rounded-xl shadow-sm border p-5 ${
                !promo.is_active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${typeColors[promo.promotion_type]}`}>
                  {typeLabels[promo.promotion_type]}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleMutation.mutate({ id: promo.id, isActive: !promo.is_active })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      promo.is_active ? 'bg-rose-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        promo.is_active ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 mb-1">{promo.name}</h3>
              {promo.description && (
                <p className="text-sm text-gray-500 mb-3">{promo.description}</p>
              )}

              <div className="text-2xl font-bold text-rose-600 mb-3">
                {formatDiscount(promo)}
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                {promo.code && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{promo.code}</span>
                    {promo.requires_code && <span className="text-amber-600">Required</span>}
                  </div>
                )}
                {promo.max_uses && (
                  <div>
                    {promo.current_uses}/{promo.max_uses} uses
                  </div>
                )}
                {promo.end_date && (
                  <div>
                    Expires {format(parseISO(promo.end_date), 'MMM d, yyyy')}
                  </div>
                )}
                {promo.promotion_type === 'birthday' && (
                  <div>
                    Valid {promo.birthday_days_before}d before - {promo.birthday_days_after}d after birthday
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                <button
                  onClick={() => setEditingPromo(promo)}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this promotion?')) {
                      deleteMutation.mutate(promo.id);
                    }
                  }}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingPromo) && (
        <PromotionModal
          promotion={editingPromo}
          onClose={() => {
            setShowAddModal(false);
            setEditingPromo(null);
          }}
          onSuccess={() => {
            setShowAddModal(false);
            setEditingPromo(null);
            queryClient.invalidateQueries({ queryKey: ['promotions'] });
          }}
        />
      )}
    </div>
  );
}

interface PromotionModalProps {
  promotion: Promotion | null;
  onClose: () => void;
  onSuccess: () => void;
}

function PromotionModal({ promotion, onClose, onSuccess }: PromotionModalProps) {
  const [formData, setFormData] = useState<PromotionCreate>({
    name: promotion?.name || '',
    description: promotion?.description || '',
    promotion_type: promotion?.promotion_type || 'custom',
    discount_type: promotion?.discount_type || 'percentage',
    discount_value: promotion?.discount_value || 10,
    code: promotion?.code || '',
    requires_code: promotion?.requires_code || false,
    max_uses: promotion?.max_uses || undefined,
    max_uses_per_client: promotion?.max_uses_per_client || 1,
    start_date: promotion?.start_date || undefined,
    end_date: promotion?.end_date || undefined,
    birthday_days_before: promotion?.birthday_days_before || 7,
    birthday_days_after: promotion?.birthday_days_after || 7,
    is_active: promotion?.is_active ?? true,
  });

  const createMutation = useMutation({
    mutationFn: () => promotions.create(formData),
    onSuccess,
  });

  const updateMutation = useMutation({
    mutationFn: () => promotions.update(promotion!.id, formData),
    onSuccess,
  });

  const handleSubmit = () => {
    if (promotion) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">
          {promotion ? 'Edit Promotion' : 'Create Promotion'}
        </h2>

        <div className="space-y-4">
          {/* Promotion Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={formData.promotion_type}
              onChange={(e) => setFormData({ ...formData, promotion_type: e.target.value as PromotionType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Birthday Special"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>

          {/* Discount Type and Value */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
              <select
                value={formData.discount_type}
                onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as DiscountType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
                <option value="free_service">Free Service</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.discount_type === 'percentage' ? 'Percentage' : 'Amount (cents)'}
              </label>
              <input
                type="number"
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: parseInt(e.target.value) || 0 })}
                min={0}
                max={formData.discount_type === 'percentage' ? 100 : undefined}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Promo Code */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Promo Code</label>
              <input
                type="text"
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g., BIRTHDAY20"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent font-mono"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.requires_code}
                  onChange={(e) => setFormData({ ...formData, requires_code: e.target.checked })}
                  className="rounded border-gray-300 text-rose-500 focus:ring-rose-500"
                />
                Code required
              </label>
            </div>
          </div>

          {/* Birthday-specific settings */}
          {formData.promotion_type === 'birthday' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Days Before Birthday</label>
                <input
                  type="number"
                  value={formData.birthday_days_before}
                  onChange={(e) => setFormData({ ...formData, birthday_days_before: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={30}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Days After Birthday</label>
                <input
                  type="number"
                  value={formData.birthday_days_after}
                  onChange={(e) => setFormData({ ...formData, birthday_days_after: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={30}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Usage Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Total Uses</label>
              <input
                type="number"
                value={formData.max_uses || ''}
                onChange={(e) => setFormData({ ...formData, max_uses: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="Unlimited"
                min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Per Client</label>
              <input
                type="number"
                value={formData.max_uses_per_client}
                onChange={(e) => setFormData({ ...formData, max_uses_per_client: parseInt(e.target.value) || 1 })}
                min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.start_date ? formData.start_date.split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={formData.end_date ? formData.end_date.split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Active Toggle */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded border-gray-300 text-rose-500 focus:ring-rose-500"
            />
            <span className="text-sm font-medium text-gray-700">Active</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.name || isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-500 rounded-lg hover:bg-rose-600 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : promotion ? 'Save Changes' : 'Create Promotion'}
          </button>
        </div>
      </div>
    </div>
  );
}
