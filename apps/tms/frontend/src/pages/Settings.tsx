import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User,
  Bell,
  Building2,
  Save,
  Truck,
  DollarSign,
  FileText,
  Percent,
  Link2,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  ArrowRightLeft,
  Plus,
  Trash2,
  Clock,
  Search,
  Users,
} from 'lucide-react'
import { api } from '../services/api'
import { SYNC_STATUS_LABELS } from '../types'

type TabType = 'profile' | 'notifications' | 'company' | 'defaults' | 'integrations'

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [saved, setSaved] = useState(false)

  const [profile, setProfile] = useState({
    name: 'User',
    email: 'user@example.com',
    phone: '',
  })

  const [notifications, setNotifications] = useState({
    emailNewQuoteRequest: true,
    emailShipmentUpdate: true,
    emailExceptions: true,
    emailInvoicePaid: false,
    emailCarrierTenderResponse: true,
    emailDailyDigest: false,
  })

  const [company, setCompany] = useState({
    name: 'Your Brokerage',
    mc_number: '',
    dot_number: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    email: '',
    billing_email: '',
  })

  const [defaults, setDefaults] = useState({
    default_equipment_type: 'dry_van',
    default_margin_percent: 15,
    auto_suggest_carriers: true,
    auto_extract_emails: true,
    invoice_payment_terms: 30,
    default_accessorial_detention: 75,
    default_accessorial_layover: 350,
  })

  const handleSave = () => {
    // In a real app, this would save to the backend
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your account and brokerage preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-52 space-y-1">
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'company', label: 'Company Info', icon: Building2 },
            { id: 'defaults', label: 'Defaults', icon: Truck },
            { id: 'integrations', label: 'Integrations', icon: Link2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-lg border border-gray-200 p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Profile Settings</h2>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Notification Preferences</h2>
              <div className="space-y-4 max-w-md">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={notifications.emailNewQuoteRequest}
                    onChange={(e) => setNotifications({ ...notifications, emailNewQuoteRequest: e.target.checked })}
                    className="h-4 w-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Email me for new quote requests</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={notifications.emailShipmentUpdate}
                    onChange={(e) => setNotifications({ ...notifications, emailShipmentUpdate: e.target.checked })}
                    className="h-4 w-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Email me for shipment status updates</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={notifications.emailExceptions}
                    onChange={(e) => setNotifications({ ...notifications, emailExceptions: e.target.checked })}
                    className="h-4 w-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Email me for shipment exceptions</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={notifications.emailCarrierTenderResponse}
                    onChange={(e) => setNotifications({ ...notifications, emailCarrierTenderResponse: e.target.checked })}
                    className="h-4 w-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Email me when carriers respond to tenders</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={notifications.emailInvoicePaid}
                    onChange={(e) => setNotifications({ ...notifications, emailInvoicePaid: e.target.checked })}
                    className="h-4 w-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Email me when invoices are paid</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={notifications.emailDailyDigest}
                    onChange={(e) => setNotifications({ ...notifications, emailDailyDigest: e.target.checked })}
                    className="h-4 w-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Send daily digest email</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'company' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Company Information</h2>
              <p className="text-sm text-gray-500">This information appears on quotes and invoices.</p>
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={company.name}
                    onChange={(e) => setCompany({ ...company, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      MC Number
                    </label>
                    <input
                      type="text"
                      value={company.mc_number}
                      onChange={(e) => setCompany({ ...company, mc_number: e.target.value })}
                      placeholder="MC-123456"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      DOT Number
                    </label>
                    <input
                      type="text"
                      value={company.dot_number}
                      onChange={(e) => setCompany({ ...company, dot_number: e.target.value })}
                      placeholder="1234567"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={company.address}
                    onChange={(e) => setCompany({ ...company, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={company.city}
                      onChange={(e) => setCompany({ ...company, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={company.state}
                      onChange={(e) => setCompany({ ...company, state: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP
                    </label>
                    <input
                      type="text"
                      value={company.zip}
                      onChange={(e) => setCompany({ ...company, zip: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={company.phone}
                      onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={company.email}
                      onChange={(e) => setCompany({ ...company, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Billing Email
                  </label>
                  <input
                    type="email"
                    value={company.billing_email}
                    onChange={(e) => setCompany({ ...company, billing_email: e.target.value })}
                    placeholder="billing@yourcompany.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Invoices will be sent from this address</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'defaults' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Default Settings</h2>
              <p className="text-sm text-gray-500">Configure default values used when creating quotes and shipments.</p>

              <div className="space-y-6 max-w-lg">
                {/* Equipment */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <Truck className="h-4 w-4 text-emerald-600" />
                    Equipment
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Equipment Type
                    </label>
                    <select
                      value={defaults.default_equipment_type}
                      onChange={(e) => setDefaults({ ...defaults, default_equipment_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="dry_van">Dry Van</option>
                      <option value="reefer">Reefer</option>
                      <option value="flatbed">Flatbed</option>
                      <option value="step_deck">Step Deck</option>
                      <option value="power_only">Power Only</option>
                    </select>
                  </div>
                </div>

                {/* Pricing */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    Pricing
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Default Margin %
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={defaults.default_margin_percent}
                          onChange={(e) => setDefaults({ ...defaults, default_margin_percent: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">Applied when auto-calculating quotes</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Detention (per hour)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="number"
                            min="0"
                            value={defaults.default_accessorial_detention}
                            onChange={(e) => setDefaults({ ...defaults, default_accessorial_detention: parseInt(e.target.value) || 0 })}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Layover (per day)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="number"
                            min="0"
                            value={defaults.default_accessorial_layover}
                            onChange={(e) => setDefaults({ ...defaults, default_accessorial_layover: parseInt(e.target.value) || 0 })}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Invoicing */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    Invoicing
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Terms (days)
                    </label>
                    <select
                      value={defaults.invoice_payment_terms}
                      onChange={(e) => setDefaults({ ...defaults, invoice_payment_terms: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value={15}>Net 15</option>
                      <option value={30}>Net 30</option>
                      <option value={45}>Net 45</option>
                      <option value={60}>Net 60</option>
                    </select>
                  </div>
                </div>

                {/* AI Features */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">AI Features</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={defaults.auto_suggest_carriers}
                        onChange={(e) => setDefaults({ ...defaults, auto_suggest_carriers: e.target.checked })}
                        className="h-4 w-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-700">Auto-suggest carriers for new shipments</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={defaults.auto_extract_emails}
                        onChange={(e) => setDefaults({ ...defaults, auto_extract_emails: e.target.checked })}
                        className="h-4 w-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-700">Auto-extract details from pasted emails</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && <IntegrationsTab />}

          {/* Save Button */}
          {activeTab !== 'integrations' && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Save className="h-4 w-4" />
                {saved ? 'Saved!' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Integrations Tab Component
function IntegrationsTab() {
  const queryClient = useQueryClient()

  const { data: connection, isLoading: loadingConnection } = useQuery({
    queryKey: ['accounting-connection'],
    queryFn: () => api.getAccountingConnection(),
  })

  const { data: syncJobs } = useQuery({
    queryKey: ['sync-jobs'],
    queryFn: () => api.getSyncJobs({ limit: 5 }),
    enabled: connection?.is_connected,
  })

  const connectMutation = useMutation({
    mutationFn: () => api.getQuickBooksAuthUrl(),
    onSuccess: (data) => {
      // Redirect to QuickBooks OAuth
      window.location.href = data.url
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: () => api.disconnectQuickBooks(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-connection'] })
    },
  })

  const syncMutation = useMutation({
    mutationFn: (fullSync: boolean) => api.triggerAccountingSync({ full_sync: fullSync }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-jobs'] })
    },
  })

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.updateAccountingSettings>[0]) =>
      api.updateAccountingSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-connection'] })
    },
  })

  if (loadingConnection) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Integrations</h2>
      <p className="text-sm text-gray-500">
        Connect your accounting software to automatically sync customers, invoices, and payments.
      </p>

      {/* QuickBooks Card */}
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-green-600 font-bold text-lg">QB</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">QuickBooks Online</h3>
              <p className="text-sm text-gray-500">Sync customers, invoices, and payments</p>
            </div>
          </div>

          {connection?.is_connected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
              <CheckCircle className="w-3.5 h-3.5" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              <XCircle className="w-3.5 h-3.5" />
              Not Connected
            </span>
          )}
        </div>

        {connection?.is_connected ? (
          <div className="mt-6 space-y-6">
            {/* Connection Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Company:</span>
                  <span className="ml-2 font-medium">{connection.company_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Last Sync:</span>
                  <span className="ml-2 font-medium">
                    {connection.last_sync_at
                      ? new Date(connection.last_sync_at).toLocaleString()
                      : 'Never'}
                  </span>
                </div>
              </div>
            </div>

            {/* Sync Settings */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Sync Settings</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={connection.auto_sync_enabled}
                    onChange={(e) =>
                      updateSettingsMutation.mutate({ auto_sync_enabled: e.target.checked })
                    }
                    className="h-4 w-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Enable automatic sync</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={connection.sync_customers}
                    onChange={(e) =>
                      updateSettingsMutation.mutate({ sync_customers: e.target.checked })
                    }
                    className="h-4 w-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Sync customers</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={connection.sync_invoices}
                    onChange={(e) =>
                      updateSettingsMutation.mutate({ sync_invoices: e.target.checked })
                    }
                    className="h-4 w-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Sync invoices</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={connection.sync_vendors}
                    onChange={(e) =>
                      updateSettingsMutation.mutate({ sync_vendors: e.target.checked })
                    }
                    className="h-4 w-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Sync carriers as vendors</span>
                </label>
              </div>
            </div>

            {/* Sync Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => syncMutation.mutate(false)}
                disabled={syncMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {syncMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Sync Now
              </button>
              <button
                onClick={() => syncMutation.mutate(true)}
                disabled={syncMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Full Sync
              </button>
              <button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="ml-auto text-sm text-red-600 hover:text-red-700"
              >
                Disconnect
              </button>
            </div>

            {/* Recent Sync Jobs */}
            {syncJobs && syncJobs.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Syncs</h4>
                <div className="space-y-2">
                  {syncJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-3">
                        {job.status === 'completed' && (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        )}
                        {job.status === 'failed' && (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        {job.status === 'in_progress' && (
                          <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                        )}
                        {job.status === 'partial' && (
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className="text-gray-700">
                          {SYNC_STATUS_LABELS[job.status as keyof typeof SYNC_STATUS_LABELS]}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-gray-500">
                        <span>
                          {job.synced_count} synced
                          {job.failed_count > 0 && `, ${job.failed_count} failed`}
                        </span>
                        <span>
                          {new Date(job.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6">
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {connectMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              Connect to QuickBooks
            </button>
            <p className="mt-2 text-xs text-gray-500">
              You'll be redirected to QuickBooks to authorize the connection.
            </p>
          </div>
        )}
      </div>

      {/* QuickBooks Sync Dashboard */}
      {connection?.is_connected && <QuickBooksSyncDashboard />}

      {/* Customer Mapping */}
      {connection?.is_connected && <CustomerMappingSection />}

      {/* Future Integrations */}
      <div className="border border-gray-200 rounded-lg p-6 opacity-60">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
            <span className="text-gray-400 font-bold">X</span>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Xero</h3>
            <p className="text-sm text-gray-500">Coming soon</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// QuickBooks Sync Dashboard Component
function QuickBooksSyncDashboard() {
  const { data: syncStatus, isLoading } = useQuery({
    queryKey: ['qb-sync-status'],
    queryFn: () => api.quickbooksSyncStatus(),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const syncInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => api.quickbooksSyncInvoice(invoiceId),
  })

  const [invoiceIdToSync, setInvoiceIdToSync] = useState('')

  if (isLoading) {
    return (
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-gray-100 rounded" />
            <div className="h-20 bg-gray-100 rounded" />
            <div className="h-20 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
          QuickBooks Sync Dashboard
        </h3>
        {syncStatus?.last_sync_at && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last sync: {new Date(syncStatus.last_sync_at).toLocaleString()}
          </span>
        )}
      </div>

      {/* Sync Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-emerald-50 rounded-lg p-4">
          <p className="text-xs font-medium text-emerald-600 uppercase">Synced Invoices</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">
            {syncStatus?.synced_invoices ?? 0}
          </p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-xs font-medium text-blue-600 uppercase">Pending</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">
            {syncStatus?.pending_invoices ?? 0}
          </p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-xs font-medium text-red-600 uppercase">Failed</p>
          <p className="text-2xl font-bold text-red-700 mt-1">
            {syncStatus?.failed_invoices ?? 0}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-600 uppercase">Total Amount</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">
            ${syncStatus?.total_synced_amount?.toLocaleString() ?? '0'}
          </p>
        </div>
      </div>

      {/* Manual Invoice Sync */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Sync Individual Invoice</h4>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={invoiceIdToSync}
            onChange={(e) => setInvoiceIdToSync(e.target.value)}
            placeholder="Enter Invoice ID"
            className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <button
            onClick={() => {
              if (invoiceIdToSync.trim()) {
                syncInvoiceMutation.mutate(invoiceIdToSync.trim())
                setInvoiceIdToSync('')
              }
            }}
            disabled={!invoiceIdToSync.trim() || syncInvoiceMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {syncInvoiceMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRightLeft className="w-4 h-4" />
            )}
            Sync to QB
          </button>
        </div>
        {syncInvoiceMutation.isSuccess && (
          <p className="mt-2 text-sm text-emerald-600 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            Invoice synced successfully
          </p>
        )}
        {syncInvoiceMutation.isError && (
          <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
            <XCircle className="w-4 h-4" />
            Sync failed: {syncInvoiceMutation.error?.message || 'Unknown error'}
          </p>
        )}
      </div>

      {/* Recent Synced Invoices */}
      {syncStatus?.recent_syncs && syncStatus.recent_syncs.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Recently Synced</h4>
          <div className="space-y-2">
            {syncStatus.recent_syncs.map((sync: { invoice_id: string; status: string; synced_at: string; amount?: number }, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
              >
                <div className="flex items-center gap-3">
                  {sync.status === 'synced' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : sync.status === 'failed' ? (
                    <XCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                  )}
                  <span className="font-medium">Invoice #{sync.invoice_id}</span>
                </div>
                <div className="flex items-center gap-4 text-gray-500">
                  {sync.amount && <span>${sync.amount.toLocaleString()}</span>}
                  <span>{new Date(sync.synced_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Customer Mapping Section Component
function CustomerMappingSection() {
  const queryClient = useQueryClient()

  const { data: mappings, isLoading } = useQuery({
    queryKey: ['qb-customer-mappings'],
    queryFn: () => api.quickbooksGetCustomerMappings(),
  })

  const createMappingMutation = useMutation({
    mutationFn: (data: { tms_customer_id: string; tms_customer_name: string; quickbooks_customer_id: string; quickbooks_customer_name: string }) =>
      api.quickbooksCreateCustomerMapping(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qb-customer-mappings'] })
      setNewMapping({ tms_customer_id: '', tms_customer_name: '', quickbooks_customer_id: '', quickbooks_customer_name: '' })
      setShowAddForm(false)
    },
  })

  const [showAddForm, setShowAddForm] = useState(false)
  const [newMapping, setNewMapping] = useState({
    tms_customer_id: '',
    tms_customer_name: '',
    quickbooks_customer_id: '',
    quickbooks_customer_name: '',
  })
  const [searchTerm, setSearchTerm] = useState('')

  const filteredMappings = (mappings ?? []).filter((m: { tms_customer_name?: string; quickbooks_customer_name?: string }) =>
    !searchTerm ||
    m.tms_customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.quickbooks_customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="border border-gray-200 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-600" />
          Customer Mapping
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Mapping
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Map TMS customers to their QuickBooks counterparts for seamless invoice syncing.
      </p>

      {/* Add Mapping Form */}
      {showAddForm && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4 border border-gray-200">
          <h4 className="text-sm font-medium text-gray-900">New Customer Mapping</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">TMS Customer ID</label>
              <input
                type="text"
                value={newMapping.tms_customer_id}
                onChange={(e) => setNewMapping({ ...newMapping, tms_customer_id: e.target.value })}
                placeholder="TMS customer ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">TMS Customer Name</label>
              <input
                type="text"
                value={newMapping.tms_customer_name}
                onChange={(e) => setNewMapping({ ...newMapping, tms_customer_name: e.target.value })}
                placeholder="Customer name in TMS"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">QuickBooks Customer ID</label>
              <input
                type="text"
                value={newMapping.quickbooks_customer_id}
                onChange={(e) => setNewMapping({ ...newMapping, quickbooks_customer_id: e.target.value })}
                placeholder="QuickBooks customer ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">QuickBooks Customer Name</label>
              <input
                type="text"
                value={newMapping.quickbooks_customer_name}
                onChange={(e) => setNewMapping({ ...newMapping, quickbooks_customer_name: e.target.value })}
                placeholder="Customer name in QuickBooks"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => createMappingMutation.mutate(newMapping)}
              disabled={!newMapping.tms_customer_id || !newMapping.quickbooks_customer_id || createMappingMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {createMappingMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Create Mapping
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search customer mappings..."
          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      {/* Mappings Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading mappings...</div>
      ) : filteredMappings.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          {searchTerm ? 'No mappings match your search' : 'No customer mappings created yet. Add a mapping to start syncing invoices.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="pb-2 pr-4">TMS Customer</th>
                <th className="pb-2 pr-4">QuickBooks Customer</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMappings.map((mapping: { id?: string; tms_customer_id: string; tms_customer_name?: string; quickbooks_customer_id: string; quickbooks_customer_name?: string; status?: string; created_at?: string }, idx: number) => (
                <tr key={mapping.id || idx} className="hover:bg-gray-50">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-gray-900">{mapping.tms_customer_name || mapping.tms_customer_id}</div>
                    <div className="text-xs text-gray-400">{mapping.tms_customer_id}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-medium text-gray-900">{mapping.quickbooks_customer_name || mapping.quickbooks_customer_id}</div>
                    <div className="text-xs text-gray-400">{mapping.quickbooks_customer_id}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      mapping.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {mapping.status === 'active' ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <AlertCircle className="w-3 h-3" />
                      )}
                      {mapping.status || 'active'}
                    </span>
                  </td>
                  <td className="py-3 text-gray-500">
                    {mapping.created_at
                      ? new Date(mapping.created_at).toLocaleDateString()
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

