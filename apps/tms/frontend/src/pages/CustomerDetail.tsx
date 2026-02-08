import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { apiExtensions } from '../services/api-extensions'
import PageHelp from '../components/PageHelp'
import type { Customer, Shipment } from '../types'
import type {
  CustomerContactRecord,
  CustomerFacility,
  PricingPlaybook,
} from '../types/customer-detail'
import {
  ArrowLeft,
  Building2,
  Users,
  MapPin,
  DollarSign,
  Truck,
  Plus,
  X,
  Star,
  Mail,
  Phone,
  Clock,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  PauseCircle,
} from 'lucide-react'

const statusConfig: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  active: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-700', icon: PauseCircle },
  credit_hold: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertCircle },
  paused: { bg: 'bg-amber-100', text: 'text-amber-700', icon: PauseCircle },
}

type Tab = 'overview' | 'contacts' | 'facilities' | 'playbooks' | 'shipments'

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [contacts, setContacts] = useState<CustomerContactRecord[]>([])
  const [facilities, setFacilities] = useState<CustomerFacility[]>([])
  const [playbooks, setPlaybooks] = useState<PricingPlaybook[]>([])
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Contact form
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContact, setEditingContact] = useState<CustomerContactRecord | null>(null)
  const [contactForm, setContactForm] = useState({
    name: '',
    title: '',
    email: '',
    phone: '',
    department: '',
    is_primary: false,
    notes: '',
  })

  // Facility form
  const [showFacilityForm, setShowFacilityForm] = useState(false)
  const [facilityForm, setFacilityForm] = useState({
    name: '',
    facility_type: 'warehouse',
    address_line1: '',
    city: '',
    state: '',
    zip_code: '',
    contact_name: '',
    contact_phone: '',
    dock_hours: '',
    special_instructions: '',
  })

  // Playbook form
  const [showPlaybookForm, setShowPlaybookForm] = useState(false)
  const [playbookForm, setPlaybookForm] = useState({
    name: '',
    origin_state: '',
    dest_state: '',
    equipment_type: '',
    base_rate: 0,
    fuel_surcharge_pct: 0,
    min_rate: 0,
    max_rate: 0,
    notes: '',
  })

  useEffect(() => {
    if (!id) return
    fetchCustomer()
  }, [id])

  useEffect(() => {
    if (!id || !customer) return
    if (activeTab === 'contacts') fetchContacts()
    if (activeTab === 'facilities') fetchFacilities()
    if (activeTab === 'playbooks') fetchPlaybooks()
    if (activeTab === 'shipments') fetchShipments()
  }, [activeTab, customer])

  const fetchCustomer = async () => {
    if (!id) return
    try {
      const data = await api.getCustomer(id)
      setCustomer(data)
    } catch (error) {
      console.error('Failed to fetch customer:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchContacts = async () => {
    if (!id) return
    try {
      const data = await apiExtensions.getCustomerContacts(id)
      setContacts(data)
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
    }
  }

  const fetchFacilities = async () => {
    if (!id) return
    try {
      const data = await apiExtensions.getCustomerFacilities(id)
      setFacilities(data)
    } catch (error) {
      console.error('Failed to fetch facilities:', error)
    }
  }

  const fetchPlaybooks = async () => {
    if (!id) return
    try {
      const data = await apiExtensions.getCustomerPlaybooks(id)
      setPlaybooks(data)
    } catch (error) {
      console.error('Failed to fetch playbooks:', error)
    }
  }

  const fetchShipments = async () => {
    if (!id) return
    try {
      const data = await api.getShipments({ customer_id: id })
      setShipments(data)
    } catch (error) {
      console.error('Failed to fetch shipments:', error)
    }
  }

  // Contact CRUD
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      if (editingContact) {
        const updated = await apiExtensions.updateCustomerContact(id, editingContact.id, contactForm)
        setContacts(contacts.map(c => c.id === updated.id ? updated : c))
      } else {
        const created = await apiExtensions.createCustomerContact(id, contactForm)
        setContacts([...contacts, created])
      }
      resetContactForm()
    } catch (error) {
      console.error('Failed to save contact:', error)
    }
  }

  const handleDeleteContact = async (contactId: string) => {
    if (!id || !confirm('Delete this contact?')) return
    try {
      await apiExtensions.deleteCustomerContact(id, contactId)
      setContacts(contacts.filter(c => c.id !== contactId))
    } catch (error) {
      console.error('Failed to delete contact:', error)
    }
  }

  const resetContactForm = () => {
    setShowContactForm(false)
    setEditingContact(null)
    setContactForm({ name: '', title: '', email: '', phone: '', department: '', is_primary: false, notes: '' })
  }

  // Facility CRUD
  const handleCreateFacility = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      const created = await apiExtensions.createCustomerFacility(id, facilityForm)
      setFacilities([...facilities, created])
      setShowFacilityForm(false)
      setFacilityForm({
        name: '', facility_type: 'warehouse', address_line1: '', city: '', state: '', zip_code: '',
        contact_name: '', contact_phone: '', dock_hours: '', special_instructions: '',
      })
    } catch (error) {
      console.error('Failed to create facility:', error)
    }
  }

  const handleDeleteFacility = async (facilityId: string) => {
    if (!id || !confirm('Delete this facility?')) return
    try {
      await apiExtensions.deleteCustomerFacility(id, facilityId)
      setFacilities(facilities.filter(f => f.id !== facilityId))
    } catch (error) {
      console.error('Failed to delete facility:', error)
    }
  }

  // Playbook CRUD
  const handleCreatePlaybook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      const created = await apiExtensions.createCustomerPlaybook(id, playbookForm)
      setPlaybooks([...playbooks, created])
      setShowPlaybookForm(false)
      setPlaybookForm({
        name: '', origin_state: '', dest_state: '', equipment_type: '',
        base_rate: 0, fuel_surcharge_pct: 0, min_rate: 0, max_rate: 0, notes: '',
      })
    } catch (error) {
      console.error('Failed to create playbook:', error)
    }
  }

  const handleDeletePlaybook = async (playbookId: string) => {
    if (!id || !confirm('Delete this playbook?')) return
    try {
      await apiExtensions.deleteCustomerPlaybook(id, playbookId)
      setPlaybooks(playbooks.filter(p => p.id !== playbookId))
    } catch (error) {
      console.error('Failed to delete playbook:', error)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>
  }

  if (!customer) {
    return <div className="p-8 text-center text-gray-500">Customer not found</div>
  }

  const status = statusConfig[customer.status] || statusConfig.active
  const StatusIcon = status.icon

  const tabs: { key: Tab; label: string; icon: typeof Building2 }[] = [
    { key: 'overview', label: 'Overview', icon: Building2 },
    { key: 'contacts', label: 'Contacts', icon: Users },
    { key: 'facilities', label: 'Facilities', icon: MapPin },
    { key: 'playbooks', label: 'Pricing Playbooks', icon: DollarSign },
    { key: 'shipments', label: 'Shipment History', icon: Truck },
  ]

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/customers')}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
            <PageHelp pageId="customer-detail" />
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${status.bg} ${status.text}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {customer.status.replace(/_/g, ' ')}
            </span>
          </div>
          {customer.code && (
            <p className="text-sm text-gray-500 mt-1">Code: {customer.code}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => {
            const TabIcon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <TabIcon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats Cards */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-500">Total Shipments</div>
            <div className="mt-1 text-3xl font-bold text-gray-900">{customer.total_shipments}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-500">Total Revenue</div>
            <div className="mt-1 text-3xl font-bold text-gray-900">
              {formatCurrency(customer.total_revenue)}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-500">Default Margin</div>
            <div className="mt-1 text-3xl font-bold text-gray-900">
              {customer.default_margin_percent}%
            </div>
          </div>

          {/* Customer Details */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Billing Email</span>
                <p className="text-sm font-medium">{customer.billing_email || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Payment Terms</span>
                <p className="text-sm font-medium">Net {customer.payment_terms} days</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Credit Limit</span>
                <p className="text-sm font-medium">
                  {customer.credit_limit ? formatCurrency(customer.credit_limit) : 'No limit'}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Location</span>
                <p className="text-sm font-medium">
                  {customer.city && customer.state
                    ? `${customer.city}, ${customer.state} ${customer.zip_code || ''}`
                    : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Contacts Preview */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contacts</h3>
            {customer.contacts.length > 0 ? (
              <ul className="space-y-3">
                {customer.contacts.slice(0, 3).map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-medium">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium flex items-center gap-1">
                        {c.name}
                        {c.is_primary && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                      </div>
                      <div className="text-xs text-gray-500">{c.role || c.email || ''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No contacts</p>
            )}
            <button
              onClick={() => setActiveTab('contacts')}
              className="mt-4 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              View all contacts
            </button>
          </div>
        </div>
      )}

      {activeTab === 'contacts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Contacts ({contacts.length})
            </h3>
            <button
              onClick={() => setShowContactForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Contact
            </button>
          </div>

          {/* Contact form modal */}
          {showContactForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-lg mx-4">
                <div className="flex items-center justify-between p-4 border-b">
                  <h2 className="text-lg font-semibold">
                    {editingContact ? 'Edit Contact' : 'Add Contact'}
                  </h2>
                  <button onClick={resetContactForm} className="p-1 text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleCreateContact} className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        type="text" required
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                      <input
                        type="text"
                        value={contactForm.title}
                        onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <input
                      type="text"
                      value={contactForm.department}
                      onChange={(e) => setContactForm({ ...contactForm, department: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_primary"
                      checked={contactForm.is_primary}
                      onChange={(e) => setContactForm({ ...contactForm, is_primary: e.target.checked })}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="is_primary" className="text-sm text-gray-700">Primary contact</label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      rows={2}
                      value={contactForm.notes}
                      onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                      {editingContact ? 'Save Changes' : 'Add Contact'}
                    </button>
                    <button type="button" onClick={resetContactForm} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Contacts table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {contacts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No contacts yet</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{contact.name}</span>
                          {contact.is_primary && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                              <Star className="h-3 w-3 fill-amber-500" />
                              Primary
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{contact.title || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {contact.email ? (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {contact.email}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {contact.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {contact.phone}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{contact.department || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingContact(contact)
                              setContactForm({
                                name: contact.name,
                                title: contact.title || '',
                                email: contact.email || '',
                                phone: contact.phone || '',
                                department: contact.department || '',
                                is_primary: contact.is_primary,
                                notes: contact.notes || '',
                              })
                              setShowContactForm(true)
                            }}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 rounded"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(contact.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'facilities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Facilities ({facilities.length})
            </h3>
            <button
              onClick={() => setShowFacilityForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Facility
            </button>
          </div>

          {/* Facility form modal */}
          {showFacilityForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b">
                  <h2 className="text-lg font-semibold">Add Facility</h2>
                  <button onClick={() => setShowFacilityForm(false)} className="p-1 text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleCreateFacility} className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <input type="text" required value={facilityForm.name}
                        onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select value={facilityForm.facility_type}
                        onChange={(e) => setFacilityForm({ ...facilityForm, facility_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="warehouse">Warehouse</option>
                        <option value="distribution_center">Distribution Center</option>
                        <option value="manufacturing">Manufacturing</option>
                        <option value="office">Office</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                    <input type="text" required value={facilityForm.address_line1}
                      onChange={(e) => setFacilityForm({ ...facilityForm, address_line1: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                      <input type="text" required value={facilityForm.city}
                        onChange={(e) => setFacilityForm({ ...facilityForm, city: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                      <input type="text" required value={facilityForm.state}
                        onChange={(e) => setFacilityForm({ ...facilityForm, state: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ZIP *</label>
                      <input type="text" required value={facilityForm.zip_code}
                        onChange={(e) => setFacilityForm({ ...facilityForm, zip_code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                      <input type="text" value={facilityForm.contact_name}
                        onChange={(e) => setFacilityForm({ ...facilityForm, contact_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                      <input type="tel" value={facilityForm.contact_phone}
                        onChange={(e) => setFacilityForm({ ...facilityForm, contact_phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dock Hours</label>
                    <input type="text" placeholder="e.g. 6am-2pm Mon-Fri" value={facilityForm.dock_hours}
                      onChange={(e) => setFacilityForm({ ...facilityForm, dock_hours: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                    <textarea rows={2} value={facilityForm.special_instructions}
                      onChange={(e) => setFacilityForm({ ...facilityForm, special_instructions: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                      Add Facility
                    </button>
                    <button type="button" onClick={() => setShowFacilityForm(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Facilities list */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {facilities.length === 0 ? (
              <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
                No facilities yet
              </div>
            ) : (
              facilities.map((facility) => (
                <div key={facility.id} className="bg-white rounded-lg border border-gray-200 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{facility.name}</h4>
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                          {facility.facility_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        <MapPin className="h-3.5 w-3.5 inline mr-1" />
                        {facility.full_address}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteFacility(facility.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    {facility.contact_name && (
                      <div className="text-gray-600">
                        <Users className="h-3.5 w-3.5 inline mr-1" />
                        {facility.contact_name}
                      </div>
                    )}
                    {facility.contact_phone && (
                      <div className="text-gray-600">
                        <Phone className="h-3.5 w-3.5 inline mr-1" />
                        {facility.contact_phone}
                      </div>
                    )}
                    {facility.dock_hours && (
                      <div className="text-gray-600">
                        <Clock className="h-3.5 w-3.5 inline mr-1" />
                        {facility.dock_hours}
                      </div>
                    )}
                  </div>
                  {facility.special_instructions && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-100 rounded text-xs text-amber-800">
                      {facility.special_instructions}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'playbooks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Pricing Playbooks ({playbooks.length})
            </h3>
            <button
              onClick={() => setShowPlaybookForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Playbook
            </button>
          </div>

          {/* Playbook form modal */}
          {showPlaybookForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b">
                  <h2 className="text-lg font-semibold">Add Pricing Playbook</h2>
                  <button onClick={() => setShowPlaybookForm(false)} className="p-1 text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleCreatePlaybook} className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input type="text" required value={playbookForm.name}
                      onChange={(e) => setPlaybookForm({ ...playbookForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Origin State</label>
                      <input type="text" placeholder="e.g. TX" value={playbookForm.origin_state}
                        onChange={(e) => setPlaybookForm({ ...playbookForm, origin_state: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dest State</label>
                      <input type="text" placeholder="e.g. CA" value={playbookForm.dest_state}
                        onChange={(e) => setPlaybookForm({ ...playbookForm, dest_state: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Equipment</label>
                      <select value={playbookForm.equipment_type}
                        onChange={(e) => setPlaybookForm({ ...playbookForm, equipment_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Any</option>
                        <option value="van">Van</option>
                        <option value="reefer">Reefer</option>
                        <option value="flatbed">Flatbed</option>
                        <option value="step_deck">Step Deck</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Base Rate (cents)</label>
                      <input type="number" value={playbookForm.base_rate}
                        onChange={(e) => setPlaybookForm({ ...playbookForm, base_rate: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Surcharge %</label>
                      <input type="number" step="0.1" value={playbookForm.fuel_surcharge_pct}
                        onChange={(e) => setPlaybookForm({ ...playbookForm, fuel_surcharge_pct: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Min Rate (cents)</label>
                      <input type="number" value={playbookForm.min_rate}
                        onChange={(e) => setPlaybookForm({ ...playbookForm, min_rate: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Rate (cents)</label>
                      <input type="number" value={playbookForm.max_rate}
                        onChange={(e) => setPlaybookForm({ ...playbookForm, max_rate: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea rows={2} value={playbookForm.notes}
                      onChange={(e) => setPlaybookForm({ ...playbookForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                      Add Playbook
                    </button>
                    <button type="button" onClick={() => setShowPlaybookForm(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Playbooks table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {playbooks.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No pricing playbooks yet</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lane</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Equipment</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Base Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Min</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Max</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">FSC</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {playbooks.map((pb) => (
                    <tr key={pb.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{pb.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {pb.origin_state || '*'} &rarr; {pb.dest_state || '*'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{pb.equipment_type || 'Any'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(pb.base_rate)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatCurrency(pb.min_rate)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatCurrency(pb.max_rate)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{pb.fuel_surcharge_pct}%</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          pb.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {pb.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeletePlaybook(pb.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'shipments' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Shipment History ({shipments.length})
          </h3>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {shipments.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No shipments yet</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipment #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origin</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margin %</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {shipments.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/shipments/${s.id}`)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-emerald-600">{s.shipment_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {s.origin_city ? `${s.origin_city}, ${s.origin_state}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {s.destination_city ? `${s.destination_city}, ${s.destination_state}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          s.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          s.status === 'in_transit' ? 'bg-yellow-100 text-yellow-700' :
                          s.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {s.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(s.customer_price)}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={s.margin_percent >= 15 ? 'text-emerald-600' : s.margin_percent >= 10 ? 'text-amber-600' : 'text-red-600'}>
                          {s.margin_percent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
