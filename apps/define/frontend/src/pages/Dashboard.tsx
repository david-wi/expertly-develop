import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { productsApi, Product } from '@/api/client'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowRight,
  FileText,
  FolderTree,
  Package,
  Loader2,
} from 'lucide-react'

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

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

  const totalRequirements = products.reduce((sum, p) => sum + (p.requirement_count || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <div className="mb-2">
        <span className="text-sm text-gray-500">ExpertlyAI</span>
      </div>
      <h1 className="text-4xl font-bold text-gray-900 mb-8">Today</h1>

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
                    className="p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50/50 transition-colors"
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
