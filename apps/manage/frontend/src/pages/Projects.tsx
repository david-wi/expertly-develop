import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Modal, ModalFooter } from '@expertly/ui'
import { ChevronRight } from 'lucide-react'
import { api, Project, ProjectStatus, CreateProjectRequest } from '../services/api'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import ProjectTypeahead from '../components/ProjectTypeahead'

// Local storage keys
const COLLAPSED_KEY = 'expertly-manage-collapsed-projects'
const VIEW_MODE_KEY = 'expertly-manage-projects-view-mode'

type ViewMode = 'tree' | 'compact'

function getViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY)
    if (stored === 'tree') return 'tree'
  } catch {
    // Ignore storage errors
  }
  return 'compact'
}

function saveViewMode(mode: ViewMode) {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode)
  } catch {
    // Ignore storage errors
  }
}

function getCollapsedProjects(): Set<string> {
  try {
    const stored = localStorage.getItem(COLLAPSED_KEY)
    if (stored) {
      return new Set(JSON.parse(stored))
    }
  } catch {
    // Ignore storage errors
  }
  return new Set()
}

function saveCollapsedProjects(collapsed: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]))
  } catch {
    // Ignore storage errors
  }
}

// Tree node structure for hierarchical display
interface TreeNode {
  project: Project
  children: TreeNode[]
  depth: number
  taskCount: number
}

// Get all descendant IDs of a project (to prevent circular references)
function getDescendantIds(projectId: string, projects: Project[]): Set<string> {
  const descendants = new Set<string>()
  const findDescendants = (parentId: string) => {
    for (const project of projects) {
      const id = project._id || project.id
      if (project.parent_project_id === parentId) {
        descendants.add(id)
        findDescendants(id)
      }
    }
  }
  findDescendants(projectId)
  return descendants
}

// Build tree structure from flat list
function buildTree(projects: Project[], taskCounts: Map<string, number>): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  // Create nodes for all projects (depth will be set later)
  for (const project of projects) {
    const id = project._id || project.id
    map.set(id, {
      project,
      children: [],
      depth: 0,
      taskCount: taskCounts.get(id) || 0,
    })
  }

  // Build tree structure (parent-child relationships)
  for (const project of projects) {
    const id = project._id || project.id
    const node = map.get(id)!
    if (project.parent_project_id && map.has(project.parent_project_id)) {
      const parent = map.get(project.parent_project_id)!
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Calculate depths recursively after tree is built
  // This ensures correct depth even if projects were processed out of order
  const setDepths = (nodes: TreeNode[], depth: number) => {
    for (const node of nodes) {
      node.depth = depth
      setDepths(node.children, depth + 1)
    }
  }
  setDepths(roots, 0)

  // Sort children by name
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.project.name.localeCompare(b.project.name))
    for (const node of nodes) {
      sortChildren(node.children)
    }
  }
  sortChildren(roots)

  return roots
}

// Flatten tree for rendering while preserving hierarchy
// Skip children of collapsed nodes
function flattenTree(nodes: TreeNode[], collapsedProjects: Set<string>): TreeNode[] {
  const result: TreeNode[] = []
  const flatten = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      result.push(node)
      const nodeId = node.project._id || node.project.id
      // Only recurse into children if not collapsed
      if (!collapsedProjects.has(nodeId)) {
        flatten(node.children)
      }
    }
  }
  flatten(nodes)
  return result
}

// Get total descendant count for a node
function getDescendantCount(node: TreeNode): number {
  let count = node.children.length
  for (const child of node.children) {
    count += getDescendantCount(child)
  }
  return count
}


export default function Projects() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [taskCounts, setTaskCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [saving, setSaving] = useState(false)

  // Collapse state
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(() => getCollapsedProjects())

  // View mode state (tree vs compact)
  const [viewMode, setViewMode] = useState<ViewMode>(() => getViewMode())

  // Form state
  const [formData, setFormData] = useState<CreateProjectRequest & { status?: ProjectStatus }>({
    name: '',
    description: '',
    parent_project_id: null,
  })

  // Track unsaved changes for create modal
  const hasCreateChanges = useMemo(() => {
    if (!showCreateModal) return false
    return formData.name.trim() !== '' || (formData.description?.trim() || '') !== ''
  }, [showCreateModal, formData.name, formData.description])

  // Track unsaved changes for edit modal
  const hasEditChanges = useMemo(() => {
    if (!showEditModal || !selectedProject) return false
    return formData.name !== selectedProject.name ||
           (formData.description || '') !== (selectedProject.description || '') ||
           formData.status !== selectedProject.status ||
           formData.parent_project_id !== (selectedProject.parent_project_id || null)
  }, [showEditModal, selectedProject, formData.name, formData.description, formData.status, formData.parent_project_id])

  const hasUnsavedChanges = hasCreateChanges || hasEditChanges
  const { confirmClose } = useUnsavedChanges(hasUnsavedChanges)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: { status?: string } = {}
      if (statusFilter) {
        params.status = statusFilter
      }
      const projectsData = await api.getProjects(params)
      setProjects(projectsData)

      // Fetch task counts for each project
      const counts = new Map<string, number>()
      await Promise.all(
        projectsData.map(async (project) => {
          const projectId = project._id || project.id
          try {
            const tasks = await api.getProjectTasks(projectId)
            counts.set(projectId, tasks.length)
          } catch {
            counts.set(projectId, 0)
          }
        })
      )
      setTaskCounts(counts)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load projects'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle parent query parameter for "Add Subproject" flow
  useEffect(() => {
    const parentId = searchParams.get('parent')
    if (parentId && !loading) {
      // Open create modal with parent pre-selected
      setFormData({
        name: '',
        description: '',
        parent_project_id: parentId,
      })
      setShowCreateModal(true)
      // Clear the query parameter
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, loading, setSearchParams])

  // Build tree and flatten for display
  const treeNodes = buildTree(projects, taskCounts)
  const flatNodes = flattenTree(treeNodes, collapsedProjects)

  // Toggle collapse state
  const toggleCollapse = (projectId: string) => {
    const newCollapsed = new Set(collapsedProjects)
    if (newCollapsed.has(projectId)) {
      newCollapsed.delete(projectId)
    } else {
      newCollapsed.add(projectId)
    }
    setCollapsedProjects(newCollapsed)
    saveCollapsedProjects(newCollapsed)
  }

  // Toggle view mode
  const toggleViewMode = () => {
    const newMode = viewMode === 'tree' ? 'compact' : 'tree'
    setViewMode(newMode)
    saveViewMode(newMode)
  }

  // Get direct leaf children only (not recursive descendants)
  // Recursive descendants will be shown under their intermediate parent's own row
  const getDirectLeafChildren = (node: TreeNode): TreeNode[] => {
    return node.children.filter(child => child.children.length === 0)
  }

  // For compact view, get nodes that have children (to show as rows with inline leaf tags)
  const getCompactViewNodes = (nodes: TreeNode[]): TreeNode[] => {
    const result: TreeNode[] = []
    const collect = (nodeList: TreeNode[], depth: number) => {
      for (const node of nodeList) {
        // Include this node if it has children OR if it's a top-level project
        if (node.children.length > 0 || depth === 0) {
          result.push(node)
          // Recurse into children that have their own children
          const nonLeafChildren = node.children.filter(c => c.children.length > 0)
          if (nonLeafChildren.length > 0) {
            collect(nonLeafChildren, depth + 1)
          }
        }
      }
    }
    collect(nodes, 0)
    return result
  }

  // Build a map from project ID to tree node for quick lookup
  const nodeMap = new Map<string, TreeNode>()
  const buildNodeMap = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      nodeMap.set(node.project._id || node.project.id, node)
      buildNodeMap(node.children)
    }
  }
  buildNodeMap(treeNodes)

  // ==========================================================================
  // DRAG AND DROP FOR PROJECT REPARENTING
  // ==========================================================================
  // This implementation uses native HTML5 drag-and-drop to allow users to
  // drag projects onto other projects to change their parent (reparenting).
  //
  // KEY IMPLEMENTATION DETAILS (solving issues that took many attempts):
  //
  // 1. REACT RE-RENDER CANCELLATION FIX:
  //    HTML5 drag-and-drop has a known issue with React: if you call setState()
  //    during the dragstart event, React re-renders the component, which cancels
  //    the drag operation. The browser fires dragstart, then dragend immediately.
  //
  //    Solution: Use a ref (draggedIdRef) to store the dragged ID immediately
  //    (no re-render), then use requestAnimationFrame() to delay the setState()
  //    until after the drag has been established. The ref serves as a fallback
  //    in event handlers since the state may not have updated yet.
  //
  // 2. LARGER DRAG TARGET AREA:
  //    Originally, only a small 28x28px grip icon was draggable, making it hard
  //    to initiate drags. Now the entire <td> cell (project name column) is
  //    draggable, with the grip icon serving as a visual indicator only.
  //    This matches the fix applied to the dashboard widget drag-and-drop.
  //
  // 3. PREVENTING INVALID DROPS:
  //    - Can't drop a project onto itself
  //    - Can't drop a project onto its own descendants (would create a cycle)
  //    - The getDescendantIds() helper finds all descendants to check this
  //
  // 4. EDGE-BASED DROP ZONES:
  //    Dropping on a row can result in different parent assignments:
  //    - Middle of row (50% center): Makes dragged item a CHILD of target
  //    - Top/bottom edge (25% each): Makes dragged item a SIBLING of target
  //      (same parent as target)
  //    Visual feedback: Blue ring for child drop, blue line for sibling drop
  //    This allows "pulling out" an item to a higher level without using the
  //    root drop zone.
  // ==========================================================================

  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null)
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null)
  const [isDraggingToRoot, setIsDraggingToRoot] = useState(false)
  // Drop zone type: 'inside' = make child, 'before'/'after' = make sibling (same parent as target)
  const [dropZone, setDropZone] = useState<'inside' | 'before' | 'after'>('inside')
  // Ref to track dragged ID without triggering re-renders (see explanation above)
  const draggedIdRef = useRef<string | null>(null)

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    // Set data transfer first - required for drag to work
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', projectId)
    // Store in ref immediately (no re-render) - critical for drag to not cancel
    draggedIdRef.current = projectId
    // Delay React state update to avoid re-render cancelling the drag
    requestAnimationFrame(() => {
      setDraggedProjectId(projectId)
    })
  }

  const handleDragEnd = () => {
    draggedIdRef.current = null
    setDraggedProjectId(null)
    setDragOverProjectId(null)
    setIsDraggingToRoot(false)
    setDropZone('inside')
  }

  const handleDragOver = (e: React.DragEvent, projectId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    // Use ref as fallback since state may not have updated yet
    const currentDraggedId = draggedProjectId || draggedIdRef.current
    if (currentDraggedId && currentDraggedId !== projectId) {
      // Check if target is not a descendant of dragged project
      const descendants = getDescendantIds(currentDraggedId, projects)
      if (!descendants.has(projectId)) {
        setDragOverProjectId(projectId)
        setIsDraggingToRoot(false)

        // Detect drop zone based on mouse position within the row
        // Edge zones (top/bottom 25%) = drop as sibling, middle = drop as child
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const relativeY = e.clientY - rect.top
        const edgeThreshold = rect.height * 0.25

        if (relativeY < edgeThreshold) {
          setDropZone('before')
        } else if (relativeY > rect.height - edgeThreshold) {
          setDropZone('after')
        } else {
          setDropZone('inside')
        }
      }
    }
  }

  const handleDragLeave = () => {
    setDragOverProjectId(null)
    setDropZone('inside')
  }

  const handleDrop = async (e: React.DragEvent, targetProjectId: string | null, zone: 'inside' | 'before' | 'after' = 'inside') => {
    e.preventDefault()
    const sourceProjectId = e.dataTransfer.getData('text/plain')
    if (!sourceProjectId || sourceProjectId === targetProjectId) {
      handleDragEnd()
      return
    }

    // Prevent dropping onto descendants
    if (targetProjectId) {
      const descendants = getDescendantIds(sourceProjectId, projects)
      if (descendants.has(targetProjectId)) {
        handleDragEnd()
        return
      }
    }

    // Determine the new parent based on drop zone
    let newParentId: string | null = targetProjectId
    if (zone === 'before' || zone === 'after') {
      // Drop as sibling: use target's parent instead of target itself
      if (targetProjectId) {
        const targetProject = projects.find(p => (p._id || p.id) === targetProjectId)
        newParentId = targetProject?.parent_project_id || null
      } else {
        newParentId = null
      }
    }

    try {
      // Pass null explicitly to make a project top-level (removing parent)
      // Pass the newParentId to make it a child of that project
      await api.updateProject(sourceProjectId, {
        parent_project_id: newParentId,
      })
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to move project'
      setError(message)
    }
    handleDragEnd()
  }

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    // Use ref as fallback since state may not have updated yet
    const currentDraggedId = draggedProjectId || draggedIdRef.current
    if (currentDraggedId) {
      setIsDraggingToRoot(true)
      setDragOverProjectId(null)
    }
  }

  const handleRootDragLeave = () => {
    setIsDraggingToRoot(false)
  }

  const handleRootDrop = (e: React.DragEvent) => {
    handleDrop(e, null)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      parent_project_id: null,
    })
  }

  const openCreateModal = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const openCreateWithParent = (parentProject: Project) => {
    const parentId = parentProject._id || parentProject.id
    setFormData({
      name: '',
      description: '',
      parent_project_id: parentId,
    })
    setShowCreateModal(true)
  }

  const openEditModal = (project: Project) => {
    setSelectedProject(project)
    setFormData({
      name: project.name,
      description: project.description || '',
      parent_project_id: project.parent_project_id || null,
      status: project.status,
    })
    setShowEditModal(true)
  }

  const openDeleteConfirm = (project: Project) => {
    setSelectedProject(project)
    setShowDeleteConfirm(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setSaving(true)
    setError(null)
    try {
      await api.createProject({
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        parent_project_id: formData.parent_project_id || undefined,
      })
      await loadData()
      setShowCreateModal(false)
      resetForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project'
      setError(message)
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProject) return

    const projectId = selectedProject._id || selectedProject.id
    setSaving(true)
    setError(null)
    try {
      await api.updateProject(projectId, {
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        status: formData.status,
        parent_project_id: formData.parent_project_id || undefined,
      })
      await loadData()
      setShowEditModal(false)
      setSelectedProject(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update project'
      setError(message)
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedProject) return

    const projectId = selectedProject._id || selectedProject.id
    setSaving(true)
    setError(null)
    try {
      await api.deleteProject(projectId)
      await loadData()
      setShowDeleteConfirm(false)
      setSelectedProject(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete project'
      setError(message)
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start justify-between">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--theme-text-heading)]">Projects</h2>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 transition-colors"
        >
          New Project
        </button>
      </div>

      {/* Status Filter and View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Filter by status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <button
          onClick={toggleViewMode}
          className="flex items-center space-x-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          title={viewMode === 'tree' ? 'Switch to compact view' : 'Switch to tree view'}
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {viewMode === 'tree' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h7v7H3V4zm11 0h7v7h-7V4zm-11 11h7v7H3v-7zm11 0h7v7h-7v-7z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            )}
          </svg>
          <span className="text-gray-600">{viewMode === 'tree' ? 'Tree View' : 'Compact View'}</span>
        </button>
      </div>

      {/* Drop zone for making projects top-level */}
      {draggedProjectId && (
        <div
          className={`border-2 border-dashed rounded-lg p-3 text-center text-sm transition-colors ${
            isDraggingToRoot
              ? 'border-blue-400 bg-blue-50 text-blue-700'
              : 'border-gray-300 text-gray-500'
          }`}
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
        >
          Drop here to make a top-level project
        </div>
      )}

      {/* Projects Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {viewMode === 'tree' ? (
                // Tree view - show all nodes in hierarchical order
                flatNodes.map((node) => {
                  const project = node.project
                  const projectId = project._id || project.id
                  const isDraggedOver = dragOverProjectId === projectId
                  const isDragging = draggedProjectId === projectId

                  return (
                    <tr
                      key={projectId}
                      className={`group hover:bg-gray-50 relative ${
                        isDraggedOver && dropZone === 'inside' ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : ''
                      } ${isDragging ? 'opacity-50' : ''}`}
                      onDragOver={(e) => handleDragOver(e, projectId)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, projectId, dropZone)}
                    >
                      {/* Edge drop indicator line */}
                      {isDraggedOver && dropZone === 'before' && (
                        <div className="absolute left-0 right-0 top-0 h-0.5 bg-blue-500 z-10" />
                      )}
                      {isDraggedOver && dropZone === 'after' && (
                        <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-blue-500 z-10" />
                      )}
                      {/* Entire cell is draggable (not just the grip icon) for easier drag initiation.
                          The grip icon is just a visual indicator. See comment block above for details. */}
                      <td
                        className="px-4 py-3 cursor-grab active:cursor-grabbing"
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, projectId)}
                        onDragEnd={handleDragEnd}
                      >
                        <div style={{ paddingLeft: node.depth * 24 }} className="flex items-center">
                          {/* Expand/Collapse toggle */}
                          {node.children.length > 0 ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleCollapse(projectId)
                              }}
                              className="mr-1 p-0.5 rounded hover:bg-gray-200 transition-transform"
                              draggable={false}
                            >
                              <ChevronRight
                                className={`w-4 h-4 text-gray-500 transition-transform ${
                                  !collapsedProjects.has(projectId) ? 'rotate-90' : ''
                                }`}
                              />
                            </button>
                          ) : (
                            <span className="w-5 mr-1" /> // Spacer for alignment
                          )}
                          <div
                            className="mr-2 p-1 text-gray-400 select-none"
                            title="Drag to reparent this project"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="9" cy="6" r="1.5" />
                              <circle cx="15" cy="6" r="1.5" />
                              <circle cx="9" cy="12" r="1.5" />
                              <circle cx="15" cy="12" r="1.5" />
                              <circle cx="9" cy="18" r="1.5" />
                              <circle cx="15" cy="18" r="1.5" />
                            </svg>
                          </div>
                          {/* Project Avatar */}
                          {project.avatar_url ? (
                            <img
                              src={project.avatar_url}
                              alt={project.name}
                              className="w-6 h-6 rounded object-cover mr-2"
                              draggable={false}
                            />
                          ) : (
                            <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-2 flex-shrink-0">
                              <span className="text-xs font-bold text-white">
                                {project.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to={`/projects/${projectId}`}
                              className="font-medium text-blue-600 hover:text-blue-800"
                              title={project.description || undefined}
                              draggable={false}
                            >
                              {project.name}
                            </Link>
                            {/* Task count badge */}
                            {node.taskCount > 0 && (
                              <Link
                                to={`/tasks?project_id=${projectId}`}
                                className="px-1.5 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                                title={`${node.taskCount} task${node.taskCount !== 1 ? 's' : ''}`}
                                draggable={false}
                              >
                                {node.taskCount}
                              </Link>
                            )}
                            {/* Subproject count badge when collapsed */}
                            {collapsedProjects.has(projectId) && node.children.length > 0 && (
                              <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                                {getDescendantCount(node)} sub
                              </span>
                            )}
                            {/* Hover action icons - appear inline with project name */}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); openCreateWithParent(project); }}
                                className="text-green-600 hover:text-green-800 hover:bg-green-50 p-0.5 rounded transition-colors"
                                title="Add Subproject"
                                draggable={false}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); openEditModal(project); }}
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-0.5 rounded transition-colors"
                                title="Edit"
                                draggable={false}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); openDeleteConfirm(project); }}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50 p-0.5 rounded transition-colors"
                                title="Delete"
                                draggable={false}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openCreateWithParent(project)}
                            className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition-colors"
                            title="Add Subproject"
                            draggable={false}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => openEditModal(project)}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(project)}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                // Compact view - show parent projects with childless subprojects as inline tags
                getCompactViewNodes(treeNodes).map((node) => {
                  const project = node.project
                  const projectId = project._id || project.id
                  const isDraggedOver = dragOverProjectId === projectId
                  const isDragging = draggedProjectId === projectId
                  const leafChildren = getDirectLeafChildren(node)

                  return (
                    <tr
                      key={projectId}
                      className={`group hover:bg-gray-50 relative ${
                        isDraggedOver && dropZone === 'inside' ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : ''
                      } ${isDragging ? 'opacity-50' : ''}`}
                      onDragOver={(e) => handleDragOver(e, projectId)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, projectId, dropZone)}
                    >
                      {/* Edge drop indicator line */}
                      {isDraggedOver && dropZone === 'before' && (
                        <div className="absolute left-0 right-0 top-0 h-0.5 bg-blue-500 z-10" />
                      )}
                      {isDraggedOver && dropZone === 'after' && (
                        <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-blue-500 z-10" />
                      )}
                      {/* Entire cell is draggable - see tree view comment above */}
                      <td
                        className="px-4 py-3 cursor-grab active:cursor-grabbing"
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, projectId)}
                        onDragEnd={handleDragEnd}
                      >
                        <div style={{ paddingLeft: node.depth * 24 }} className="flex items-start">
                          <div
                            className="mr-2 mt-0.5 p-1 text-gray-400 select-none flex-shrink-0"
                            title="Drag to reparent this project"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="9" cy="6" r="1.5" />
                              <circle cx="15" cy="6" r="1.5" />
                              <circle cx="9" cy="12" r="1.5" />
                              <circle cx="15" cy="12" r="1.5" />
                              <circle cx="9" cy="18" r="1.5" />
                              <circle cx="15" cy="18" r="1.5" />
                            </svg>
                          </div>
                          {/* Project Avatar */}
                          {project.avatar_url ? (
                            <img
                              src={project.avatar_url}
                              alt={project.name}
                              className="w-6 h-6 rounded object-cover mr-2 mt-0.5 flex-shrink-0"
                              draggable={false}
                            />
                          ) : (
                            <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                              <span className="text-xs font-bold text-white">
                                {project.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                to={`/projects/${projectId}`}
                                className="font-medium text-blue-600 hover:text-blue-800"
                                title={project.description || undefined}
                                draggable={false}
                              >
                                {project.name}
                              </Link>
                              {/* Task count badge */}
                              {node.taskCount > 0 && (
                                <Link
                                  to={`/tasks?project_id=${projectId}`}
                                  className="px-1.5 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                                  title={`${node.taskCount} task${node.taskCount !== 1 ? 's' : ''}`}
                                  draggable={false}
                                >
                                  {node.taskCount}
                                </Link>
                              )}
                              {/* Hover action icons - appear inline with project name */}
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openCreateWithParent(project); }}
                                  className="text-green-600 hover:text-green-800 hover:bg-green-50 p-0.5 rounded transition-colors"
                                  title="Add Subproject"
                                  draggable={false}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEditModal(project); }}
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-0.5 rounded transition-colors"
                                  title="Edit"
                                  draggable={false}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openDeleteConfirm(project); }}
                                  className="text-red-600 hover:text-red-800 hover:bg-red-50 p-0.5 rounded transition-colors"
                                  title="Delete"
                                  draggable={false}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            {/* Inline leaf subprojects as tags */}
                            {leafChildren.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {leafChildren.map((leaf) => {
                                  const leafId = leaf.project._id || leaf.project.id
                                  return (
                                    <span
                                      key={leafId}
                                      className="group/tag inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                                    >
                                      <Link
                                        to={`/projects/${leafId}`}
                                        title={leaf.project.description || undefined}
                                        draggable={false}
                                        className="hover:text-gray-900"
                                      >
                                        {leaf.project.name}
                                      </Link>
                                      {leaf.taskCount > 0 && (
                                        <Link
                                          to={`/tasks?project_id=${leafId}`}
                                          className="px-1 py-px text-[10px] bg-indigo-200 text-indigo-700 rounded hover:bg-indigo-300"
                                          title={`${leaf.taskCount} task${leaf.taskCount !== 1 ? 's' : ''}`}
                                          draggable={false}
                                        >
                                          {leaf.taskCount}
                                        </Link>
                                      )}
                                      <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openCreateWithParent(leaf.project); }}
                                        className="opacity-0 group-hover/tag:opacity-100 text-green-600 hover:text-green-800 transition-opacity"
                                        title="Add Subproject"
                                        draggable={false}
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                      </button>
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openCreateWithParent(project)}
                            className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition-colors"
                            title="Add Subproject"
                            draggable={false}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => openEditModal(project)}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(project)}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
              {((viewMode === 'tree' && flatNodes.length === 0) || (viewMode === 'compact' && treeNodes.length === 0)) && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-gray-500">
                    No projects found. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Project Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={confirmClose(() => setShowCreateModal(false))}
        title="Create New Project"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g., Website Redesign"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
              placeholder="Describe the project..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Project</label>
            <ProjectTypeahead
              projects={projects.map(p => ({ id: p._id || p.id, name: p.name, parent_project_id: p.parent_project_id }))}
              selectedProjectId={formData.parent_project_id ?? null}
              onChange={(projectId) => setFormData({ ...formData, parent_project_id: projectId })}
              placeholder="Search parent projects..."
            />
          </div>
          <ModalFooter>
            <button
              type="button"
              onClick={confirmClose(() => setShowCreateModal(false))}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={showEditModal && !!selectedProject}
        onClose={confirmClose(() => setShowEditModal(false))}
        title="Edit Project"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={formData.status || 'active'}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as ProjectStatus })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Project</label>
            <ProjectTypeahead
              projects={projects.map(p => ({ id: p._id || p.id, name: p.name, parent_project_id: p.parent_project_id }))}
              selectedProjectId={formData.parent_project_id ?? null}
              onChange={(projectId) => setFormData({ ...formData, parent_project_id: projectId })}
              excludeIds={selectedProject ? [selectedProject._id || selectedProject.id] : []}
              placeholder="Search parent projects..."
            />
          </div>
          <ModalFooter>
            <button
              type="button"
              onClick={confirmClose(() => setShowEditModal(false))}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm && !!selectedProject}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Project?"
        size="sm"
      >
        <p className="text-gray-500 mb-4">
          Are you sure you want to delete "{selectedProject?.name}"? This action cannot be undone.
        </p>
        <ModalFooter>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={saving}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Deleting...' : 'Delete'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
