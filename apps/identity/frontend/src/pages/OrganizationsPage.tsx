import { useEffect, useState } from 'react'
import { organizationsApi, Organization, setOrganizationId, getOrganizationId } from '../services/api'

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(getOrganizationId())

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form data
  const [formData, setFormData] = useState({ name: '', slug: '' })

  useEffect(() => {
    loadOrganizations()
  }, [])

  const loadOrganizations = async () => {
    setLoading(true)
    try {
      const data = await organizationsApi.list()
      setOrganizations(data)

      // Auto-select first org if none selected
      if (!currentOrgId && data.length > 0) {
        selectOrganization(data[0].id)
      }
    } catch (error) {
      console.error('Failed to load organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectOrganization = (orgId: string) => {
    setOrganizationId(orgId)
    setCurrentOrgId(orgId)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.slug.trim()) return

    setSaving(true)
    try {
      const newOrg = await organizationsApi.create(formData.name.trim(), formData.slug.trim().toLowerCase())
      await loadOrganizations()
      selectOrganization(newOrg.id)
      setShowCreateModal(false)
      setFormData({ name: '', slug: '' })
    } catch (error) {
      console.error('Failed to create organization:', error)
      alert('Failed to create organization. The slug may already be taken.')
    } finally {
      setSaving(false)
    }
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Organizations</h2>
        <button
          onClick={() => {
            setFormData({ name: '', slug: '' })
            setShowCreateModal(true)
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors"
        >
          Create Organization
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-gray-500 text-center">Loading...</div>
        ) : organizations.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 mb-4">No organizations yet.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-blue-600 hover:text-blue-800"
            >
              Create your first organization
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Slug
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {organizations.map((org) => (
                <tr
                  key={org.id}
                  className={`hover:bg-gray-50 ${currentOrgId === org.id ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <p className="font-medium text-gray-900">{org.name}</p>
                      {currentOrgId === org.id && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Current
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {org.slug}
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        org.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {org.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {currentOrgId !== org.id && (
                      <button
                        onClick={() => selectOrganization(org.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Switch to this
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create Organization</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value
                    setFormData({
                      name,
                      slug: formData.slug === generateSlug(formData.name) ? generateSlug(name) : formData.slug,
                    })
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Acme Inc"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., acme-inc"
                  pattern="[a-z0-9-]+"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and hyphens only</p>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
