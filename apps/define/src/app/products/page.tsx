'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, FolderTree, Loader2 } from 'lucide-react';
import { ProductAvatar } from '@/components/products/product-avatar';

interface Product {
  id: string;
  name: string;
  prefix: string;
  description: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  requirementCount: number;
}

// Generate a suggested prefix from product name
function suggestPrefix(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) {
    return words[0].substring(0, 3).toUpperCase();
  }
  return words
    .slice(0, 4)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', prefix: '', description: '' });

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const response = await fetch('/api/products');
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!newProduct.name.trim()) return;

    setCreating(true);
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct),
      });

      if (response.ok) {
        setNewProduct({ name: '', prefix: '', description: '' });
        setDialogOpen(false);
        fetchProducts();
      }
    } catch (error) {
      console.error('Error creating product:', error);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 mt-1">Manage your product requirements</p>
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
                  <Input
                    placeholder="e.g., Automation Designer"
                    value={newProduct.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const suggested = suggestPrefix(name);
                      // Auto-update prefix if user hasn't manually edited it
                      if (!newProduct.prefix || newProduct.prefix === suggestPrefix(newProduct.name)) {
                        setNewProduct({ ...newProduct, name, prefix: suggested });
                      } else {
                        setNewProduct({ ...newProduct, name });
                      }
                    }}
                    required
                  />
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
                  <Textarea
                    placeholder="What does this product do?"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    rows={3}
                  />
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderTree className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No products yet</h2>
            <p className="text-gray-500 mb-6">
              Create a product to start managing requirements.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create a product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Link key={product.id} href={`/products/${product.id}`}>
              <Card className="h-full hover:border-primary-300 hover:shadow-md transition-all cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <ProductAvatar
                      name={product.name}
                      avatarUrl={product.avatarUrl}
                      size="md"
                    />
                    {product.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {product.description && (
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                  <div className="text-sm text-gray-600">
                    {product.requirementCount} requirement{product.requirementCount !== 1 ? 's' : ''}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
