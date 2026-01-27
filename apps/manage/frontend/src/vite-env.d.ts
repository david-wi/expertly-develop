/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_BUILD_TIMESTAMP?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'expertly_ui/index' {
  import { FC, ReactNode } from 'react'

  interface ThemeProviderProps {
    children: ReactNode
    defaultTheme?: string
    defaultMode?: 'light' | 'dark'
  }

  export const ThemeProvider: FC<ThemeProviderProps>
}
