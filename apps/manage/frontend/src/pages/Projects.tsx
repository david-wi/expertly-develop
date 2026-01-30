import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Modal, ModalFooter } from '@expertly/ui'
import { api, Project, ProjectStatus, CreateProjectRequest } from '../services/api'

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

// Get the display path for a project (shows hierarchy)
function getProjectPath(projectId: string, projects: Project[]): string {
  const projectMap = new Map<string, Project>()
  for (const p of projects) {
    const pId = p._id || p.id
    projectMap.set(pId, p)
  }

  const path: string[] = []
  let currentId: string | null | undefined = projectId
  while (currentId) {
    const currentProject: Project | undefined = projectMap.get(currentId)
    if (!currentProject) break
    path.unshift(currentProject.name)
    currentId = currentProject.parent_project_id
  }
  return path.join(' → ')
}

// Build tree structure from flat list
function buildTree(projects: Project[], taskCounts: Map<string, number>): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  // Create nodes for all projects
  for (const project of projects) {
    const id = project._id || project.id
    map.set(id, {
      project,
      children: [],
      depth: 0,
      taskCount: taskCounts.get(id) || 0,
    })
  }

  // Build tree structure
  for (const project of projects) {
    const id = project._id || project.id
    const node = map.get(id)!
    if (project.parent_project_id && map.has(project.parent_project_id)) {
      const parent = map.get(project.parent_project_id)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

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
function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = []
  const flatten = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      result.push(node)
      flatten(node.children)
    }
  }
  flatten(nodes)
  return result
}

// Status badge colors
function getStatusBadgeColor(status: ProjectStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800'
    case 'on_hold':
      return 'bg-yellow-100 text-yellow-800'
    case 'completed':
      return 'bg-blue-100 text-blue-800'
    case 'cancelled':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

// Format status for display
function formatStatus(status: ProjectStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'on_hold':
      return 'On Hold'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
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

  // Form state
  const [formData, setFormData] = useState<CreateProjectRequest & { status?: ProjectStatus }>({
    name: '',
    description: '',
    parent_project_id: null,
  })

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
  const flatNodes = flattenTree(treeNodes)

  // Get available parent projects (exclude current project and its descendants to prevent circular refs)
  const getAvailableParents = useCallback(
    (excludeId?: string): { project: Project; path: string; depth: number }[] => {
      // Get descendants of the excluded project to prevent circular references
      const excludedIds = new Set<string>()
      if (excludeId) {
        excludedIds.add(excludeId)
        const descendants = getDescendantIds(excludeId, projects)
        descendants.forEach((id) => excludedIds.add(id))
      }

      // Build depth map
      const depthMap = new Map<string, number>()
      const getDepth = (projectId: string): number => {
        if (depthMap.has(projectId)) return depthMap.get(projectId)!
        const project = projects.find((p) => (p._id || p.id) === projectId)
        if (!project || !project.parent_project_id) {
          depthMap.set(projectId, 0)
          return 0
        }
        const parentDepth = getDepth(project.parent_project_id)
        const depth = parentDepth + 1
        depthMap.set(projectId, depth)
        return depth
      }

      return projects
        .filter((p) => {
          const id = p._id || p.id
          return !excludedIds.has(id)
        })
        .map((p) => ({
          project: p,
          path: getProjectPath(p._id || p.id, projects),
          depth: getDepth(p._id || p.id),
        }))
        .sort((a, b) => a.path.localeCompare(b.path))
    },
    [projects]
  )

  // Drag and drop state
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null)
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null)
  const [isDraggingToRoot, setIsDraggingToRoot] = useState(false)

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', projectId)
    setDraggedProjectId(projectId)
  }

  const handleDragEnd = () => {
    setDraggedProjectId(null)
    setDragOverProjectId(null)
    setIsDraggingToRoot(false)
  }

  const handleDragOver = (e: React.DragEvent, projectId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedProjectId && draggedProjectId !== projectId) {
      // Check if target is not a descendant of dragged project
      const descendants = getDescendantIds(draggedProjectId, projects)
      if (!descendants.has(projectId)) {
        setDragOverProjectId(projectId)
        setIsDraggingToRoot(false)
      }
    }
  }

  const handleDragLeave = () => {
    setDragOverProjectId(null)
  }

  const handleDrop = async (e: React.DragEvent, targetProjectId: string | null) => {
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

    try {
      await api.updateProject(sourceProjectId, {
        parent_project_id: targetProjectId || undefined,
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
    if (draggedProjectId) {
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
        <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 transition-colors"
        >
          New Project
        </button>
      </div>

      {/* Status Filter */}
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
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tasks
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {flatNodes.map((node) => {
                const project = node.project
                const projectId = project._id || project.id
                const isDraggedOver = dragOverProjectId === projectId
                const isDragging = draggedProjectId === projectId

                return (
                  <tr
                    key={projectId}
                    className={`hover:bg-gray-50 cursor-grab active:cursor-grabbing ${isDraggedOver ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : ''} ${isDragging ? 'opacity-50' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, projectId)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, projectId)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, projectId)}
                  >
                    <td className="px-4 py-3">
                      <div style={{ paddingLeft: node.depth * 24 }} className="flex items-center">
                        <div
                          className="mr-2 text-gray-400 select-none"
                          title="Drag to reparent"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="9" cy="6" r="1.5" />
                            <circle cx="15" cy="6" r="1.5" />
                            <circle cx="9" cy="12" r="1.5" />
                            <circle cx="15" cy="12" r="1.5" />
                            <circle cx="9" cy="18" r="1.5" />
                            <circle cx="15" cy="18" r="1.5" />
                          </svg>
                        </div>
                        <div>
                          <Link
                            to={`/projects/${projectId}`}
                            className="font-medium text-blue-600 hover:text-blue-800"
                          >
                            {project.name}
                          </Link>
                          {project.description && (
                            <p className="text-xs text-gray-500 truncate max-w-xs">
                              {project.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeColor(project.status)}`}
                      >
                        {formatStatus(project.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {node.taskCount > 0 ? (
                        <Link
                          to={`/tasks?project_id=${projectId}`}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {node.taskCount} task{node.taskCount !== 1 ? 's' : ''}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">0 tasks</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openCreateWithParent(project)}
                          className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition-colors"
                          title="Add Subproject"
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
              })}
              {flatNodes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
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
        onClose={() => setShowCreateModal(false)}
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
            <select
              value={formData.parent_project_id || ''}
              onChange={(e) =>
                setFormData({ ...formData, parent_project_id: e.target.value || null })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">None (top-level project)</option>
              {getAvailableParents().map(({ project: p, depth }) => (
                <option key={p._id || p.id} value={p._id || p.id}>
                  {'─'.repeat(depth)}{depth > 0 ? ' ' : ''}{p.name}
                </option>
              ))}
            </select>
          </div>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
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
        onClose={() => setShowEditModal(false)}
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
            <select
              value={formData.parent_project_id || ''}
              onChange={(e) =>
                setFormData({ ...formData, parent_project_id: e.target.value || null })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">None (top-level project)</option>
              {getAvailableParents(selectedProject?._id || selectedProject?.id).map(
                ({ project: p, depth }) => (
                  <option key={p._id || p.id} value={p._id || p.id}>
                    {'─'.repeat(depth)}{depth > 0 ? ' ' : ''}{p.name}
                  </option>
                )
              )}
            </select>
          </div>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
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
