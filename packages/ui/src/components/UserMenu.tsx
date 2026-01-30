import { useRef, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { ChevronRight, User, AlertTriangle, FileText, LogOut, Wrench, Lightbulb, ClipboardList, Info, Building2, FlaskConical, Activity } from 'lucide-react'

export interface Organization {
  id: string
  name: string
  is_default?: boolean
}

export interface UserMenuItem {
  id: string
  label: string
  icon?: ComponentType<{ className?: string }>
  type: 'link' | 'callback' | 'divider' | 'submenu'
  href?: string
  external?: boolean  // Opens in new tab, bypasses renderLink
  onClick?: () => void
  children?: UserMenuItem[]  // For submenu items
}

export interface UserMenuSection {
  title?: string
  items: UserMenuItem[]
}

export interface UserMenuConfig {
  sections: UserMenuSection[]
  versionInfo?: {
    buildTime?: string
    commit?: string
  }
  organizations?: {
    items: Organization[]
    currentId: string | null
    onSwitch: (orgId: string) => void
    storageKey?: string
  }
}

interface UserMenuProps {
  config: UserMenuConfig
  isOpen: boolean
  onClose: () => void
  renderLink: (props: {
    href: string
    className: string
    children: ReactNode
    onClick?: () => void
  }) => ReactNode
}

export function UserMenu({ config, isOpen, onClose, renderLink }: UserMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [expandedSubmenus, setExpandedSubmenus] = useState<Set<string>>(new Set())

  const toggleSubmenu = (id: string) => {
    setExpandedSubmenus(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const hasVersionInfo = config.versionInfo?.buildTime || config.versionInfo?.commit
  const hasOrganizations = config.organizations && config.organizations.items.length > 1

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-[var(--theme-bg-elevated)] border-2 border-[var(--theme-border-default)] rounded-xl shadow-2xl z-50 ring-1 ring-black/5"
    >
      {/* Version Info Header */}
      {hasVersionInfo && (
        <div className="px-3 py-2 bg-[var(--theme-bg-surface)] border-b border-[var(--theme-border-default)] rounded-t-xl">
          <div className="text-xs text-[var(--theme-text-muted)] font-mono">
            {config.versionInfo?.buildTime && (
              <span>Build: {config.versionInfo.buildTime}</span>
            )}
            {config.versionInfo?.buildTime && config.versionInfo?.commit && (
              <span className="mx-2">·</span>
            )}
            {config.versionInfo?.commit && (
              <span>{config.versionInfo.commit.slice(0, 7)}</span>
            )}
          </div>
        </div>
      )}

      {/* Organization Switcher */}
      {hasOrganizations && (
        <div className="border-b border-[var(--theme-border-default)]">
          <div className="px-3 pt-2 pb-1">
            <span className="text-xs font-medium text-[var(--theme-text-muted)] uppercase tracking-wider">
              Organization
            </span>
          </div>
          <div className="py-1">
            {config.organizations!.items.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  if (org.id !== config.organizations!.currentId) {
                    config.organizations!.onSwitch(org.id)
                  }
                  onClose()
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  org.id === config.organizations!.currentId
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300'
                    : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-surface)] hover:text-[var(--theme-text-primary)]'
                }`}
              >
                <Building2 className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left truncate">{org.name}</span>
                {org.id === config.organizations!.currentId && (
                  <span className="text-xs text-primary-600 dark:text-primary-400">Current</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu Sections */}
      {config.sections.map((section, sectionIndex) => (
        <div key={sectionIndex}>
          {/* Section divider (except for first section) */}
          {sectionIndex > 0 && (
            <div className="border-t border-[var(--theme-border-default)]" />
          )}

          {/* Section title */}
          {section.title && (
            <div className="px-3 pt-2 pb-1">
              <span className="text-xs font-medium text-[var(--theme-text-muted)] uppercase tracking-wider">
                {section.title}
              </span>
            </div>
          )}

          {/* Section items */}
          <div className="py-1">
            {section.items.map((item) => {
              if (item.type === 'divider') {
                return (
                  <div
                    key={item.id}
                    className="my-1 border-t border-[var(--theme-border-default)]"
                  />
                )
              }

              const Icon = item.icon
              const isSubmenu = item.type === 'submenu'
              const isExpanded = expandedSubmenus.has(item.id)

              const itemContent = (
                <>
                  {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                  <span className="flex-1">{item.label}</span>
                  {isSubmenu && (
                    <ChevronRight className="w-4 h-4 text-[var(--theme-text-muted)]" />
                  )}
                </>
              )

              const itemClassName = `w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-elevated)] hover:text-[var(--theme-text-primary)] transition-colors`

              if (isSubmenu) {
                return (
                  <div key={item.id} className="relative">
                    <button
                      onClick={() => toggleSubmenu(item.id)}
                      className={itemClassName}
                    >
                      {itemContent}
                    </button>
                    {isExpanded && item.children && (
                      <div className="absolute left-full bottom-0 ml-1 min-w-48 bg-[var(--theme-bg-surface)] border border-[var(--theme-border-default)] rounded-lg shadow-lg overflow-hidden z-50">
                        <div className="py-1">
                          {item.children.map((child) => {
                            const ChildIcon = child.icon
                            const childContent = (
                              <>
                                {ChildIcon && <ChildIcon className="w-4 h-4 flex-shrink-0" />}
                                <span className="flex-1">{child.label}</span>
                              </>
                            )

                            if (child.type === 'link' && child.href) {
                              if (child.external) {
                                return (
                                  <a
                                    key={child.id}
                                    href={child.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={itemClassName}
                                    onClick={onClose}
                                  >
                                    {childContent}
                                  </a>
                                )
                              }
                              return (
                                <div key={child.id}>
                                  {renderLink({
                                    href: child.href,
                                    className: itemClassName,
                                    children: childContent,
                                    onClick: onClose,
                                  })}
                                </div>
                              )
                            }

                            if (child.type === 'callback' && child.onClick) {
                              return (
                                <button
                                  key={child.id}
                                  onClick={() => {
                                    child.onClick?.()
                                    onClose()
                                  }}
                                  className={itemClassName}
                                >
                                  {childContent}
                                </button>
                              )
                            }

                            return null
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              }

              if (item.type === 'link' && item.href) {
                if (item.external) {
                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={itemClassName}
                      onClick={onClose}
                    >
                      {itemContent}
                    </a>
                  )
                }
                return (
                  <div key={item.id}>
                    {renderLink({
                      href: item.href,
                      className: itemClassName,
                      children: itemContent,
                      onClick: onClose,
                    })}
                  </div>
                )
              }

              if (item.type === 'callback' && item.onClick) {
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.onClick?.()
                      onClose()
                    }}
                    className={itemClassName}
                  >
                    {itemContent}
                  </button>
                )
              }

              return null
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export interface CreateDefaultUserMenuOptions {
  onLogout: () => void
  buildTimestamp?: string
  gitCommit?: string
  includeProfile?: boolean  // false for Identity app itself
  aboutHref?: string  // Link to about/landing page (defaults to /landing)
  organizations?: {
    items: Organization[]
    currentId: string | null
    onSwitch: (orgId: string) => void
    storageKey?: string
  }
}

export function createDefaultUserMenu(options: CreateDefaultUserMenuOptions): UserMenuConfig {
  const { onLogout, buildTimestamp, gitCommit, includeProfile = true, aboutHref = '/landing', organizations } = options

  const sections: UserMenuSection[] = []

  // Profile and About section
  const profileItems: UserMenuItem[] = []
  if (includeProfile) {
    profileItems.push({
      id: 'profile',
      label: 'Profile',
      icon: User,
      type: 'link',
      href: 'https://identity.ai.devintensive.com/profile',
      external: true,
    })
  }
  profileItems.push({
    id: 'about',
    label: 'About',
    icon: Info,
    type: 'link',
    href: aboutHref,
  })

  if (profileItems.length > 0) {
    sections.push({
      items: profileItems,
    })
  }

  // Developer Tools section (as expandable submenu) - alphabetized
  sections.push({
    items: [
      {
        id: 'developer-tools',
        label: 'Developer Tools',
        icon: Wrench,
        type: 'submenu',
        children: [
          {
            id: 'backlog',
            label: 'Backlog',
            icon: ClipboardList,
            type: 'link',
            href: 'https://manage.ai.devintensive.com/backlog',
            external: true,
          },
          {
            id: 'changelog',
            label: 'Change Log',
            icon: FileText,
            type: 'link',
            href: '/changelog',
            external: false,
          },
          {
            id: 'error-logs',
            label: 'Error Logs',
            icon: AlertTriangle,
            type: 'link',
            href: 'https://admin.ai.devintensive.com/error-logs',
            external: true,
          },
          {
            id: 'idea-backlog',
            label: 'Idea Backlog',
            icon: Lightbulb,
            type: 'link',
            href: 'https://manage.ai.devintensive.com/idea-backlog',
            external: true,
          },
          {
            id: 'system-health',
            label: 'System Health',
            icon: Activity,
            type: 'link',
            href: 'https://admin.ai.devintensive.com/monitoring',
            external: true,
          },
          {
            id: 'test-scenarios',
            label: 'Test Scenarios',
            icon: FlaskConical,
            type: 'link',
            href: 'https://admin.ai.devintensive.com/test-scenarios',
            external: true,
          },
        ],
      },
    ],
  })

  // Logout section
  sections.push({
    items: [
      {
        id: 'logout',
        label: 'Sign Out',
        icon: LogOut,
        type: 'callback',
        onClick: onLogout,
      },
    ],
  })

  return {
    sections,
    organizations,
    versionInfo: buildTimestamp || gitCommit ? {
      buildTime: buildTimestamp,
      commit: gitCommit,
    } : undefined,
  }
}
