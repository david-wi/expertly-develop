import { useState, useRef, useEffect, useMemo } from 'react'
import { X } from 'lucide-react'

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
}: ProjectTypeaheadProps) {
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  // Filter projects
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        if (excludeSet.has(p.id)) return false
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .sort((a, b) => {
        // Sort by hierarchy path
        const aPath = getProjectPath(a.id, projects)
        const bPath = getProjectPath(b.id, projects)
        return aPath.localeCompare(bPath)
      })
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
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Helper to get the full path of a project
function getProjectPath(projectId: string, projects: ProjectOption[]): string {
  const projectMap = new Map<string, ProjectOption>()
  for (const p of projects) {
    projectMap.set(p.id, p)
  }

  const path: string[] = []
  let currentId: string | null | undefined = projectId
  while (currentId) {
    const currentProject = projectMap.get(currentId)
    if (!currentProject) break
    path.unshift(currentProject.name)
    currentId = currentProject.parent_project_id
  }
  return path.join(' → ')
}
