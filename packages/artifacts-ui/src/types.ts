/**
 * Type definitions for artifacts.
 */

export interface Artifact {
  id: string
  context: Record<string, string>
  product_id: string | null
  name: string
  description: string | null
  artifact_type: 'file' | 'link'
  url: string | null
  original_filename: string | null
  mime_type: string | null
  current_version: number
  status: string
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface ArtifactVersion {
  id: string
  artifact_id: string
  version_number: number
  original_storage_path: string
  markdown_storage_path: string | null
  markdown_content: string | null
  size_bytes: number
  conversion_status: 'pending' | 'processing' | 'completed' | 'failed'
  conversion_error: string | null
  change_summary: string | null
  changed_by: string | null
  created_at: string
}

export interface ArtifactWithVersions extends Artifact {
  versions: ArtifactVersion[]
}

export interface ArtifactCreateData {
  name: string
  description?: string
}

export interface ArtifactLinkCreateData {
  name: string
  url: string
  description?: string
}

export interface ArtifactUpdateData {
  name?: string
  description?: string
  status?: string
  url?: string
}

/**
 * Context for artifact association.
 * Typically contains a single key-value pair like { product_id: "uuid" }
 */
export type ArtifactContext = Record<string, string>
