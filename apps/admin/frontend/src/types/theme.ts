export interface ThemePrimaryColors {
  '50': string
  '100': string
  '200': string
  '300': string
  '400': string
  '500': string
  '600': string
  '700': string
  '800': string
  '900': string
  '950': string
}

export interface ThemeBackgroundColors {
  default: string
  surface: string
  elevated: string
}

export interface ThemeTextColors {
  primary: string
  secondary: string
  muted: string
}

export interface ThemeBorderColors {
  default: string
  subtle: string
}

export interface ThemeModeColors {
  primary: ThemePrimaryColors
  background: ThemeBackgroundColors
  text: ThemeTextColors
  border: ThemeBorderColors
}

export interface ThemeColors {
  light: ThemeModeColors
  dark: ThemeModeColors
}

export interface Theme {
  id: string
  name: string
  slug: string
  description: string | null
  is_default: boolean
  is_active: boolean
  current_version: number
  colors: ThemeColors
  created_at: string
  updated_at: string
}

export interface ThemeVersion {
  id: string
  version_number: number
  snapshot: ThemeColors
  change_summary: string | null
  changed_by: string | null
  changed_at: string
  status: 'active' | 'superseded'
}

export interface ThemeListResponse {
  themes: Theme[]
  total: number
}

export interface ThemeVersionListResponse {
  versions: ThemeVersion[]
  total: number
}

export interface ThemeCreateInput {
  name: string
  slug: string
  description?: string
  is_default?: boolean
  colors: ThemeColors
}

export interface ThemeUpdateInput {
  name?: string
  description?: string
  is_default?: boolean
  is_active?: boolean
  colors?: ThemeColors
  change_summary?: string
  changed_by?: string
}
