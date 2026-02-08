import { useState, useEffect } from 'react'
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Loader2,
  FileText,
  Search,
  ArrowLeft,
  Paperclip,
  Sparkles,
  Pencil,
  List,
  BookOpen,
  Trash2,
  Folder,
  FolderOpen,
  CircleDot,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { productsApi, requirementsApi, Product, Requirement } from '@/api/client'
import { ArtifactList } from '@/components/artifacts'
import { BulkImportDialog } from '@/components/BulkImportDialog'
import { ProductAvatar } from '@/components/products/ProductAvatar'
import { AvatarDialog } from '@/components/products/AvatarDialog'
import { ProductEditDialog } from '@/components/products/ProductEditDialog'
import { DocumentView } from '@/components/DocumentView'
import { InlineVoiceTranscription } from '@expertly/ui'

interface TreeNode extends Requirement {
  children: TreeNode[]
  expanded?: boolean
}

function buildTree(requirements: Requirement[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  requirements.forEach((req) => {
    map.set(req.id, { ...req, children: [], expanded: false })
  })

  requirements.forEach((req) => {
    const node = map.get(req.id)!
    if (req.parent_id && map.has(req.parent_id)) {
      map.get(req.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.order_index - b.order_index)
    nodes.forEach((node) => sortChildren(node.children))
  }
  sortChildren(roots)

  return roots
}

const statusColors: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'danger'> = {
  draft: 'secondary',
  ready_to_build: 'default',
  implemented: 'success',
  verified: 'success',
}

const priorityColors: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'danger'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'secondary',
  low: 'secondary',
}

function RequirementTreeItem({
  node,
  level,
  selectedId,
  onSelect,
  onToggle,
}: {
  node: TreeNode
  level: number
  selectedId: string | null
  onSelect: (id: string) => void
  onToggle: (id: string) => void
}) {
  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors',
          hasChildren
            ? 'hover:bg-primary-50/60'
            : 'hover:bg-gray-50',
          isSelected && 'bg-primary-50 ring-1 ring-primary-200',
          hasChildren && !isSelected && 'bg-gray-50/50',
          level === 0 && hasChildren && 'mt-1',
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button
            className="p-0.5 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              onToggle(node.id)
            }}
          >
            {node.expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}
        {hasChildren ? (
          node.expanded ? (
            <FolderOpen className="h-4 w-4 text-primary-500 flex-shrink-0" />
          ) : (
            <Folder className="h-4 w-4 text-primary-400 flex-shrink-0" />
          )
        ) : (
          <CircleDot className="h-3 w-3 text-gray-300 flex-shrink-0" />
        )}
        <span
          className={cn(
            'text-sm flex-1 min-w-0',
            hasChildren
              ? 'font-medium text-gray-900'
              : 'font-normal text-gray-600',
          )}
        >
          {node.title}
        </span>
        {!hasChildren && (
          <span className="text-[10px] font-mono text-gray-300 flex-shrink-0">
            {node.stable_key}
          </span>
        )}
        <Badge variant={statusColors[node.status]} className="text-xs flex-shrink-0">
          {node.status.replace('_', ' ')}
        </Badge>
      </div>
      {hasChildren && node.expanded && (
        <div className="ml-3 border-l border-gray-200" style={{ marginLeft: `${level * 20 + 18}px` }}>
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
  )
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const activeTab = location.pathname.endsWith('/artifacts') ? 'artifacts' : 'requirements'
  const [product, setProduct] = useState<Product | null>(null)
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [loading, setLoading] = useState(true)
  const [tree, setTree] = useState<TreeNode[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newReq, setNewReq] = useState({
    title: '',
    what_this_does: '',
    why_this_exists: '',
    not_included: '',
    acceptance_criteria: '',
    status: 'draft',
    priority: '',
    tags: [] as string[],
    parent_id: '',
  })
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'tree' | 'document'>('tree')
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (id) fetchProduct()
  }, [id])

  async function fetchProduct() {
    try {
      const [productData, requirementsData] = await Promise.all([
        productsApi.get(id!),
        requirementsApi.list(id!),
      ])
      setProduct(productData)
      setRequirements(requirementsData)
      setTree(buildTree(requirementsData))
    } catch (error) {
      console.error('Error fetching product:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleToggle(nodeId: string) {
    const toggleAccordion = (nodes: TreeNode[], expanding: boolean): TreeNode[] => {
      return nodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, expanded: !node.expanded, children: toggleAccordion(node.children, false) }
        }
        // Collapse siblings when another node at this level is being expanded
        if (expanding) {
          return { ...node, expanded: false, children: collapseAll(node.children) }
        }
        if (node.children.length > 0) {
          return { ...node, children: toggleAccordion(node.children, false) }
        }
        return node
      })
    }

    const collapseAll = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map((node) => ({
        ...node,
        expanded: false,
        children: collapseAll(node.children),
      }))
    }

    // Find whether the target node is currently expanded
    const findNode = (nodes: TreeNode[]): TreeNode | null => {
      for (const node of nodes) {
        if (node.id === nodeId) return node
        const found = findNode(node.children)
        if (found) return found
      }
      return null
    }
    const target = findNode(tree)
    const willExpand = target ? !target.expanded : false

    // When expanding, pass that info so siblings at the same level get collapsed
    const applyToggle = (nodes: TreeNode[]): TreeNode[] => {
      let found = false
      for (const node of nodes) {
        if (node.id === nodeId) { found = true; break }
      }
      if (found) {
        return toggleAccordion(nodes, willExpand)
      }
      return nodes.map((node) => {
        if (node.children.length > 0) {
          return { ...node, children: applyToggle(node.children) }
        }
        return node
      })
    }

    setTree(applyToggle(tree))
  }

  async function createRequirement(e: React.FormEvent) {
    e.preventDefault()
    if (!newReq.title.trim()) return

    setCreating(true)
    try {
      await requirementsApi.create({
        product_id: id!,
        title: newReq.title,
        what_this_does: newReq.what_this_does || undefined,
        why_this_exists: newReq.why_this_exists || undefined,
        not_included: newReq.not_included || undefined,
        acceptance_criteria: newReq.acceptance_criteria || undefined,
        status: newReq.status,
        priority: newReq.priority || undefined,
        tags: newReq.tags.length > 0 ? newReq.tags : undefined,
        parent_id: newReq.parent_id || null,
      })

      setNewReq({
        title: '',
        what_this_does: '',
        why_this_exists: '',
        not_included: '',
        acceptance_criteria: '',
        status: 'draft',
        priority: '',
        tags: [],
        parent_id: '',
      })
      setDialogOpen(false)
      fetchProduct()
    } catch (error) {
      console.error('Error creating requirement:', error)
    } finally {
      setCreating(false)
    }
  }

  async function clearAllRequirements() {
    setClearing(true)
    try {
      await requirementsApi.clearAll(id!)
      setClearDialogOpen(false)
      setSelectedId(null)
      fetchProduct()
    } catch (error) {
      console.error('Error clearing requirements:', error)
    } finally {
      setClearing(false)
    }
  }

  const selectedRequirement = requirements.find((r) => r.id === selectedId)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="px-6 py-8 max-w-7xl mx-auto">
        <p className="text-gray-500">Product not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="px-6 py-4 max-w-7xl mx-auto">
        <div className="mb-1">
          <Link
            to="/products"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Products
          </Link>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <ProductAvatar
            name={product.name}
            avatarUrl={product.avatar_url}
            size="md"
            onClick={() => setAvatarDialogOpen(true)}
            className="cursor-pointer hover:ring-2 hover:ring-primary-500 hover:ring-offset-2 transition-all"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditDialogOpen(true)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            {product.description && (
              <p className="text-gray-600 mt-1">{product.description}</p>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => {
          navigate(value === 'artifacts' ? `/products/${id}/artifacts` : `/products/${id}`, { replace: false })
        }}>
          <TabsList>
            <TabsTrigger value="requirements" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Requirements
            </TabsTrigger>
            <TabsTrigger value="artifacts" className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Artifacts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requirements">
            {/* View mode toggle */}
            <div className="flex items-center justify-end mb-4 gap-1">
              <Button
                size="sm"
                variant={viewMode === 'tree' ? 'default' : 'outline'}
                onClick={() => setViewMode('tree')}
                title="Tree view"
              >
                <List className="h-4 w-4 mr-1.5" />
                Tree
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'document' ? 'default' : 'outline'}
                onClick={() => setViewMode('document')}
                title="Document view"
              >
                <BookOpen className="h-4 w-4 mr-1.5" />
                Document
              </Button>
            </div>

            {viewMode === 'document' ? (
              <Card>
                <CardContent className="py-6">
                  <DocumentView requirements={requirements} productName={product.name} />
                </CardContent>
              </Card>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tree sidebar */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Product map</CardTitle>
                    <div className="flex gap-1">
                      {requirements.length > 0 && (
                        <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" title="Clear all requirements" className="text-red-500 hover:text-red-700 hover:border-red-300">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Clear all requirements?</DialogTitle>
                              <DialogDescription>
                                This will remove all {requirements.length} requirement{requirements.length !== 1 ? 's' : ''} from {product.name}. This action can be undone by an administrator.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button onClick={clearAllRequirements} disabled={clearing} className="bg-red-600 text-white hover:bg-red-700">
                                {clearing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Clear all
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setBulkImportOpen(true)} title="AI Import">
                        <Sparkles className="h-4 w-4" />
                      </Button>
                      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
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
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="e.g., Version History"
                                    value={newReq.title}
                                    onChange={(e) => setNewReq({ ...newReq, title: e.target.value })}
                                    required
                                    className="flex-1"
                                  />
                                  <InlineVoiceTranscription
                                    tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                                    onTranscribe={(text) => setNewReq({ ...newReq, title: newReq.title ? newReq.title + ' ' + text : text })}
                                    size="md"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                                    What this does
                                  </label>
                                  <div className="flex gap-2">
                                    <Textarea
                                      placeholder="Users can view, compare, and restore previous versions..."
                                      value={newReq.what_this_does}
                                      onChange={(e) => setNewReq({ ...newReq, what_this_does: e.target.value })}
                                      rows={3}
                                      className="flex-1"
                                    />
                                    <InlineVoiceTranscription
                                      tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                                      onTranscribe={(text) => setNewReq({ ...newReq, what_this_does: newReq.what_this_does ? newReq.what_this_does + ' ' + text : text })}
                                      size="sm"
                                      className="self-start mt-1"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                                    Why this exists
                                  </label>
                                  <div className="flex gap-2">
                                    <Textarea
                                      placeholder="This helps people understand changes over time..."
                                      value={newReq.why_this_exists}
                                      onChange={(e) => setNewReq({ ...newReq, why_this_exists: e.target.value })}
                                      rows={3}
                                      className="flex-1"
                                    />
                                    <InlineVoiceTranscription
                                      tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                                      onTranscribe={(text) => setNewReq({ ...newReq, why_this_exists: newReq.why_this_exists ? newReq.why_this_exists + ' ' + text : text })}
                                      size="sm"
                                      className="self-start mt-1"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                                    Acceptance criteria
                                  </label>
                                  <div className="flex gap-2">
                                    <Textarea
                                      placeholder="How we'll know this is done..."
                                      value={newReq.acceptance_criteria}
                                      onChange={(e) => setNewReq({ ...newReq, acceptance_criteria: e.target.value })}
                                      rows={3}
                                      className="flex-1"
                                    />
                                    <InlineVoiceTranscription
                                      tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                                      onTranscribe={(text) => setNewReq({ ...newReq, acceptance_criteria: newReq.acceptance_criteria ? newReq.acceptance_criteria + ' ' + text : text })}
                                      size="sm"
                                      className="self-start mt-1"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                                    Not included (out of scope)
                                  </label>
                                  <div className="flex gap-2">
                                    <Textarea
                                      placeholder="Things explicitly not part of this requirement..."
                                      value={newReq.not_included}
                                      onChange={(e) => setNewReq({ ...newReq, not_included: e.target.value })}
                                      rows={3}
                                      className="flex-1"
                                    />
                                    <InlineVoiceTranscription
                                      tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                                      onTranscribe={(text) => setNewReq({ ...newReq, not_included: newReq.not_included ? newReq.not_included + ' ' + text : text })}
                                      size="sm"
                                      className="self-start mt-1"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-4 gap-4">
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
                                    value={newReq.priority || 'none'}
                                    onValueChange={(value) => setNewReq({ ...newReq, priority: value === 'none' ? '' : value })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Not set" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Not set</SelectItem>
                                      <SelectItem value="critical">Critical</SelectItem>
                                      <SelectItem value="high">High</SelectItem>
                                      <SelectItem value="medium">Medium</SelectItem>
                                      <SelectItem value="low">Low</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {requirements.length > 0 && (
                                  <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                                      Parent
                                    </label>
                                    <Select
                                      value={newReq.parent_id || 'none'}
                                      onValueChange={(value) => setNewReq({ ...newReq, parent_id: value === 'none' ? '' : value })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="None (root level)" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">None (root level)</SelectItem>
                                        {requirements.map((req) => (
                                          <SelectItem key={req.id} value={req.id}>
                                            {req.title}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                                <div className={requirements.length > 0 ? '' : 'col-span-2'}>
                                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                                    Tags
                                  </label>
                                  <Input
                                    placeholder="auth, security, mvp"
                                    value={newReq.tags.join(', ')}
                                    onChange={(e) => setNewReq({
                                      ...newReq,
                                      tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                                    })}
                                  />
                                </div>
                              </div>
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

              {/* Detail panel - sticky so it stays visible while scrolling the tree */}
              <div className="lg:col-span-1">
                <Card className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
                  {selectedRequirement ? (
                    <>
                      <CardHeader>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {selectedRequirement.stable_key}
                          </Badge>
                          <Badge variant={priorityColors[selectedRequirement.priority]}>
                            {selectedRequirement.priority}
                          </Badge>
                        </div>
                        <CardTitle>{selectedRequirement.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <p className="text-gray-600">
                            {selectedRequirement.what_this_does || 'No description yet.'}
                          </p>
                          <div className="flex gap-2">
                            <Link to={`/requirements/${selectedRequirement.id}`}>
                              <Button>Open requirement</Button>
                            </Link>
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
            )}
          </TabsContent>

          <TabsContent value="artifacts">
            <ArtifactList
              productId={id!}
              productName={product.name}
              existingRequirements={requirements.map((r) => ({
                id: r.id,
                stable_key: r.stable_key,
                title: r.title,
                parent_id: r.parent_id,
              }))}
              onRequirementsGenerated={fetchProduct}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        productId={id!}
        productName={product.name}
        existingRequirements={requirements.map((r) => ({
          id: r.id,
          stable_key: r.stable_key,
          title: r.title,
          parent_id: r.parent_id,
        }))}
        onSuccess={fetchProduct}
      />

      {/* Avatar Dialog */}
      <AvatarDialog
        open={avatarDialogOpen}
        onOpenChange={setAvatarDialogOpen}
        product={product}
        onAvatarChange={(avatarUrl) => {
          setProduct({ ...product, avatar_url: avatarUrl })
        }}
      />

      {/* Edit Dialog */}
      <ProductEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        product={product}
        onProductUpdate={(updated) => {
          setProduct(updated)
        }}
      />
    </div>
  )
}
