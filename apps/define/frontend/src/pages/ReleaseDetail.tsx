import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2, Check, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { releasesApi, ReleaseSnapshot } from '@/api/client'

interface SnapshotRequirement {
  id: string
  stable_key: string
  title: string
  status: string
  priority: string
  parent_id: string | null
}

export default function ReleaseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [release, setRelease] = useState<ReleaseSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (id) fetchRelease()
  }, [id])

  async function fetchRelease() {
    try {
      const data = await releasesApi.get(id!)
      setRelease(data)
    } catch (error) {
      console.error('Error fetching release:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRelease() {
    if (!release) return

    setUpdating(true)
    try {
      await releasesApi.update(release.id, { status: 'released' })
      fetchRelease()
    } catch (error) {
      console.error('Error releasing:', error)
    } finally {
      setUpdating(false)
    }
  }

  async function handleDelete() {
    if (!release || !confirm('Are you sure you want to delete this release?')) return

    setDeleting(true)
    try {
      await releasesApi.delete(release.id)
      navigate('/releases')
    } catch (error) {
      console.error('Error deleting release:', error)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  if (!release) {
    return (
      <div className="px-6 py-8 max-w-4xl mx-auto">
        <p className="text-gray-500">Release not found</p>
      </div>
    )
  }

  const requirements: SnapshotRequirement[] = JSON.parse(release.requirements_snapshot)
  const stats = release.stats ? JSON.parse(release.stats) : null

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="mb-4">
        <Link
          to="/releases"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to releases
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">{release.version_name}</h1>
          <Badge variant={release.status === 'released' ? 'success' : 'secondary'}>
            {release.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
          {release.status === 'draft' && (
            <Button onClick={handleRelease} disabled={updating}>
              {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Mark as Released
            </Button>
          )}
        </div>
      </div>

      {release.description && (
        <p className="text-gray-600 mb-6">{release.description}</p>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900">{stats?.total || 0}</div>
            <div className="text-sm text-gray-500">Total Requirements</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900">
              {formatDistanceToNow(new Date(release.created_at), { addSuffix: true })}
            </div>
            <div className="text-sm text-gray-500">Created</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900">
              {release.released_at
                ? formatDistanceToNow(new Date(release.released_at), { addSuffix: true })
                : 'Not released'}
            </div>
            <div className="text-sm text-gray-500">Released</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requirements Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          {requirements.length === 0 ? (
            <p className="text-gray-500">No requirements in this snapshot</p>
          ) : (
            <div className="divide-y">
              {requirements.map((req) => (
                <div key={req.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {req.stable_key}
                      </Badge>
                      <span className="font-medium text-gray-900">{req.title}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{req.priority}</Badge>
                    <Badge
                      variant={
                        req.status === 'verified'
                          ? 'success'
                          : req.status === 'implemented'
                          ? 'success'
                          : 'secondary'
                      }
                    >
                      {req.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
