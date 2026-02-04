/**
 * React context for artifacts.
 *
 * Provides API access and current context to all artifact components.
 */

import { createContext, useContext, type ReactNode } from 'react'
import type { ArtifactsApi } from './api'
import type { ArtifactContext } from './types'

interface ArtifactsContextValue {
  api: ArtifactsApi
  context: ArtifactContext
  /** Identity service URL for voice transcription token (optional) */
  transcriptionTokenUrl?: string
}

const ArtifactsContext = createContext<ArtifactsContextValue | null>(null)

export interface ArtifactsProviderProps {
  /** Configured artifacts API client */
  api: ArtifactsApi
  /** Current context (e.g., { product_id: 'uuid' }) */
  context: ArtifactContext
  /** Identity service URL for voice transcription token (optional) */
  transcriptionTokenUrl?: string
  children: ReactNode
}

/**
 * Provider component for artifacts context.
 *
 * @example
 * ```tsx
 * <ArtifactsProvider api={artifactsApi} context={{ product_id: productId }}>
 *   <ArtifactList />
 * </ArtifactsProvider>
 * ```
 */
export function ArtifactsProvider({
  api,
  context,
  transcriptionTokenUrl,
  children,
}: ArtifactsProviderProps) {
  return (
    <ArtifactsContext.Provider value={{ api, context, transcriptionTokenUrl }}>
      {children}
    </ArtifactsContext.Provider>
  )
}

/**
 * Hook to access artifacts context.
 *
 * Must be used within an ArtifactsProvider.
 */
export function useArtifactsContext(): ArtifactsContextValue {
  const context = useContext(ArtifactsContext)
  if (!context) {
    throw new Error('useArtifactsContext must be used within an ArtifactsProvider')
  }
  return context
}
