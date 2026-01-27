/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UI_REMOTE_URL: string
  readonly VITE_BUILD_TIMESTAMP: string
  readonly VITE_GIT_COMMIT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'expertly_ui/index' {
  import { FC, ReactNode } from 'react'
  import { LucideIcon } from 'lucide-react'

  interface NavItem {
    name: string
    href: string
    icon: LucideIcon
  }

  interface RenderLinkProps {
    href: string
    className: string
    children: ReactNode
  }

  interface SidebarProps {
    productCode: string
    productName: string
    navigation: NavItem[]
    currentPath: string
    user?: {
      name: string
      role?: string
    }
    orgSwitcher?: ReactNode
    buildInfo?: ReactNode
    renderLink: (props: RenderLinkProps) => ReactNode
    versionCheck?: {
      currentCommit?: string
      safeMinutes?: number
    }
  }

  interface MainContentProps {
    children: ReactNode
  }

  interface ThemeProviderProps {
    children: ReactNode
    defaultTheme?: string
    defaultMode?: 'light' | 'dark'
  }

  export const Sidebar: FC<SidebarProps>
  export const MainContent: FC<MainContentProps>
  export const ThemeProvider: FC<ThemeProviderProps>
  export function formatBuildTimestamp(timestamp: string | undefined): string | null
}
