import { useState, useRef, useEffect, type ComponentType, type ReactNode } from 'react'
import { ChevronRight, User, AlertTriangle, FileText, LogOut } from 'lucide-react'

export interface UserMenuItem {
  id: string
  label: string
  icon?: ComponentType<{ className?: string }>
  type: 'link' | 'callback' | 'divider'
  href?: string
  external?: boolean  // Opens in new tab, bypasses renderLink
  onClick?: () => void
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

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--theme-bg-surface)] border border-[var(--theme-border-default)] rounded-lg shadow-lg overflow-hidden z-50"
    >
      {/* Version Info Header */}
      {hasVersionInfo && (
        <div className="px-3 py-2 bg-[var(--theme-bg-elevated)] border-b border-[var(--theme-border-default)]">
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
              const itemContent = (
                <>
                  {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                  <span className="flex-1">{item.label}</span>
                  {item.type === 'link' && (
                    <ChevronRight className="w-4 h-4 text-[var(--theme-text-muted)]" />
                  )}
                </>
              )

              const itemClassName = `w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-elevated)] hover:text-[var(--theme-text-primary)] transition-colors`

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
}

export function createDefaultUserMenu(options: CreateDefaultUserMenuOptions): UserMenuConfig {
  const { onLogout, buildTimestamp, gitCommit, includeProfile = true } = options

  const sections: UserMenuSection[] = []

  // Profile section (if included)
  if (includeProfile) {
    sections.push({
      items: [
        {
          id: 'profile',
          label: 'Profile',
          icon: User,
          type: 'link',
          href: 'https://identity.ai.devintensive.com/profile',
          external: true,
        },
      ],
    })
  }

  // Developer Tools section
  sections.push({
    title: 'Developer Tools',
    items: [
      {
        id: 'error-logs',
        label: 'Error Logs',
        icon: AlertTriangle,
        type: 'link',
        href: 'https://admin.ai.devintensive.com/error-logs',
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
    versionInfo: buildTimestamp || gitCommit ? {
      buildTime: buildTimestamp,
      commit: gitCommit,
    } : undefined,
  }
}
