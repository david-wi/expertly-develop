/**
 * Configurable API client factory for artifacts.
 */

import type { AxiosInstance } from 'axios'
import type {
  Artifact,
  ArtifactWithVersions,
  ArtifactVersion,
  ArtifactContext,
  ArtifactLinkCreateData,
  ArtifactUpdateData,
} from './types'

export interface ArtifactsApiConfig {
  /** Axios instance to use for requests */
  axiosInstance: AxiosInstance
  /** Base path for artifacts API (default: '/api/v1/artifacts') */
  basePath?: string
  /** Context key name used in query params (default: 'product_id') */
  contextKey?: string
}

export interface ArtifactsApi {
  /** List artifacts for a given context */
  list(context: ArtifactContext): Promise<Artifact[]>

  /** Get a single artifact with all versions */
  get(id: string): Promise<ArtifactWithVersions>

  /** Upload a new artifact file */
  upload(
    context: ArtifactContext,
    name: string,
    file: File,
    description?: string
  ): Promise<Artifact>

  /** Create a link artifact */
  createLink(
    context: ArtifactContext,
    name: string,
    url: string,
    description?: string
  ): Promise<Artifact>

  /** Update artifact metadata */
  update(id: string, data: ArtifactUpdateData): Promise<Artifact>

  /** Delete an artifact */
  delete(id: string): Promise<void>

  /** Upload a new version of an artifact */
  uploadVersion(
    artifactId: string,
    file: File,
    changeSummary?: string
  ): Promise<ArtifactVersion>

  /** Get download URL for original file */
  downloadOriginalUrl(artifactId: string, versionId: string): string

  /** Get markdown content for a version */
  getMarkdown(artifactId: string, versionId: string): Promise<string>

  /** Retry conversion for a failed version */
  reconvert(artifactId: string, versionId: string): Promise<ArtifactVersion>
}

/**
 * Create a configured artifacts API client.
 *
 * @example
 * ```typescript
 * const api = createArtifactsApi({ axiosInstance: myAxios })
 * const artifacts = await api.list({ product_id: 'uuid' })
 * ```
 */
export function createArtifactsApi(config: ArtifactsApiConfig): ArtifactsApi {
  const { axiosInstance, basePath = '/api/v1/artifacts', contextKey = 'product_id' } = config

  return {
    async list(context: ArtifactContext): Promise<Artifact[]> {
      const contextId = context[contextKey]
      if (!contextId) {
        throw new Error(`Context must include ${contextKey}`)
      }
      const response = await axiosInstance.get<Artifact[]>(basePath, {
        params: { [contextKey]: contextId },
      })
      return response.data
    },

    async get(id: string): Promise<ArtifactWithVersions> {
      const response = await axiosInstance.get<ArtifactWithVersions>(`${basePath}/${id}`)
      return response.data
    },

    async upload(
      context: ArtifactContext,
      name: string,
      file: File,
      description?: string
    ): Promise<Artifact> {
      const contextId = context[contextKey]
      if (!contextId) {
        throw new Error(`Context must include ${contextKey}`)
      }
      const formData = new FormData()
      formData.append(contextKey, contextId)
      formData.append('name', name)
      formData.append('file', file)
      if (description) {
        formData.append('description', description)
      }
      const response = await axiosInstance.post<Artifact>(basePath, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data
    },

    async createLink(
      context: ArtifactContext,
      name: string,
      url: string,
      description?: string
    ): Promise<Artifact> {
      const contextId = context[contextKey]
      if (!contextId) {
        throw new Error(`Context must include ${contextKey}`)
      }
      const data: ArtifactLinkCreateData = { name, url, description }
      const response = await axiosInstance.post<Artifact>(`${basePath}/link`, data, {
        params: { [contextKey]: contextId },
      })
      return response.data
    },

    async update(id: string, data: ArtifactUpdateData): Promise<Artifact> {
      const response = await axiosInstance.patch<Artifact>(`${basePath}/${id}`, data)
      return response.data
    },

    async delete(id: string): Promise<void> {
      await axiosInstance.delete(`${basePath}/${id}`)
    },

    async uploadVersion(
      artifactId: string,
      file: File,
      changeSummary?: string
    ): Promise<ArtifactVersion> {
      const formData = new FormData()
      formData.append('file', file)
      if (changeSummary) {
        formData.append('change_summary', changeSummary)
      }
      const response = await axiosInstance.post<ArtifactVersion>(
        `${basePath}/${artifactId}/versions`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return response.data
    },

    downloadOriginalUrl(artifactId: string, versionId: string): string {
      return `${basePath}/${artifactId}/versions/${versionId}/original`
    },

    async getMarkdown(artifactId: string, versionId: string): Promise<string> {
      const response = await axiosInstance.get<string>(
        `${basePath}/${artifactId}/versions/${versionId}/markdown`,
        {
          responseType: 'text',
          transformResponse: [(data) => data],
        }
      )
      return response.data
    },

    async reconvert(artifactId: string, versionId: string): Promise<ArtifactVersion> {
      const response = await axiosInstance.post<ArtifactVersion>(
        `${basePath}/${artifactId}/versions/${versionId}/reconvert`
      )
      return response.data
    },
  }
}
