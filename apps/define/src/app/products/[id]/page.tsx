'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Loader2,
  FileText,
  Search,
  ArrowLeft,
  Sparkles,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { BulkImportDialog } from '@/components/requirements/bulk-import-dialog';
import { JiraDraftsDialog } from '@/components/jira/jira-drafts-dialog';
import { ProductAvatar } from '@/components/products/product-avatar';
import { AvatarDialog } from '@/components/products/avatar-dialog';

interface Requirement {
  id: string;
  productId: string;
  parentId: string | null;
  stableKey: string;
  title: string;
  whatThisDoes: string | null;
  status: string;
  priority: string;
  tags: string | null;
  orderIndex: number;
  currentVersion: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  requirements: Requirement[];
}

interface TreeNode extends Requirement {
  children: TreeNode[];
  expanded?: boolean;
}

function buildTree(requirements: Requirement[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // First pass: create all nodes
  requirements.forEach((req) => {
    map.set(req.id, { ...req, children: [], expanded: true });
  });

  // Second pass: link children to parents
  requirements.forEach((req) => {
    const node = map.get(req.id)!;
    if (req.parentId && map.has(req.parentId)) {
      map.get(req.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort children by orderIndex
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.orderIndex - b.orderIndex);
    nodes.forEach((node) => sortChildren(node.children));
  };
  sortChildren(roots);

  return roots;
}

const statusColors: Record<string, string> = {
  draft: 'secondary',
  ready_to_build: 'default',
  implemented: 'success',
  verified: 'success',
};

const priorityColors: Record<string, string> = {
  critical: 'danger',
  high: 'warning',
  medium: 'secondary',
  low: 'secondary',
};

function RequirementTreeItem({
  node,
  level,
  selectedId,
  onSelect,
  onToggle,
}: {
  node: TreeNode;
  level: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors',
          selectedId === node.id && 'bg-primary-50 border-l-2 border-primary-600'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        <button
          className={cn(
            'p-0.5 rounded hover:bg-gray-200 transition-colors',
            !hasChildren && 'invisible'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.id);
          }}
        >
          {node.expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>
        <span className="text-sm font-medium text-gray-900 flex-1 truncate">
          {node.title}
        </span>
        <Badge variant={statusColors[node.status] as any} className="text-xs">
          {node.status.replace('_', ' ')}
        </Badge>
      </div>
      {hasChildren && node.expanded && (
        <div>
          {node.children.map((child) => (
            <RequirementTreeItem
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [jiraDraftsOpen, setJiraDraftsOpen] = useState(false);
  const [allDraftsOpen, setAllDraftsOpen] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newReq, setNewReq] = useState({
    title: '',
    whatThisDoes: '',
    whyThisExists: '',
    notIncluded: '',
    acceptanceCriteria: '',
    status: 'draft',
    priority: 'medium',
    tags: [] as string[],
    parentId: '',
  });

  useEffect(() => {
    fetchProduct();
  }, [id]);

  async function fetchProduct() {
    try {
      const response = await fetch(`/api/products/${id}`);
      if (response.ok) {
        const data = await response.json();
        setProduct(data);
        setTree(buildTree(data.requirements || []));
      }
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleToggle(nodeId: string) {
    const toggleNode = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, expanded: !node.expanded };
        }
        if (node.children.length > 0) {
          return { ...node, children: toggleNode(node.children) };
        }
        return node;
      });
    };
    setTree(toggleNode(tree));
  }

  async function createRequirement(e: React.FormEvent) {
    e.preventDefault();
    if (!newReq.title.trim()) return;

    setCreating(true);
    try {
      const response = await fetch('/api/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: id,
          title: newReq.title,
          whatThisDoes: newReq.whatThisDoes || null,
          whyThisExists: newReq.whyThisExists || null,
          notIncluded: newReq.notIncluded || null,
          acceptanceCriteria: newReq.acceptanceCriteria || null,
          status: newReq.status,
          priority: newReq.priority,
          tags: newReq.tags.length > 0 ? newReq.tags : null,
          parentId: newReq.parentId || null,
        }),
      });

      if (response.ok) {
        setNewReq({
          title: '',
          whatThisDoes: '',
          whyThisExists: '',
          notIncluded: '',
          acceptanceCriteria: '',
          status: 'draft',
          priority: 'medium',
          tags: [],
          parentId: '',
        });
        setDialogOpen(false);
        fetchProduct();
      }
    } catch (error) {
      console.error('Error creating requirement:', error);
    } finally {
      setCreating(false);
    }
  }

  const selectedRequirement = product?.requirements.find((r) => r.id === selectedId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="px-6 py-8 max-w-7xl mx-auto">
        <p className="text-gray-500">Product not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="px-6 py-8 max-w-7xl mx-auto">
        <div className="mb-2">
          <Link
            href="/products"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Products
          </Link>
        </div>
        <div className="flex items-center gap-4 mb-8">
          <ProductAvatar
            name={product.name}
            avatarUrl={product.avatarUrl}
            size="lg"
            onClick={() => setAvatarDialogOpen(true)}
            className="cursor-pointer hover:ring-2 hover:ring-primary-500 hover:ring-offset-2 transition-all"
          />
          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tree sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Product map</CardTitle>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setAllDraftsOpen(true)} title="Jira Drafts">
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setBulkImportOpen(true)} title="AI Import">
                    <Sparkles className="h-4 w-4" />
                  </Button>
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <form onSubmit={createRequirement}>
                      <DialogHeader>
                        <DialogTitle>Add Requirement</DialogTitle>
                        <DialogDescription>
                          Create a new requirement for {product.name}.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            Title
                          </label>
                          <Input
                            placeholder="e.g., Version History"
                            value={newReq.title}
                            onChange={(e) => setNewReq({ ...newReq, title: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            What this does
                          </label>
                          <Textarea
                            placeholder="Users can view, compare, and restore previous versions..."
                            value={newReq.whatThisDoes}
                            onChange={(e) => setNewReq({ ...newReq, whatThisDoes: e.target.value })}
                            rows={2}
                          />
                          <p className="text-xs text-gray-500 mt-1">One clear sentence starting with "Users can..."</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            Why this exists
                          </label>
                          <Textarea
                            placeholder="This helps people understand changes over time and recover safely from mistakes."
                            value={newReq.whyThisExists}
                            onChange={(e) => setNewReq({ ...newReq, whyThisExists: e.target.value })}
                            rows={2}
                          />
                          <p className="text-xs text-gray-500 mt-1">One or two sentences in plain English</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            Not included within this requirement
                          </label>
                          <Textarea
                            placeholder="• Branching or merging versions&#10;• Restoring only part of an automation"
                            value={newReq.notIncluded}
                            onChange={(e) => setNewReq({ ...newReq, notIncluded: e.target.value })}
                            rows={3}
                          />
                          <p className="text-xs text-gray-500 mt-1">Bullets that avoid confusion and scope creep</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            How we know it works
                          </label>
                          <Textarea
                            placeholder="• Users can see a list of versions with author and timestamp&#10;• Users can compare any two versions and clearly see what changed"
                            value={newReq.acceptanceCriteria}
                            onChange={(e) => setNewReq({ ...newReq, acceptanceCriteria: e.target.value })}
                            rows={3}
                          />
                          <p className="text-xs text-gray-500 mt-1">Acceptance criteria that can map to tests</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                              Status
                            </label>
                            <Select
                              value={newReq.status}
                              onValueChange={(value) => setNewReq({ ...newReq, status: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="ready_to_build">Ready to Build</SelectItem>
                                <SelectItem value="implemented">Implemented</SelectItem>
                                <SelectItem value="verified">Verified</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                              Priority
                            </label>
                            <Select
                              value={newReq.priority}
                              onValueChange={(value) => setNewReq({ ...newReq, priority: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            Tags
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {['functional', 'nonfunctional', 'security', 'performance', 'usability', 'invariant'].map((tag) => (
                              <label key={tag} className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newReq.tags.includes(tag)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setNewReq({ ...newReq, tags: [...newReq.tags, tag] });
                                    } else {
                                      setNewReq({ ...newReq, tags: newReq.tags.filter((t) => t !== tag) });
                                    }
                                  }}
                                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm text-gray-700">{tag}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        {product.requirements.length > 0 && (
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                              Parent (optional)
                            </label>
                            <Select
                              value={newReq.parentId || 'none'}
                              onValueChange={(value) => setNewReq({ ...newReq, parentId: value === 'none' ? '' : value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="None (root level)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None (root level)</SelectItem>
                                {product.requirements.map((req) => (
                                  <SelectItem key={req.id} value={req.id}>
                                    {req.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={creating || !newReq.title.trim()}>
                          {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Create
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {tree.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No requirements yet. Add one to get started.
                </p>
              ) : (
                <div className="space-y-1">
                  {tree.map((node) => (
                    <RequirementTreeItem
                      key={node.id}
                      node={node}
                      level={0}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detail panel */}
          <Card className="lg:col-span-2">
            {selectedRequirement ? (
              <>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {selectedRequirement.stableKey}
                    </Badge>
                    <Badge variant={priorityColors[selectedRequirement.priority] as any}>
                      {selectedRequirement.priority}
                    </Badge>
                  </div>
                  <CardTitle>{selectedRequirement.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-gray-600">
                      {selectedRequirement.whatThisDoes || 'No description yet.'}
                    </p>
                    <div className="flex gap-2">
                      <Link href={`/requirements/${selectedRequirement.id}`}>
                        <Button>Open requirement</Button>
                      </Link>
                      <Button variant="outline" onClick={() => setJiraDraftsOpen(true)}>
                        Draft Jira stories
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="py-24 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  Select a requirement from the tree to view details
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      <BulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        productId={id}
        productName={product.name}
        existingRequirements={product.requirements.map((r) => ({
          id: r.id,
          stableKey: r.stableKey,
          title: r.title,
          parentId: r.parentId,
        }))}
        onSuccess={fetchProduct}
      />

      {selectedRequirement && (
        <JiraDraftsDialog
          open={jiraDraftsOpen}
          onOpenChange={setJiraDraftsOpen}
          productId={id}
          productName={product.name}
          requirementId={selectedRequirement.id}
          requirementTitle={selectedRequirement.title}
        />
      )}

      <JiraDraftsDialog
        open={allDraftsOpen}
        onOpenChange={setAllDraftsOpen}
        productId={id}
        productName={product.name}
      />

      <AvatarDialog
        open={avatarDialogOpen}
        onOpenChange={setAvatarDialogOpen}
        productId={id}
        productName={product.name}
        productDescription={product.description}
        currentAvatarUrl={product.avatarUrl}
        onAvatarChange={(avatarUrl) => {
          setProduct({ ...product, avatarUrl });
        }}
      />
    </div>
  );
}
