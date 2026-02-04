// Types
export type {
  Artifact,
  ArtifactVersion,
  ArtifactWithVersions,
  ArtifactCreateData,
  ArtifactLinkCreateData,
  ArtifactUpdateData,
  ArtifactContext,
} from './types'

// API
export { createArtifactsApi } from './api'
export type { ArtifactsApi, ArtifactsApiConfig } from './api'

// Context
export { ArtifactsProvider, useArtifactsContext } from './context'
export type { ArtifactsProviderProps } from './context'

// Hooks
export { useArtifacts } from './hooks/useArtifacts'

// Note: Components were removed because they require UI primitives (Button, Dialog, etc.)
// that aren't exported by @expertly/ui. Apps should use their own local UI components
// with the types, API client, and hooks from this package.
