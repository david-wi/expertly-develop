import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Loader2, FileText } from 'lucide-react'
import { Artifact, ArtifactWithVersions, artifactsApi } from '@/api/client'
import { ArtifactCard } from './ArtifactCard'
import { ArtifactUploadDialog } from './ArtifactUploadDialog'
import { ArtifactDetailDialog } from './ArtifactDetailDialog'

interface ArtifactListProps {
  productId: string
}

export function ArtifactList({ productId }: ArtifactListProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [artifactDetails, setArtifactDetails] = useState<Map<string, ArtifactWithVersions>>(new Map())

  useEffect(() => {
    fetchArtifacts()
  }, [productId])

  async function fetchArtifacts() {
    setLoading(true)
    try {
      const data = await artifactsApi.list(productId)
      setArtifacts(data)
      // Fetch details for each artifact to get latest version status
      const details = new Map<string, ArtifactWithVersions>()
      await Promise.all(
        data.map(async (artifact) => {
          try {
            const detail = await artifactsApi.get(artifact.id)
            details.set(artifact.id, detail)
          } catch (error) {
            console.error('Error fetching artifact details:', error)
          }
        })
      )
      setArtifactDetails(details)
    } catch (error) {
      console.error('Error fetching artifacts:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleArtifactClick(artifactId: string) {
    setSelectedArtifactId(artifactId)
    setDetailDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Artifacts ({artifacts.length})
        </h3>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Upload Artifact
        </Button>
      </div>

      {artifacts.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-gray-50">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No artifacts yet</p>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Upload your first artifact
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {artifacts.map((artifact) => {
            const details = artifactDetails.get(artifact.id)
            const latestVersion = details?.versions?.[0]
            return (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                latestVersion={latestVersion}
                onClick={() => handleArtifactClick(artifact.id)}
              />
            )
          })}
        </div>
      )}

      <ArtifactUploadDialog
        productId={productId}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={fetchArtifacts}
      />

      <ArtifactDetailDialog
        artifactId={selectedArtifactId}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onUpdate={fetchArtifacts}
        onDelete={fetchArtifacts}
      />
    </div>
  )
}
