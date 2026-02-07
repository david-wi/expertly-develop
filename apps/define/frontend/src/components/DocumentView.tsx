import { Badge } from '@/components/ui/badge'
import { Requirement } from '@/api/client'

interface TreeNode extends Requirement {
  children: TreeNode[]
}

function buildTree(requirements: Requirement[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  requirements.forEach((req) => {
    map.set(req.id, { ...req, children: [] })
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

function RequirementSection({ node, depth }: { node: TreeNode; depth: number }) {
  // h2 for depth 0, h3 for depth 1, h4 for deeper
  const HeadingTag = depth === 0 ? 'h2' : depth === 1 ? 'h3' : 'h4'
  const headingClass =
    depth === 0
      ? 'text-xl font-bold text-gray-900 mt-8 mb-3'
      : depth === 1
        ? 'text-lg font-semibold text-gray-900 mt-6 mb-2'
        : 'text-base font-semibold text-gray-800 mt-4 mb-2'

  const sectionNumber = node.stable_key

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-gray-100 pl-6' : ''}>
      <div className="flex items-center gap-3 flex-wrap">
        <HeadingTag className={headingClass}>
          <span className="text-gray-400 font-mono text-sm mr-2">{sectionNumber}</span>
          {node.title}
        </HeadingTag>
        <div className="flex gap-1.5 items-center">
          <Badge variant={statusColors[node.status]} className="text-xs">
            {node.status.replace('_', ' ')}
          </Badge>
          {node.priority && (
            <Badge variant={priorityColors[node.priority]} className="text-xs">
              {node.priority}
            </Badge>
          )}
        </div>
      </div>

      {node.what_this_does && (
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-500 mb-1">What this does</p>
          <p className="text-gray-700 whitespace-pre-wrap">{node.what_this_does}</p>
        </div>
      )}

      {node.why_this_exists && (
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-500 mb-1">Why this exists</p>
          <p className="text-gray-700 whitespace-pre-wrap">{node.why_this_exists}</p>
        </div>
      )}

      {node.acceptance_criteria && (
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-500 mb-1">Acceptance criteria</p>
          <p className="text-gray-700 whitespace-pre-wrap">{node.acceptance_criteria}</p>
        </div>
      )}

      {node.not_included && (
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-500 mb-1">Not included</p>
          <p className="text-gray-700 whitespace-pre-wrap">{node.not_included}</p>
        </div>
      )}

      {node.tags && (
        <div className="mb-3 flex gap-1.5 flex-wrap">
          {(typeof node.tags === 'string' ? node.tags.split(',') : []).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag.trim()}
            </Badge>
          ))}
        </div>
      )}

      {node.children.length > 0 && (
        <div className="mt-2">
          {node.children.map((child) => (
            <RequirementSection key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

interface DocumentViewProps {
  requirements: Requirement[]
  productName: string
}

export function DocumentView({ requirements, productName }: DocumentViewProps) {
  const tree = buildTree(requirements)

  if (requirements.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No requirements yet. Add some to see the full document.
      </div>
    )
  }

  const stats = {
    total: requirements.length,
    draft: requirements.filter((r) => r.status === 'draft').length,
    readyToBuild: requirements.filter((r) => r.status === 'ready_to_build').length,
    implemented: requirements.filter((r) => r.status === 'implemented').length,
    verified: requirements.filter((r) => r.status === 'verified').length,
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Document header */}
      <div className="mb-8 pb-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {productName} — Requirements Document
        </h1>
        <div className="flex gap-4 text-sm text-gray-500">
          <span>{stats.total} requirements</span>
          {stats.draft > 0 && <span>{stats.draft} draft</span>}
          {stats.readyToBuild > 0 && <span>{stats.readyToBuild} ready to build</span>}
          {stats.implemented > 0 && <span>{stats.implemented} implemented</span>}
          {stats.verified > 0 && <span>{stats.verified} verified</span>}
        </div>
      </div>

      {/* Table of contents */}
      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm font-semibold text-gray-700 mb-2">Table of Contents</p>
        <TableOfContents nodes={tree} depth={0} />
      </div>

      {/* Full document */}
      <div className="document-body">
        {tree.map((node) => (
          <RequirementSection key={node.id} node={node} depth={0} />
        ))}
      </div>
    </div>
  )
}

function TableOfContents({ nodes, depth }: { nodes: TreeNode[]; depth: number }) {
  return (
    <ul className={depth === 0 ? 'space-y-1' : 'ml-4 space-y-0.5'}>
      {nodes.map((node) => (
        <li key={node.id}>
          <span className="text-sm text-gray-600">
            <span className="font-mono text-gray-400 mr-1.5">{node.stable_key}</span>
            {node.title}
          </span>
          {node.children.length > 0 && (
            <TableOfContents nodes={node.children} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  )
}
