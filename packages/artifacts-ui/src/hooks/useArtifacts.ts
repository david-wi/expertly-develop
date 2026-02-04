import { useState, useEffect, useCallback } from 'react'
import type { Artifact, ArtifactWithVersions, ArtifactContext } from '../types'
import type { ArtifactsApi } from '../api'

interface UseArtifactsOptions {
  api: ArtifactsApi
  context: ArtifactContext
  autoFetch?: boolean
}

interface UseArtifactsReturn {
  artifacts: Artifact[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  getArtifact: (id: string) => Promise<ArtifactWithVersions>
  uploadArtifact: (name: string, file: File, description?: string) => Promise<Artifact>
  createLink: (name: string, url: string, description?: string) => Promise<Artifact>
  deleteArtifact: (id: string) => Promise<void>
}

/**
 * Hook for managing artifacts.
 *
 * @example
 * ```tsx
 * const { artifacts, loading, uploadArtifact, refetch } = useArtifacts({
 *   api: artifactsApi,
 *   context: { product_id: productId },
 * })
 * ```
 */
export function useArtifacts({
  api,
  context,
  autoFetch = true,
}: UseArtifactsOptions): UseArtifactsReturn {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loading, setLoading] = useState(autoFetch)
  const [error, setError] = useState<Error | null>(null)

  const fetchArtifacts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.list(context)
      setArtifacts(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch artifacts'))
    } finally {
      setLoading(false)
    }
  }, [api, context])

  useEffect(() => {
    if (autoFetch) {
      fetchArtifacts()
    }
  }, [autoFetch, fetchArtifacts])

  const getArtifact = useCallback(
    async (id: string) => {
      return api.get(id)
    },
    [api]
  )

  const uploadArtifact = useCallback(
    async (name: string, file: File, description?: string) => {
      const artifact = await api.upload(context, name, file, description)
      await fetchArtifacts()
      return artifact
    },
    [api, context, fetchArtifacts]
  )

  const createLink = useCallback(
    async (name: string, url: string, description?: string) => {
      const artifact = await api.createLink(context, name, url, description)
      await fetchArtifacts()
      return artifact
    },
    [api, context, fetchArtifacts]
  )

  const deleteArtifact = useCallback(
    async (id: string) => {
      await api.delete(id)
      await fetchArtifacts()
    },
    [api, fetchArtifacts]
  )

  return {
    artifacts,
    loading,
    error,
    refetch: fetchArtifacts,
    getArtifact,
    uploadArtifact,
    createLink,
    deleteArtifact,
  }
}
