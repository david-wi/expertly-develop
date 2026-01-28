import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Building2 } from 'lucide-react'
import { organizationsApi, Organization, TENANT_STORAGE_KEY } from '../api/client'

interface OrganizationSwitcherProps {
  currentTenantId: string | null
  onSwitch: () => void
}

export default function OrganizationSwitcher({ currentTenantId, onSwitch }: OrganizationSwitcherProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentOrg = organizations.find((org) => org.id === currentTenantId) || organizations[0]

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const { items } = await organizationsApi.list()
        setOrganizations(items)
      } catch (error) {
        console.error('Failed to fetch organizations:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchOrganizations()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (org: Organization) => {
    if (org.id === currentTenantId) {
      setIsOpen(false)
      return
    }

    localStorage.setItem(TENANT_STORAGE_KEY, org.id)
    setIsOpen(false)
    onSwitch()
  }

  const handleClearOverride = () => {
    localStorage.removeItem(TENANT_STORAGE_KEY)
    setIsOpen(false)
    onSwitch()
  }

  if (loading) {
    return (
      <div className="px-3 py-2">
        <div className="h-9 bg-theme-bg-elevated rounded-lg animate-pulse" />
      </div>
    )
  }

  if (organizations.length <= 1) {
    return null
  }

  const hasOverride = localStorage.getItem(TENANT_STORAGE_KEY) !== null

  return (
    <div className="px-3 mb-4" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-theme-text-secondary bg-theme-bg-elevated hover:bg-theme-border rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          <Building2 className="w-4 h-4 text-theme-text-muted flex-shrink-0" />
          <span className="truncate">{currentOrg?.name || 'Select Organization'}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-theme-text-muted flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-3 right-3 mt-1 bg-theme-bg-surface border border-theme-border rounded-lg shadow-lg z-50 overflow-hidden">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSelect(org)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-theme-bg-elevated transition-colors ${
                org.id === currentTenantId ? 'bg-primary-50 text-primary-700' : 'text-theme-text-secondary'
              }`}
            >
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{org.name}</span>
              {org.id === currentTenantId && (
                <span className="ml-auto text-xs text-primary-600">Current</span>
              )}
            </button>
          ))}
          {hasOverride && (
            <>
              <div className="border-t border-theme-border-subtle" />
              <button
                onClick={handleClearOverride}
                className="w-full px-3 py-2 text-sm text-left text-theme-text-muted hover:bg-theme-bg-elevated transition-colors"
              >
                Reset to default
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
