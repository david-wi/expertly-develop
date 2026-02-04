import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { Carrier } from '../types'
import { Plus, Truck, Mail, Phone, X, AlertTriangle, Shield } from 'lucide-react'

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-700',
  do_not_use: 'bg-red-100 text-red-700',
}

const equipmentTypes = [
  'Dry Van',
  'Reefer',
  'Flatbed',
  'Step Deck',
  'Power Only',
  'Sprinter',
  'Box Truck',
]

export default function Carriers() {
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    mc_number: '',
    dot_number: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    equipment_types: [] as string[],
    insurance_expiration: '',
  })

  useEffect(() => {
    fetchCarriers()
  }, [])

  const fetchCarriers = async () => {
    try {
      const data = await api.getCarriers()
      setCarriers(data)
    } catch (error) {
      console.error('Failed to fetch carriers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        insurance_expiration: formData.insurance_expiration || undefined,
      }
      if (editingCarrier) {
        const updated = await api.updateCarrier(editingCarrier.id, payload)
        setCarriers(carriers.map(c => c.id === updated.id ? updated : c))
      } else {
        const created = await api.createCarrier(payload)
        setCarriers([created, ...carriers])
      }
      resetForm()
    } catch (error) {
      console.error('Failed to save carrier:', error)
    }
  }

  const handleEdit = (carrier: Carrier) => {
    setEditingCarrier(carrier)
    setFormData({
      name: carrier.name,
      mc_number: carrier.mc_number || '',
      dot_number: carrier.dot_number || '',
      contact_name: carrier.contact_name || '',
      contact_email: carrier.contact_email || '',
      contact_phone: carrier.contact_phone || '',
      equipment_types: carrier.equipment_types || [],
      insurance_expiration: carrier.insurance_expiration
        ? new Date(carrier.insurance_expiration).toISOString().split('T')[0]
        : '',
    })
    setShowForm(true)
  }

  const handleEquipmentToggle = (type: string) => {
    setFormData(prev => ({
      ...prev,
      equipment_types: prev.equipment_types.includes(type)
        ? prev.equipment_types.filter(t => t !== type)
        : [...prev.equipment_types, type]
    }))
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingCarrier(null)
    setFormData({
      name: '',
      mc_number: '',
      dot_number: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      equipment_types: [],
      insurance_expiration: '',
    })
  }

  const isInsuranceExpiringSoon = (date: string | undefined) => {
    if (!date) return false
    const expiration = new Date(date)
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    return expiration <= thirtyDaysFromNow
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carriers</h1>
          <p className="text-gray-500">{carriers.length} carrier{carriers.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Add Carrier
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">
                {editingCarrier ? 'Edit Carrier' : 'New Carrier'}
              </h2>
              <button onClick={resetForm} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    MC Number
                  </label>
                  <input
                    type="text"
                    value={formData.mc_number}
                    onChange={(e) => setFormData({ ...formData, mc_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    DOT Number
                  </label>
                  <input
                    type="text"
                    value={formData.dot_number}
                    onChange={(e) => setFormData({ ...formData, dot_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Insurance Expiration
                </label>
                <input
                  type="date"
                  value={formData.insurance_expiration}
                  onChange={(e) => setFormData({ ...formData, insurance_expiration: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Equipment Types
                </label>
                <div className="flex flex-wrap gap-2">
                  {equipmentTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleEquipmentToggle(type)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        formData.equipment_types.includes(type)
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      } border`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  {editingCarrier ? 'Save Changes' : 'Create Carrier'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Carriers List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : carriers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No carriers yet
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {carriers.map((carrier) => (
              <li
                key={carrier.id}
                onClick={() => handleEdit(carrier)}
                className="p-4 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Truck className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{carrier.name}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColors[carrier.status]}`}>
                          {carrier.status.replace(/_/g, ' ')}
                        </span>
                        {isInsuranceExpiringSoon(carrier.insurance_expiration) && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Insurance Expiring
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                        {carrier.mc_number && (
                          <span className="flex items-center gap-1">
                            <Shield className="h-4 w-4" />
                            MC# {carrier.mc_number}
                          </span>
                        )}
                        {carrier.contact_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-4 w-4" />
                            {carrier.contact_email}
                          </span>
                        )}
                        {carrier.contact_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            {carrier.contact_phone}
                          </span>
                        )}
                      </div>
                      {carrier.equipment_types && carrier.equipment_types.length > 0 && (
                        <div className="mt-2 flex gap-1 flex-wrap">
                          {carrier.equipment_types.map((type) => (
                            <span
                              key={type}
                              className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
