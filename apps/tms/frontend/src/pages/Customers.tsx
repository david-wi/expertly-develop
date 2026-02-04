import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { Customer } from '../types'
import { Plus, Building2, Mail, Phone, X, CheckCircle, AlertCircle, PauseCircle } from 'lucide-react'

const statusConfig: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  active: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-700', icon: PauseCircle },
  credit_hold: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertCircle },
  paused: { bg: 'bg-amber-100', text: 'text-amber-700', icon: PauseCircle },
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    billing_email: '',
    phone: '',
    address_line1: '',
    city: '',
    state: '',
    zip_code: '',
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      const data = await api.getCustomers()
      setCustomers(data)
    } catch (error) {
      console.error('Failed to fetch customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingCustomer) {
        const updated = await api.updateCustomer(editingCustomer.id, formData)
        setCustomers(customers.map(c => c.id === updated.id ? updated : c))
      } else {
        const created = await api.createCustomer(formData)
        setCustomers([created, ...customers])
      }
      resetForm()
    } catch (error) {
      console.error('Failed to save customer:', error)
    }
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      billing_email: customer.billing_email || '',
      phone: customer.phone || '',
      address_line1: customer.address_line1 || '',
      city: customer.city || '',
      state: customer.state || '',
      zip_code: customer.zip_code || '',
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingCustomer(null)
    setFormData({
      name: '',
      billing_email: '',
      phone: '',
      address_line1: '',
      city: '',
      state: '',
      zip_code: '',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500">{customers.length} customer{customers.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Add Customer
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">
                {editingCustomer ? 'Edit Customer' : 'New Customer'}
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
                    Billing Email
                  </label>
                  <input
                    type="email"
                    value={formData.billing_email}
                    onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                  placeholder="Street address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP
                  </label>
                  <input
                    type="text"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  {editingCustomer ? 'Save Changes' : 'Create Customer'}
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

      {/* Customers List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No customers yet
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {customers.map((customer) => (
              <li
                key={customer.id}
                onClick={() => handleEdit(customer)}
                className="p-4 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{customer.name}</h3>
                        {(() => {
                          const status = statusConfig[customer.status] || statusConfig.active
                          const StatusIcon = status.icon
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${status.bg} ${status.text}`}>
                              <StatusIcon className="h-3 w-3" />
                              {customer.status.replace(/_/g, ' ')}
                            </span>
                          )
                        })()}
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                        {customer.billing_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-4 w-4" />
                            {customer.billing_email}
                          </span>
                        )}
                        {customer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            {customer.phone}
                          </span>
                        )}
                      </div>
                      {customer.city && customer.state && (
                        <p className="mt-1 text-sm text-gray-500">
                          {customer.city}, {customer.state}
                        </p>
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
