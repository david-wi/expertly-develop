/**
 * TenantSettings page -- organization-level configuration.
 *
 * Sections:
 *   1. Company Information (name, timezone, currency)
 *   2. Numbering Configuration (shipment prefix, auto-numbering)
 *   3. Branding (logo upload placeholder, primary color)
 *   4. Custom Fields
 *   5. User Management (list, invite, remove)
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Building2,
  Hash,
  Palette,
  Users,
  Settings,
  Save,
  Plus,
  Trash2,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react'
import { useOutletContext } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LayoutOutletContext {
  selectedOrgId: string | null
}

interface TenantSettingsData {
  id?: string
  org_id: string
  company_name?: string | null
  timezone: string
  currency: string
  date_format: string
  shipment_number_prefix: string
  auto_numbering: boolean
  default_equipment_type: string
  custom_fields: Record<string, string>
  branding: {
    logo_url?: string | null
    primary_color?: string
    secondary_color?: string
    company_name?: string | null
    favicon_url?: string | null
    custom_domain?: string | null
    email_header_logo_url?: string | null
    portal_title?: string | null
    hide_powered_by?: boolean
  }
}

interface TenantUser {
  id: string
  email: string
  name?: string | null
  role?: string | null
  joined_at?: string | null
}

type TabType = 'company' | 'numbering' | 'branding' | 'custom-fields' | 'users'

// ---------------------------------------------------------------------------
// Local API helpers (no import from api.ts)
// ---------------------------------------------------------------------------

const TENANT_API = import.meta.env.VITE_API_URL || ''

async function tenantRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${TENANT_API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

// ---------------------------------------------------------------------------
// Timezone and currency options
// ---------------------------------------------------------------------------

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
]

const CURRENCIES = ['USD', 'CAD', 'MXN', 'EUR', 'GBP']

const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']

const EQUIPMENT_TYPES = [
  { value: 'dry_van', label: 'Dry Van' },
  { value: 'reefer', label: 'Reefer' },
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'step_deck', label: 'Step Deck' },
  { value: 'ltl', label: 'LTL' },
  { value: 'intermodal', label: 'Intermodal' },
  { value: 'power_only', label: 'Power Only' },
]

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

const TABS: { key: TabType; label: string; icon: typeof Building2 }[] = [
  { key: 'company', label: 'Company', icon: Building2 },
  { key: 'numbering', label: 'Numbering', icon: Hash },
  { key: 'branding', label: 'Branding', icon: Palette },
  { key: 'custom-fields', label: 'Custom Fields', icon: Settings },
  { key: 'users', label: 'Users', icon: Users },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TenantSettings() {
  const context = useOutletContext<LayoutOutletContext>()
  const orgId = context?.selectedOrgId ?? null

  const [activeTab, setActiveTab] = useState<TabType>('company')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Settings state
  const [settings, setSettings] = useState<TenantSettingsData>({
    org_id: '',
    company_name: '',
    timezone: 'America/New_York',
    currency: 'USD',
    date_format: 'MM/DD/YYYY',
    shipment_number_prefix: 'SHP',
    auto_numbering: true,
    default_equipment_type: 'dry_van',
    custom_fields: {},
    branding: {
      logo_url: null,
      primary_color: '#3B82F6',
      secondary_color: '#10B981',
      company_name: null,
      favicon_url: null,
      custom_domain: null,
      email_header_logo_url: null,
      portal_title: null,
      hide_powered_by: false,
    },
  })

  // Users state
  const [users, setUsers] = useState<TenantUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)

  // Custom fields state
  const [newFieldKey, setNewFieldKey] = useState('')
  const [newFieldValue, setNewFieldValue] = useState('')

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const orgHeaders = useCallback((): Record<string, string> => {
    if (!orgId) return {}
    return { 'X-Organization-Id': orgId }
  }, [orgId])

  const fetchSettings = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    try {
      const data = await tenantRequest<TenantSettingsData>(
        '/api/v1/tenant/settings',
        { headers: orgHeaders() },
      )
      setSettings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [orgId, orgHeaders])

  const fetchUsers = useCallback(async () => {
    if (!orgId) return
    setUsersLoading(true)
    try {
      const data = await tenantRequest<TenantUser[]>(
        '/api/v1/tenant/users',
        { headers: orgHeaders() },
      )
      setUsers(data)
    } catch {
      // Users fetch failure is non-critical
    } finally {
      setUsersLoading(false)
    }
  }, [orgId, orgHeaders])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers()
    }
  }, [activeTab, fetchUsers])

  // ---------------------------------------------------------------------------
  // Save handler
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)
    setSaved(false)
    setError(null)

    try {
      const data = await tenantRequest<TenantSettingsData>(
        '/api/v1/tenant/settings',
        {
          method: 'PUT',
          headers: orgHeaders(),
          body: JSON.stringify({
            company_name: settings.company_name,
            timezone: settings.timezone,
            currency: settings.currency,
            date_format: settings.date_format,
            shipment_number_prefix: settings.shipment_number_prefix,
            auto_numbering: settings.auto_numbering,
            default_equipment_type: settings.default_equipment_type,
            custom_fields: settings.custom_fields,
            branding: settings.branding,
          }),
        },
      )
      setSettings(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Invite handler
  // ---------------------------------------------------------------------------

  const handleInvite = async () => {
    if (!orgId || !inviteEmail.trim()) return
    setInviting(true)
    try {
      await tenantRequest('/api/v1/tenant/invite', {
        method: 'POST',
        headers: orgHeaders(),
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      setInviteEmail('')
      setInviteRole('member')
      fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Custom field handlers
  // ---------------------------------------------------------------------------

  const addCustomField = () => {
    if (!newFieldKey.trim()) return
    setSettings(prev => ({
      ...prev,
      custom_fields: {
        ...prev.custom_fields,
        [newFieldKey.trim()]: newFieldValue,
      },
    }))
    setNewFieldKey('')
    setNewFieldValue('')
  }

  const removeCustomField = (key: string) => {
    setSettings(prev => {
      const updated = { ...prev.custom_fields }
      delete updated[key]
      return { ...prev, custom_fields: updated }
    })
  }

  // ---------------------------------------------------------------------------
  // No org selected
  // ---------------------------------------------------------------------------

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900">No Organization Selected</h2>
          <p className="mt-1 text-sm text-gray-500">
            Select an organization from the sidebar to manage its settings.
          </p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage settings for your organization
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* ----------------------------------------------------------------- */}
          {/* Company Information Tab */}
          {/* ----------------------------------------------------------------- */}
          {activeTab === 'company' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Company Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={settings.company_name || ''}
                    onChange={e => setSettings(prev => ({ ...prev, company_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Your Company Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Timezone
                  </label>
                  <select
                    value={settings.timezone}
                    onChange={e => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {TIMEZONES.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={settings.currency}
                    onChange={e => setSettings(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Format
                  </label>
                  <select
                    value={settings.date_format}
                    onChange={e => setSettings(prev => ({ ...prev, date_format: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {DATE_FORMATS.map(df => (
                      <option key={df} value={df}>{df}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Equipment Type
                  </label>
                  <select
                    value={settings.default_equipment_type}
                    onChange={e => setSettings(prev => ({ ...prev, default_equipment_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {EQUIPMENT_TYPES.map(eq => (
                      <option key={eq.value} value={eq.value}>{eq.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* Numbering Configuration Tab */}
          {/* ----------------------------------------------------------------- */}
          {activeTab === 'numbering' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Numbering Configuration</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shipment Number Prefix
                  </label>
                  <input
                    type="text"
                    value={settings.shipment_number_prefix}
                    onChange={e => setSettings(prev => ({ ...prev, shipment_number_prefix: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="SHP"
                    maxLength={10}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Example: {settings.shipment_number_prefix}-2024-001
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.auto_numbering}
                      onChange={e => setSettings(prev => ({ ...prev, auto_numbering: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Auto-numbering</span>
                    <p className="text-xs text-gray-500">
                      Automatically assign sequential numbers to new shipments and quotes
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* Branding Tab (White-Label Settings) */}
          {/* ----------------------------------------------------------------- */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              {/* Logo & Visual Identity */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900">Visual Identity</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Company Logo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Logo
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      {settings.branding.logo_url ? (
                        <div className="space-y-2">
                          <img
                            src={settings.branding.logo_url}
                            alt="Company logo"
                            className="mx-auto max-h-16 object-contain"
                          />
                          <button
                            onClick={() => setSettings(prev => ({
                              ...prev,
                              branding: { ...prev.branding, logo_url: null },
                            }))}
                            className="text-xs text-red-600 hover:text-red-700"
                          >
                            Remove logo
                          </button>
                        </div>
                      ) : (
                        <div>
                          <Palette className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">
                            Logo upload coming soon
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            PNG, JPG up to 2MB
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Favicon */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Favicon URL
                    </label>
                    <input
                      type="text"
                      value={settings.branding.favicon_url || ''}
                      onChange={e => setSettings(prev => ({
                        ...prev,
                        branding: { ...prev.branding, favicon_url: e.target.value || null },
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://example.com/favicon.ico"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      URL to your custom favicon (ICO, PNG, or SVG)
                    </p>
                  </div>

                  {/* Email Header Logo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Header Logo URL
                    </label>
                    <input
                      type="text"
                      value={settings.branding.email_header_logo_url || ''}
                      onChange={e => setSettings(prev => ({
                        ...prev,
                        branding: { ...prev.branding, email_header_logo_url: e.target.value || null },
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://example.com/email-logo.png"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Logo displayed in email headers and notifications
                    </p>
                  </div>
                </div>
              </div>

              {/* Colors */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900">Brand Colors</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Primary color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settings.branding.primary_color || '#3B82F6'}
                        onChange={e => setSettings(prev => ({
                          ...prev,
                          branding: { ...prev.branding, primary_color: e.target.value },
                        }))}
                        className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.branding.primary_color || '#3B82F6'}
                        onChange={e => setSettings(prev => ({
                          ...prev,
                          branding: { ...prev.branding, primary_color: e.target.value },
                        }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="#3B82F6"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Used for buttons, links, and primary actions
                    </p>
                  </div>

                  {/* Secondary color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Secondary Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settings.branding.secondary_color || '#10B981'}
                        onChange={e => setSettings(prev => ({
                          ...prev,
                          branding: { ...prev.branding, secondary_color: e.target.value },
                        }))}
                        className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.branding.secondary_color || '#10B981'}
                        onChange={e => setSettings(prev => ({
                          ...prev,
                          branding: { ...prev.branding, secondary_color: e.target.value },
                        }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="#10B981"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Used for success states, accents, and secondary elements
                    </p>
                  </div>
                </div>

                {/* Color Preview */}
                <div className="p-4 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-3">Color Preview</p>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <div
                        className="h-10 rounded-lg"
                        style={{ backgroundColor: settings.branding.primary_color || '#3B82F6' }}
                      />
                      <p className="text-xs text-gray-400 mt-1 text-center">Primary</p>
                    </div>
                    <div className="flex-1">
                      <div
                        className="h-10 rounded-lg"
                        style={{ backgroundColor: settings.branding.secondary_color || '#10B981' }}
                      />
                      <p className="text-xs text-gray-400 mt-1 text-center">Secondary</p>
                    </div>
                    <div className="flex-1">
                      <div className="h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: settings.branding.primary_color || '#3B82F6' }}
                        >
                          {settings.branding.company_name || settings.company_name || 'Your Brand'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 text-center">Brand Text</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Portal & Domain Settings */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900">Portal Settings</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Portal Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Portal Title
                    </label>
                    <input
                      type="text"
                      value={settings.branding.portal_title || ''}
                      onChange={e => setSettings(prev => ({
                        ...prev,
                        branding: { ...prev.branding, portal_title: e.target.value || null },
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="My Logistics Portal"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Displayed in the browser tab and portal header
                    </p>
                  </div>

                  {/* Branding Company Name Override */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Branded Company Name
                    </label>
                    <input
                      type="text"
                      value={settings.branding.company_name || ''}
                      onChange={e => setSettings(prev => ({
                        ...prev,
                        branding: { ...prev.branding, company_name: e.target.value || null },
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Override company name for branding"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Overrides the company name in customer-facing pages
                    </p>
                  </div>

                  {/* Custom Domain */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Domain
                    </label>
                    <input
                      type="text"
                      value={settings.branding.custom_domain || ''}
                      onChange={e => setSettings(prev => ({
                        ...prev,
                        branding: { ...prev.branding, custom_domain: e.target.value || null },
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="tms.yourdomain.com"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Use your own domain for the customer tracking portal
                    </p>
                  </div>

                  {/* Hide Powered By */}
                  <div className="flex items-center gap-3 pt-6">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.branding.hide_powered_by ?? false}
                        onChange={e => setSettings(prev => ({
                          ...prev,
                          branding: { ...prev.branding, hide_powered_by: e.target.checked },
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Hide "Powered by" badge</span>
                      <p className="text-xs text-gray-500">
                        Remove the Expertly TMS branding from your customer-facing portal
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* White-Label Preview */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Branding Preview</h2>
                <p className="text-sm text-gray-500">
                  Preview of how your branded portal will appear to customers.
                </p>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Mock header */}
                  <div
                    className="px-6 py-3 flex items-center justify-between"
                    style={{ backgroundColor: settings.branding.primary_color || '#3B82F6' }}
                  >
                    <div className="flex items-center gap-3">
                      {settings.branding.logo_url ? (
                        <img src={settings.branding.logo_url} alt="Logo" className="h-8 object-contain" />
                      ) : (
                        <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <span className="text-white font-semibold text-sm">
                        {settings.branding.portal_title || settings.branding.company_name || settings.company_name || 'Your Portal'}
                      </span>
                    </div>
                    <div className="text-white/60 text-xs">Customer Portal</div>
                  </div>
                  {/* Mock body */}
                  <div className="p-6 bg-gray-50">
                    <div className="bg-white rounded-lg p-4 border border-gray-100">
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: settings.branding.secondary_color || '#10B981' }}
                        />
                        <span className="text-sm font-medium text-gray-700">Shipment SHP-2024-001</span>
                        <span
                          className="ml-auto text-xs px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: settings.branding.secondary_color || '#10B981' }}
                        >
                          In Transit
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        Chicago, IL → Los Angeles, CA
                      </div>
                    </div>
                    {!settings.branding.hide_powered_by && (
                      <p className="text-center text-xs text-gray-300 mt-4">
                        Powered by Expertly TMS
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* Custom Fields Tab */}
          {/* ----------------------------------------------------------------- */}
          {activeTab === 'custom-fields' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Custom Fields</h2>
              <p className="text-sm text-gray-500">
                Define custom fields that will be available across your shipments and quotes.
              </p>

              {/* Existing fields */}
              {Object.entries(settings.custom_fields).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(settings.custom_fields).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm font-medium text-gray-700 min-w-[120px]">
                        {key}
                      </span>
                      <span className="text-sm text-gray-500 flex-1">
                        {String(value)}
                      </span>
                      <button
                        onClick={() => removeCustomField(key)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-gray-400">
                  No custom fields defined yet
                </div>
              )}

              {/* Add new field */}
              <div className="flex items-end gap-3 pt-4 border-t border-gray-200">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Field Name
                  </label>
                  <input
                    type="text"
                    value={newFieldKey}
                    onChange={e => setNewFieldKey(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. department"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Default Value
                  </label>
                  <input
                    type="text"
                    value={newFieldValue}
                    onChange={e => setNewFieldValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. logistics"
                  />
                </div>
                <button
                  onClick={addCustomField}
                  disabled={!newFieldKey.trim()}
                  className="inline-flex items-center gap-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* Users Tab */}
          {/* ----------------------------------------------------------------- */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Invite form */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Invite User</h2>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="user@example.com"
                      />
                    </div>
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Role
                    </label>
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {inviting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Invite
                  </button>
                </div>
              </div>

              {/* Users list */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Members ({users.length})
                  </h2>
                  <button
                    onClick={fetchUsers}
                    disabled={usersLoading}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${usersLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {usersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-12 text-sm text-gray-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No members found. Invite users to get started.
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Email</th>
                        <th className="px-6 py-3">Role</th>
                        <th className="px-6 py-3">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {users.map(user => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 text-sm text-gray-900">
                            {user.name || '-'}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-600">
                            {user.email}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              user.role === 'admin'
                                ? 'bg-purple-100 text-purple-700'
                                : user.role === 'viewer'
                                  ? 'bg-gray-100 text-gray-700'
                                  : 'bg-blue-100 text-blue-700'
                            }`}>
                              {user.role || 'member'}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-500">
                            {user.joined_at
                              ? new Date(user.joined_at).toLocaleDateString()
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
