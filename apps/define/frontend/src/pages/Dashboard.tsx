import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { productsApi, Product } from '@/api/client'
import {
  ArrowRight,
  FileText,
  FolderTree,
  Package,
  Plus,
  Loader2,
} from 'lucide-react'
import { InlineVoiceTranscription } from '@expertly/ui'

function suggestPrefix(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) {
    return words[0].substring(0, 3).toUpperCase()
  }
  return words.slice(0, 4).map((w) => w[0]).join('').toUpperCase()
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newProduct, setNewProduct] = useState({ name: '', prefix: '', description: '' })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const data = await productsApi.list()
      setProducts(data)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!newProduct.name.trim()) return

    setCreating(true)
    try {
      const created = await productsApi.create(newProduct)
      setNewProduct({ name: '', prefix: '', description: '' })
      setDialogOpen(false)
      navigate(`/products/${created.id}`)
    } catch (error) {
      console.error('Error creating product:', error)
    } finally {
      setCreating(false)
    }
  }

  const totalRequirements = products.reduce((sum, p) => sum + (p.requirement_count || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="mb-2">
            <span className="text-sm text-gray-500">Expertly Define</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Product
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={createProduct}>
              <DialogHeader>
                <DialogTitle>Create New Product</DialogTitle>
                <DialogDescription>
                  Add a new product to manage its requirements.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Product Name
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., Automation Designer"
                      value={newProduct.name}
                      onChange={(e) => {
                        const name = e.target.value
                        const suggested = suggestPrefix(name)
                        if (!newProduct.prefix || newProduct.prefix === suggestPrefix(newProduct.name)) {
                          setNewProduct({ ...newProduct, name, prefix: suggested })
                        } else {
                          setNewProduct({ ...newProduct, name })
                        }
                      }}
                      required
                      className="flex-1"
                    />
                    <InlineVoiceTranscription
                      tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                      onTranscribe={(text) => {
                        const name = newProduct.name ? newProduct.name + ' ' + text : text
                        const suggested = suggestPrefix(name)
                        if (!newProduct.prefix || newProduct.prefix === suggestPrefix(newProduct.name)) {
                          setNewProduct({ ...newProduct, name, prefix: suggested })
                        } else {
                          setNewProduct({ ...newProduct, name })
                        }
                      }}
                      size="md"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Requirement Prefix
                  </label>
                  <Input
                    placeholder="e.g., AD"
                    value={newProduct.prefix}
                    onChange={(e) => setNewProduct({ ...newProduct, prefix: e.target.value.toUpperCase() })}
                    className="w-32 font-mono"
                    maxLength={6}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Used for requirement IDs (e.g., {newProduct.prefix || 'XX'}-001)
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Description (optional)
                  </label>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="What does this product do?"
                      value={newProduct.description}
                      onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      rows={3}
                      className="flex-1"
                    />
                    <InlineVoiceTranscription
                      tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                      onTranscribe={(text) => setNewProduct({ ...newProduct, description: newProduct.description ? newProduct.description + ' ' + text : text })}
                      size="md"
                      className="self-start mt-1"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating || !newProduct.name.trim() || !newProduct.prefix.trim()}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Product
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <Card className="mb-8">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Expertly Define</h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Start by creating a product to begin managing requirements, tracking implementations, and ensuring verification.
            </p>
            <Link to="/products">
              <Button>
                Create a product
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{products.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{totalRequirements}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Link to="/products">
                    <Button size="sm" variant="outline">
                      <FolderTree className="h-4 w-4 mr-2" />
                      Products
                    </Button>
                  </Link>
                  <Link to="/releases">
                    <Button size="sm" variant="outline">
                      <Package className="h-4 w-4 mr-2" />
                      Releases
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Products overview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Your Products</CardTitle>
              <Link to="/products">
                <Button size="sm" variant="outline">View all</Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.slice(0, 6).map((product) => (
                  <Link
                    key={product.id}
                    to={`/products/${product.id}`}
                    className="p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <Badge variant="outline" className="text-xs">
                        {product.prefix}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      {product.requirement_count || 0} requirements
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
