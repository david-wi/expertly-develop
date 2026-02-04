import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  MousePointerClick,
  Lock,
  CheckSquare,
  Scissors,
  Calendar,
  Code,
  FlaskConical,
  Settings,
} from 'lucide-react'
import { useState } from 'react'
import type { ReactNode, ComponentType, MouseEvent as ReactMouseEvent } from 'react'
import { ThemeSwitcher } from '../theme/ThemeSwitcher'
import { VersionChecker } from './VersionChecker'
import { UserMenu, type UserMenuConfig } from './UserMenu'
import { createRenderLink } from '../utils/createRenderLink'

export interface NavItem {
  name: string
  href: string
  icon: ComponentType<{ className?: string }>
  /** If true, renders a spacer/divider before this item */
  spacerBefore?: boolean
}

export interface ExpertlyProduct {
  name: string
  code: string
  href: string
  icon: ComponentType<{ className?: string }>
  description: string
  /** If true, renders a horizontal rule before this item */
  separatorBefore?: boolean
}

export const EXPERTLY_PRODUCTS: ExpertlyProduct[] = [
  { name: 'Expertly Define', code: 'define', href: 'https://define.ai.devintensive.com', icon: ClipboardList, description: 'Requirements management' },
  { name: 'Expertly Develop', code: 'develop', href: 'https://develop.ai.devintensive.com', icon: MousePointerClick, description: 'Visual walkthroughs' },
  { name: 'Expertly Identity', code: 'identity', href: 'https://identity.ai.devintensive.com', icon: Lock, description: 'Users & authentication' },
  { name: 'Expertly Manage', code: 'manage', href: 'https://manage.ai.devintensive.com', icon: CheckSquare, description: 'Task management' },
  { name: 'Expertly Salon', code: 'salon', href: 'https://salon.ai.devintensive.com', icon: Scissors, description: 'Salon management' },
  { name: 'Expertly Today', code: 'today', href: 'https://today.ai.devintensive.com', icon: Calendar, description: 'Daily workflow' },
  { name: 'Expertly VibeCode', code: 'vibecode', href: 'https://vibecode.ai.devintensive.com', icon: Code, description: 'AI coding assistant' },
  { name: 'Expertly VibeTest', code: 'vibetest', href: 'https://vibetest.ai.devintensive.com', icon: FlaskConical, description: 'AI testing platform' },
  { name: 'Expertly Admin', code: 'admin', href: 'https://admin.ai.devintensive.com', icon: Settings, description: 'Platform administration', separatorBefore: true },
]

export type SupportedLanguage = 'en' | 'es'

export interface LanguageOption {
  code: SupportedLanguage
  flag: string
  name: string
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', flag: '🇺🇸', name: 'English' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
]

// Expertly Logo SVG component
export function ExpertlyLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.8379 24.9606C16.6714 22.9391 17.9566 20.4822 18.571 17.8238L24.2667 20.4657C24.3728 20.4481 24.4733 20.4064 24.5606 20.3436C24.6478 20.2809 24.7194 20.1989 24.7698 20.104C24.8201 20.0091 24.8479 19.9039 24.8509 19.7965C24.8539 19.6892 24.832 19.5826 24.7871 19.485L19.4266 8.14301C19.3632 8.00575 19.2699 7.88442 19.1535 7.78793C19.037 7.69144 18.9004 7.62224 18.7537 7.58542C18.607 7.5486 18.4539 7.54509 18.3057 7.57515C18.1574 7.60521 18.0178 7.66808 17.897 7.75913L7.63363 15.6497C7.10981 16.0196 7.36125 16.9409 7.98285 16.92L14.0452 16.6931C14.0452 16.6931 13.2106 20.2912 8.35301 22.0047L8.27269 22.0326C2.61541 23.4285 -0.000202179 18.7452 -0.000202179 15.7509C-0.00718689 7.22169 7.2006 0.699166 15.1173 0.0570345C17.8181 -0.167956 20.5328 0.274916 23.0218 1.34656C25.5108 2.41821 27.6976 4.08568 29.3891 6.2018C31.0806 8.31791 32.2249 10.8176 32.7209 13.4803C33.2169 16.1429 33.0494 18.8867 32.2332 21.4693C31.4169 24.0519 29.9771 26.3941 28.0407 28.289C26.1043 30.184 23.7309 31.5734 21.13 32.3347C18.5291 33.096 15.7807 33.2058 13.1273 32.6544C10.4738 32.103 7.99705 30.9073 5.91549 29.1728C9.17716 28.7959 12.4772 27.6408 14.8379 24.9606Z" fill="url(#paint0_linear_expertly)"/>
      <defs>
        <linearGradient id="paint0_linear_expertly" x1="32.9998" y1="33" x2="-6.71734" y2="18.8377" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9648FF"/>
          <stop offset="1" stopColor="#2C62F9"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

export interface SidebarProps {
  productCode: string
  productName: string
  navigation: NavItem[]
  currentPath: string
  user?: {
    name: string
    role?: string
    organization?: string
  }
  basePath?: string
  orgSwitcher?: ReactNode
  bottomSection?: ReactNode
  // Build info displayed above theme switcher (e.g., version number, build timestamp)
  buildInfo?: ReactNode
  // Language support
  currentLanguage?: SupportedLanguage
  onLanguageChange?: (lang: SupportedLanguage) => void
  // Theme switcher visibility
  showThemeSwitcher?: boolean
  /**
   * Router navigation function (e.g., from useNavigate()).
   * When provided, Sidebar handles link rendering internally with proper href attributes
   * for right-click "Open in New Tab" support.
   */
  navigate?: (path: string) => void
  /**
   * @deprecated Use `navigate` prop instead for simpler usage.
   * Custom link rendering function. If not provided and `navigate` is set,
   * Sidebar will use createRenderLink internally.
   */
  renderLink?: (props: {
    href: string
    className: string
    children: ReactNode
    onClick?: (event: ReactMouseEvent) => void
  }) => ReactNode
  // Version checking - shows banner when newer version is available
  versionCheck?: {
    /** Current app's git commit SHA (from VITE_GIT_COMMIT env var) */
    currentCommit?: string
    /** Minutes to wait before showing update alert (default: 10) */
    safeMinutes?: number
  }
  /** Custom content rendered below navigation (e.g., widgets, agent status for Vibecode) */
  children?: ReactNode
  /** User menu configuration - when provided, makes user section clickable */
  userMenu?: UserMenuConfig
}

export function Sidebar({
  productCode,
  productName,
  navigation,
  currentPath,
  user,
  basePath = '',
  orgSwitcher,
  bottomSection,
  buildInfo,
  currentLanguage,
  onLanguageChange,
  showThemeSwitcher = true,
  navigate,
  renderLink: renderLinkProp,
  versionCheck,
  children,
  userMenu,
}: SidebarProps) {
  const [showProductSwitcher, setShowProductSwitcher] = useState(false)
  const [showLanguageSwitcher, setShowLanguageSwitcher] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Use provided renderLink or create one from navigate function
  const renderLink = renderLinkProp ?? (navigate ? createRenderLink(navigate) : null)

  if (!renderLink) {
    throw new Error('Sidebar requires either `navigate` or `renderLink` prop')
  }

  // Theme-aware classes using CSS variables
  // Sidebar uses dedicated sidebar colors (allows dark sidebar in light mode)
  const sidebarBg = 'bg-theme-sidebar-bg'
  const sidebarBorderColor = 'border-theme-sidebar-border'
  const sidebarText = 'text-theme-sidebar-text'
  const sidebarTextMuted = 'text-theme-sidebar-text-muted'
  const sidebarHoverBg = 'hover:bg-theme-sidebar-bg-hover'

  // Sidebar active states - using theme-aware colors for proper contrast
  const activeBg = 'bg-primary-500/15'
  const activeText = 'text-theme-sidebar-active-text'

  // Content area colors (for dropdowns that appear over content)
  const borderColor = 'border-theme-border'
  const textSecondary = 'text-theme-text-secondary'
  const textMuted = 'text-theme-text-muted'
  const hoverBg = 'hover:bg-theme-bg-elevated'
  const navHoverBg = sidebarHoverBg
  const userBg = 'bg-theme-sidebar-bg-hover'
  const avatarBg = 'bg-primary-900'
  const avatarText = 'text-primary-300'
  const dropdownBg = 'bg-theme-bg-surface'

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0]

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-72 ${sidebarBg} shadow-lg flex flex-col ${sidebarBorderColor} overflow-hidden`}>
      {/* Version Update Banner */}
      {versionCheck?.currentCommit && (
        <VersionChecker
          currentCommit={versionCheck.currentCommit}
          safeMinutes={versionCheck.safeMinutes}
        />
      )}

      {/* Logo / Product Switcher */}
      <div className="relative flex-shrink-0">
        <div className={`flex h-14 items-center justify-between px-4 border-b ${sidebarBorderColor}`}>
          <button
            onClick={() => setShowProductSwitcher(!showProductSwitcher)}
            className={`flex items-center gap-2 ${sidebarHoverBg} -ml-1 px-1.5 py-1 rounded-lg transition-colors min-w-0`}
          >
            <ExpertlyLogo className="w-7 h-7 flex-shrink-0" />
            <span className={`font-semibold text-theme-sidebar-text-strong text-base whitespace-nowrap`}>Expertly {productName}</span>
            <ChevronDown className={`w-4 h-4 ${sidebarTextMuted} transition-transform flex-shrink-0 ${showProductSwitcher ? 'rotate-180' : ''}`} />
          </button>

          {/* Compact Language Selector */}
          {onLanguageChange && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowLanguageSwitcher(!showLanguageSwitcher)}
                className={`p-1.5 rounded-lg ${sidebarHoverBg} transition-colors`}
                title={currentLang.name}
              >
                <span className="text-base">{currentLang.flag}</span>
              </button>

              {showLanguageSwitcher && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowLanguageSwitcher(false)}
                  />
                  <div className={`absolute top-full right-0 mt-1 ${dropdownBg} border ${borderColor} rounded-lg shadow-lg z-50 min-w-[120px]`}>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          onLanguageChange(lang.code)
                          setShowLanguageSwitcher(false)
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                          lang.code === currentLanguage
                            ? `${activeBg} ${activeText}`
                            : `${textSecondary} ${hoverBg}`
                        } first:rounded-t-lg last:rounded-b-lg transition-colors`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Product Dropdown */}
        {showProductSwitcher && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowProductSwitcher(false)}
            />
            <div className={`fixed left-0 top-14 w-72 ${dropdownBg} border ${borderColor} rounded-b-lg shadow-lg z-50 max-h-[calc(100vh-4rem)] overflow-y-auto`}>
              <div className="product-dropdown p-2">
                <p className={`px-3 py-2 text-xs font-medium ${textMuted} uppercase`}>Switch Product</p>
                {EXPERTLY_PRODUCTS.map((product) => (
                  <div key={product.code}>
                    {product.separatorBefore && (
                      <hr className={`my-2 border-t ${borderColor}`} />
                    )}
                    <a
                      href={product.href}
                      className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        product.code === productCode
                          ? `product-item-active ${activeBg} ${activeText}`
                          : `${textSecondary} hover:${activeBg} hover:${activeText}`
                      }`}
                      onClick={() => setShowProductSwitcher(false)}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                        product.separatorBefore
                          ? 'bg-gray-100 dark:bg-gray-800 group-hover:bg-gradient-to-br group-hover:from-gray-500 group-hover:to-gray-700'
                          : 'bg-primary-100 dark:bg-primary-900/50 group-hover:bg-gradient-to-br group-hover:from-primary-500 group-hover:to-primary-600'
                      }`}>
                        <product.icon className={`w-4 h-4 transition-colors ${
                          product.separatorBefore
                            ? 'text-gray-600 dark:text-gray-400 group-hover:text-white'
                            : 'text-primary-600 dark:text-primary-400 group-hover:text-white'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className={`text-xs ${textMuted}`}>{product.description}</p>
                      </div>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Organization Switcher (optional) */}
      {orgSwitcher && (
        <div className="px-3 py-2 flex-shrink-0">
          {orgSwitcher}
        </div>
      )}

      {/* Scrollable content area - nav scrolls, bottom sections stick to bottom */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {/* Navigation */}
        {navigation.length > 0 && (
          <nav className="px-3 py-2">
            <ul className="space-y-1">
              {navigation.map((item) => {
                const fullHref = basePath + item.href
                // Match exact path or nested paths (with trailing slash to avoid partial matches like /monitor matching /monitoring)
                const isActive = currentPath === fullHref ||
                  (item.href !== '/' && currentPath.startsWith(fullHref + '/'))

                return (
                  <li key={item.name}>
                    {item.spacerBefore && <div className="mt-4 mb-2 border-t border-theme-border" />}
                    {renderLink({
                      href: fullHref,
                      className: `
                        flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                        transition-colors duration-150
                        ${isActive
                          ? `${activeBg} ${activeText}`
                          : `${sidebarText} ${navHoverBg} hover:text-theme-sidebar-text-hover`
                        }
                      `,
                      children: (
                        <>
                          <item.icon className="w-5 h-5" />
                          {item.name}
                        </>
                      ),
                    })}
                  </li>
                )
              })}
            </ul>
          </nav>
        )}

        {/* Custom Content (children) */}
        {children}

        {/* Spacer to push bottom sections down when content is short */}
        <div className="flex-1" />

        {/* Bottom sections - sticky to bottom of scroll area */}
        <div className={`sticky bottom-0 ${sidebarBg}`}>
          {/* Build Info (optional - displayed above theme switcher line) */}
          {buildInfo && (
            <div className="px-4 py-1">
              {buildInfo}
            </div>
          )}

          {/* Theme Switcher */}
          {showThemeSwitcher && (
            <div className={`px-4 py-3 border-t ${sidebarBorderColor}`}>
              <ThemeSwitcher />
            </div>
          )}

          {/* Bottom Section (optional - for logout buttons, etc.) */}
          {bottomSection && (
            <div className={`border-t ${sidebarBorderColor}`}>
              {bottomSection}
            </div>
          )}

          {/* User */}
          {user && (
            <div className={`p-4 border-t ${sidebarBorderColor} ${userBg} relative`}>
              {userMenu ? (
                <>
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className={`w-full flex items-center gap-3 ${sidebarHoverBg} rounded-lg p-1 -m-1 transition-colors`}
                  >
                    <div className={`w-8 h-8 ${avatarBg} rounded-full flex items-center justify-center flex-shrink-0`}>
                      <span className={`${avatarText} font-medium text-sm`}>
                        {user.name?.charAt(0) || 'U'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className={`text-sm font-medium text-theme-sidebar-text-strong truncate`}>{user.name || 'Loading...'}</p>
                      {user.organization && <p className={`text-xs ${sidebarTextMuted} truncate`}>{user.organization}</p>}
                      {!user.organization && user.role && <p className={`text-xs ${sidebarTextMuted} capitalize`}>{user.role}</p>}
                    </div>
                    <ChevronUp className={`w-4 h-4 ${sidebarTextMuted} transition-transform flex-shrink-0 ${showUserMenu ? 'rotate-180' : ''}`} />
                  </button>
                  <UserMenu
                    config={userMenu}
                    isOpen={showUserMenu}
                    onClose={() => setShowUserMenu(false)}
                    renderLink={renderLink}
                  />
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 ${avatarBg} rounded-full flex items-center justify-center`}>
                    <span className={`${avatarText} font-medium text-sm`}>
                      {user.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium text-theme-sidebar-text-strong truncate`}>{user.name || 'Loading...'}</p>
                    {user.organization && <p className={`text-xs ${sidebarTextMuted} truncate`}>{user.organization}</p>}
                    {!user.organization && user.role && <p className={`text-xs ${sidebarTextMuted} capitalize`}>{user.role}</p>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export interface MainLayoutProps {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-theme-bg">
      {children}
    </div>
  )
}

export function MainContent({ children }: { children: ReactNode }) {
  return (
    <div className="pl-72 min-h-screen bg-theme-bg">
      <main className="p-8">
        {children}
      </main>
    </div>
  )
}

// Tailwind violet color palette (for reference in tailwind configs)
export const violetPalette = {
  50: '#f5f3ff',
  100: '#ede9fe',
  200: '#ddd6fe',
  300: '#c4b5fd',
  400: '#a78bfa',
  500: '#8b5cf6',
  600: '#7c3aed',
  700: '#6d28d9',
  800: '#5b21b6',
  900: '#4c1d95',
  950: '#2e1065',
}
