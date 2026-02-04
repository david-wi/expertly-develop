import { useState } from 'react'
import { User, Bell, Building2, Save, Truck, DollarSign, FileText, Percent } from 'lucide-react'

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'company' | 'defaults'>('profile')
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

          {/* Save Button */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Save className="h-4 w-4" />
              {saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
