import { useState, useRef, useEffect } from 'react'
import { ChevronRight, Building2 } from 'lucide-react'

export interface Organization {
  id: string
  name: string
  is_default?: boolean
}

interface OrgSwitcherProps {
  organizations: Organization[]
  selectedOrgId: string | null
  onOrgChange: (orgId: string) => void
}

export default function OrgSwitcher({ organizations, selectedOrgId, onOrgChange }: OrgSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOrg = organizations.find(o => o.id === selectedOrgId)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Don't show if only one org
  if (organizations.length <= 1) {
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{selectedOrg?.name || 'Select Organization'}</span>
        </div>
        <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => {
                if (org.id !== selectedOrgId) {
                  onOrgChange(org.id)
                }
                setIsOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${
                org.id === selectedOrgId ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
              }`}
            >
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{org.name}</span>
              {org.is_default && (
                <span className="ml-auto text-xs text-gray-400">Default</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
