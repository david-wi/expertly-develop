'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Package, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface ReleaseSnapshot {
  id: string;
  productId: string;
  versionName: string;
  description: string | null;
  stats: string | null;
  status: string;
  createdAt: string;
  releasedAt: string | null;
}

interface Product {
  id: string;
  name: string;
}

export default function ReleasesPage() {
  const [releases, setReleases] = useState<ReleaseSnapshot[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRelease, setNewRelease] = useState({
    productId: '',
    versionName: '',
    description: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [releasesRes, productsRes] = await Promise.all([
        fetch('/api/releases'),
        fetch('/api/products'),
      ]);
      const releasesData = await releasesRes.json();
      const productsData = await productsRes.json();
      setReleases(Array.isArray(releasesData) ? releasesData : []);
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createRelease(e: React.FormEvent) {
    e.preventDefault();
    if (!newRelease.productId || !newRelease.versionName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch('/api/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRelease),
      });

      if (response.ok) {
        setNewRelease({ productId: '', versionName: '', description: '' });
        setDialogOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error('Error creating release:', error);
    } finally {
      setCreating(false);
    }
  }

  const productMap = new Map(products.map((p) => [p.id, p.name]));

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Release Snapshots</h1>
          <p className="text-gray-500 mt-1">Point-in-time views of your product requirements</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={products.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              New Snapshot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={createRelease}>
              <DialogHeader>
                <DialogTitle>Create Release Snapshot</DialogTitle>
                <DialogDescription>
                  Capture the current state of requirements for a release.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Product</label>
                  <Select
                    value={newRelease.productId}
                    onValueChange={(value) => setNewRelease({ ...newRelease, productId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Version Name
                  </label>
                  <Input
                    placeholder="e.g., 2026.1"
                    value={newRelease.versionName}
                    onChange={(e) => setNewRelease({ ...newRelease, versionName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Description (optional)
                  </label>
                  <Textarea
                    placeholder="What's in this release?"
                    value={newRelease.description}
                    onChange={(e) => setNewRelease({ ...newRelease, description: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating || !newRelease.productId || !newRelease.versionName.trim()}
                >
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Snapshot
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
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No products yet</h2>
            <p className="text-gray-500 mb-6">
              Create a product first before creating release snapshots.
            </p>
            <Link href="/products">
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
              Create your first release snapshot to track requirements over time.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create first snapshot
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {releases.map((release) => {
            const stats = release.stats ? JSON.parse(release.stats) : null;
            return (
              <Link key={release.id} href={`/releases/${release.id}`}>
                <Card className="hover:border-primary-300 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Package className="h-8 w-8 text-primary-600" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{release.versionName}</h3>
                            <Badge variant={release.status === 'released' ? 'success' : 'secondary'}>
                              {release.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">{productMap.get(release.productId)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(release.createdAt), 'MMM d, yyyy')}
                        </div>
                        {stats && (
                          <p className="text-sm text-gray-600">
                            {stats.verified || 0} of {stats.total || 0} verified
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
