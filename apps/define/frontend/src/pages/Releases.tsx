import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Package, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { productsApi, releasesApi, Product, ReleaseSnapshot } from '@/api/client'

export default function Releases() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [releases, setReleases] = useState<ReleaseSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newRelease, setNewRelease] = useState({ version_name: '', description: '' })

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    if (selectedProductId) {
      fetchReleases()
    }
  }, [selectedProductId])

  async function fetchProducts() {
    try {
      const data = await productsApi.list()
      setProducts(data)
      if (data.length > 0) {
        setSelectedProductId(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchReleases() {
    try {
      const data = await releasesApi.list(selectedProductId)
      setReleases(data)
    } catch (error) {
      console.error('Error fetching releases:', error)
    }
  }

  async function createRelease(e: React.FormEvent) {
    e.preventDefault()
    if (!newRelease.version_name.trim()) return

    setCreating(true)
    try {
      await releasesApi.create({
        product_id: selectedProductId,
        version_name: newRelease.version_name,
        description: newRelease.description || undefined,
      })
      setNewRelease({ version_name: '', description: '' })
      setDialogOpen(false)
      fetchReleases()
    } catch (error) {
      console.error('Error creating release:', error)
    } finally {
      setCreating(false)
    }
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Releases</h1>
          <p className="text-gray-500 mt-1">Manage release snapshots</p>
        </div>
        <div className="flex gap-4 items-center">
          {products.length > 0 && (
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!selectedProductId}>
                <Plus className="h-4 w-4 mr-2" />
                New Release
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={createRelease}>
                <DialogHeader>
                  <DialogTitle>Create Release Snapshot</DialogTitle>
                  <DialogDescription>
                    Create a new release snapshot for {selectedProduct?.name}.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Version Name
                    </label>
                    <Input
                      placeholder="e.g., v1.0.0"
                      value={newRelease.version_name}
                      onChange={(e) => setNewRelease({ ...newRelease, version_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Description (optional)
                    </label>
                    <Textarea
                      placeholder="Release notes..."
                      value={newRelease.description}
                      onChange={(e) => setNewRelease({ ...newRelease, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating || !newRelease.version_name.trim()}>
                    {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Snapshot
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No products yet</h2>
            <p className="text-gray-500 mb-6">
              Create a product first to manage releases.
            </p>
            <Link to="/products">
              <Button>Go to Products</Button>
            </Link>
          </CardContent>
        </Card>
      ) : releases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No releases yet</h2>
            <p className="text-gray-500 mb-6">
              Create a release snapshot to capture the current state of requirements.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create first release
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {releases.map((release) => {
            const stats = release.stats ? JSON.parse(release.stats) : null
            return (
              <Link key={release.id} to={`/releases/${release.id}`}>
                <Card className="hover:border-primary-300 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle>{release.version_name}</CardTitle>
                        <Badge variant={release.status === 'released' ? 'success' : 'secondary'}>
                          {release.status}
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(release.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {release.description && (
                      <p className="text-sm text-gray-500 mb-2">{release.description}</p>
                    )}
                    {stats && (
                      <p className="text-sm text-gray-600">
                        {stats.total} requirements captured
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
