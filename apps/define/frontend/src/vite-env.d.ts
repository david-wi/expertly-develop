/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UI_REMOTE_URL: string
  readonly VITE_BUILD_TIMESTAMP: string
  readonly VITE_GIT_COMMIT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
