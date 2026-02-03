import { useState, useRef, useEffect, useMemo } from 'react'
import { X, Plus } from 'lucide-react'
import { api } from '../services/api'

export interface ProjectOption {
  id: string
  name: string
  parent_project_id?: string | null
}

interface ProjectTypeaheadProps {
  projects: ProjectOption[]
  selectedProjectId: string | null
  onChange: (projectId: string | null) => void
  excludeIds?: string[] // IDs to exclude (e.g., self and descendants)
  placeholder?: string
  className?: string
  disabled?: boolean
  onProjectCreated?: (project: ProjectOption) => void // Called after creating a new project
}

// Get descendants of a project (to prevent circular references)
function getDescendantIds(projectId: string, projects: ProjectOption[]): Set<string> {
  const descendants = new Set<string>()
  const findDescendants = (parentId: string) => {
    for (const project of projects) {
      if (project.parent_project_id === parentId) {
        descendants.add(project.id)
        findDescendants(project.id)
      }
    }
  }
  findDescendants(projectId)
  return descendants
}

// Build depth map for indentation
function buildDepthMap(projects: ProjectOption[]): Map<string, number> {
  const depthMap = new Map<string, number>()

  const getDepth = (projectId: string): number => {
    if (depthMap.has(projectId)) return depthMap.get(projectId)!
    const project = projects.find((p) => p.id === projectId)
    if (!project || !project.parent_project_id) {
      depthMap.set(projectId, 0)
      return 0
    }
    const parentDepth = getDepth(project.parent_project_id)
    const depth = parentDepth + 1
    depthMap.set(projectId, depth)
    return depth
  }

  for (const p of projects) {
    getDepth(p.id)
  }

  return depthMap
}

export default function ProjectTypeahead({
  projects,
  selectedProjectId,
  onChange,
  excludeIds = [],
  placeholder = 'Search projects...',
  className = '',
  disabled = false,
  onProjectCreated,
}: ProjectTypeaheadProps) {
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectParentId, setNewProjectParentId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const newProjectNameRef = useRef<HTMLInputElement>(null)

  // Build exclude set including descendants
  const excludeSet = useMemo(() => {
    const excluded = new Set(excludeIds)
    for (const id of excludeIds) {
      const descendants = getDescendantIds(id, projects)
      descendants.forEach((d) => excluded.add(d))
    }
    return excluded
  }, [excludeIds, projects])

  // Build depth map for hierarchy display
  const depthMap = useMemo(() => buildDepthMap(projects), [projects])

  // Filter and sort projects - alphabetically within each group (siblings at same level)
  const filteredProjects = useMemo(() => {
    const filtered = projects.filter((p) => {
      if (excludeSet.has(p.id)) return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })

    // Build tree and flatten with alphabetical sorting at each level
    const buildSortedTree = (parentId: string | null): ProjectOption[] => {
      const children = filtered
        .filter((p) => (p.parent_project_id || null) === parentId)
        .sort((a, b) => a.name.localeCompare(b.name))

      const result: ProjectOption[] = []
      for (const child of children) {
        result.push(child)
        result.push(...buildSortedTree(child.id))
      }
      return result
    }

    return buildSortedTree(null)
  }, [projects, excludeSet, search])

  // Get selected project
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null
    return projects.find((p) => p.id === selectedProjectId) || null
  }, [projects, selectedProjectId])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (project: ProjectOption | null) => {
    onChange(project?.id || null)
    setSearch('')
    setShowDropdown(false)
    setShowCreateForm(false)
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || isCreating) return

    setIsCreating(true)
    setCreateError(null)
    try {
      const created = await api.createProject({
        name: newProjectName.trim(),
        parent_project_id: newProjectParentId,
      })
      const newProject: ProjectOption = {
        id: created._id || created.id,
        name: created.name,
        parent_project_id: created.parent_project_id,
      }
      // Notify parent to refresh projects list
      onProjectCreated?.(newProject)
      // Select the newly created project
      onChange(newProject.id)
      // Reset form
      setNewProjectName('')
      setNewProjectParentId(null)
      setShowCreateForm(false)
      setShowDropdown(false)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setIsCreating(false)
    }
  }

  const openCreateForm = () => {
    setShowCreateForm(true)
    setNewProjectName('')
    setNewProjectParentId(null)
    setCreateError(null)
    setTimeout(() => newProjectNameRef.current?.focus(), 0)
  }

  if (disabled) {
    return (
      <div className={`px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-elevated text-theme-text-secondary ${className}`}>
        {selectedProject?.name || 'None (top-level)'}
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {selectedProject ? (
        <div className="flex items-center justify-between border border-theme-border rounded-lg px-3 py-2 bg-theme-bg-surface">
          <span className="text-theme-text-primary">{selectedProject.name}</span>
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className="text-theme-text-secondary hover:text-theme-text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary placeholder-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute z-10 w-full mt-1 bg-theme-bg-surface border border-theme-border rounded-lg shadow-lg max-h-60 overflow-auto"
            >
              {showCreateForm ? (
                <div className="p-3 space-y-2">
                  <div className="text-xs font-medium text-theme-text-primary mb-2">Create New Project</div>

                  {/* Project name input */}
                  <div>
                    <input
                      ref={newProjectNameRef}
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newProjectName.trim()) {
                          e.preventDefault()
                          handleCreateProject()
                        } else if (e.key === 'Escape') {
                          setShowCreateForm(false)
                        }
                      }}
                      placeholder="Project name"
                      disabled={isCreating}
                      className="w-full px-2 py-1.5 text-xs border border-theme-border rounded bg-theme-bg-surface text-theme-text-primary placeholder-theme-text-secondary focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>

                  {/* Parent project selector */}
                  <div>
                    <label className="text-[10px] text-theme-text-secondary mb-1 block">Parent project (optional)</label>
                    <select
                      value={newProjectParentId || ''}
                      onChange={(e) => setNewProjectParentId(e.target.value || null)}
                      disabled={isCreating}
                      className="w-full px-2 py-1.5 text-xs border border-theme-border rounded bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">None (top-level)</option>
                      {projects
                        .filter((p) => !excludeSet.has(p.id))
                        .sort((a, b) => {
                          const depthA = depthMap.get(a.id) || 0
                          const depthB = depthMap.get(b.id) || 0
                          if (depthA !== depthB) return depthA - depthB
                          return a.name.localeCompare(b.name)
                        })
                        .map((project) => (
                          <option key={project.id} value={project.id}>
                            {'─'.repeat(depthMap.get(project.id) || 0)} {project.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {createError && (
                    <div className="text-xs text-red-500">{createError}</div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      disabled={isCreating}
                      className="px-2 py-1 text-xs text-theme-text-secondary hover:text-theme-text-primary"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateProject}
                      disabled={!newProjectName.trim() || isCreating}
                      className="px-2 py-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreating ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* None option */}
                  <button
                    type="button"
                    onClick={() => handleSelect(null)}
                    className="w-full text-left px-3 py-2 hover:bg-theme-bg-elevated text-theme-text-primary"
                  >
                    None (top-level)
                  </button>

                  {filteredProjects.length > 0 ? (
                    filteredProjects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => handleSelect(project)}
                        className="w-full text-left px-3 py-2 hover:bg-theme-bg-elevated"
                        style={{ paddingLeft: `${(depthMap.get(project.id) || 0) * 12 + 12}px` }}
                      >
                        <span className="text-theme-text-secondary mr-1">
                          {'─'.repeat(depthMap.get(project.id) || 0)}
                        </span>
                        <span className="text-theme-text-primary">{project.name}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-theme-text-secondary text-sm">
                      No projects found
                    </div>
                  )}

                  {/* Add Project option */}
                  {onProjectCreated && (
                    <button
                      type="button"
                      onClick={openCreateForm}
                      className="w-full text-left px-3 py-2 hover:bg-theme-bg-elevated border-t border-theme-border flex items-center gap-1.5 text-primary-600"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="text-sm">Add project...</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
