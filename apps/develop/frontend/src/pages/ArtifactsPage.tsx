import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Trash2, FileText, FileBox } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { artifactsApi, projectsApi } from '../api/client'
import { formatDistanceToNow } from 'date-fns'

export default function ArtifactsPage() {
  const queryClient = useQueryClient()

  const { data: artifacts, isLoading } = useQuery({
    queryKey: ['artifacts'],
    queryFn: () => artifactsApi.list(),
  })

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const deleteMutation = useMutation({
    mutationFn: artifactsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifacts'] })
    },
  })

  const projectMap = new Map(projects?.items?.map(p => [p.id, p.name]) || [])

  const getFormatIcon = (format: string) => {
    switch (format.toLowerCase()) {
      case 'pdf':
        return FileText
      default:
        return FileBox
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Artifacts</h1>
        <p className="text-gray-600 mt-1">Generated reports and documents</p>
      </div>

      {/* Artifacts List */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">All Artifacts</h2>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading artifacts...</div>
          ) : !artifacts?.items?.length ? (
            <div className="text-center py-12 text-gray-500">
              No artifacts yet. Run a walkthrough to generate your first artifact.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Format</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {artifacts.items.map((artifact) => {
                    const FormatIcon = getFormatIcon(artifact.format)
                    return (
                      <tr key={artifact.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <FormatIcon className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{artifact.label}</p>
                              {artifact.description && (
                                <p className="text-xs text-gray-500 truncate max-w-[250px]">
                                  {artifact.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge>{artifact.artifact_type_code.replace('_', ' ')}</Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {artifact.project_id ? projectMap.get(artifact.project_id) || 'Unknown' : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="info">{artifact.format.toUpperCase()}</Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDistanceToNow(new Date(artifact.created_at), { addSuffix: true })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <a
                              href={artifactsApi.download(artifact.id)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Download"
                            >
                              <Download className="w-4 h-4 text-gray-600" />
                            </a>
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this artifact?')) {
                                  deleteMutation.mutate(artifact.id)
                                }
                              }}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
