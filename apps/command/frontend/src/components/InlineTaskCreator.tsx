import { useState, useRef } from 'react'
import { Project, api } from '../services/api'

// Build a display name with parent hierarchy
function getProjectDisplayName(project: Project, allProjects: Project[]): string {
  if (!project.parent_project_id) return project.name
  const parent = allProjects.find((p) => (p._id || p.id) === project.parent_project_id)
  if (parent) {
    return `${getProjectDisplayName(parent, allProjects)} > ${project.name}`
  }
  return project.name
}

interface InlineTaskCreatorProps {
  defaultQueueId: string
  projectId?: string // Pre-set (hides project selector)
  projects?: Project[] // For project selector when no projectId
  onTaskCreated: () => void
  placeholder?: string
  position?: 'top' | 'bottom' // Where to insert the task
  existingTasks?: { sequence?: number }[] // For calculating sequence
}

export function InlineTaskCreator({
  defaultQueueId,
  projectId,
  projects = [],
  onTaskCreated,
  placeholder = 'Add task...',
  position = 'bottom',
  existingTasks = [],
}: InlineTaskCreatorProps) {
  const [title, setTitle] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '')
  const [projectQuery, setProjectQuery] = useState('')
  const [instructions, setInstructions] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)
  const projectRef = useRef<HTMLInputElement>(null)
  const instructionsRef = useRef<HTMLTextAreaElement>(null)

  const handleCreateTask = async () => {
    if (!title.trim() || !defaultQueueId || isCreating) return

    setIsCreating(true)
    try {
      // Calculate sequence based on position
      let sequence: number | undefined
      if (position === 'top' && existingTasks.length > 0) {
        const firstTask = existingTasks[0]
        sequence = firstTask?.sequence ? firstTask.sequence - 1 : 0
      }

      const taskData: {
        queue_id: string
        title: string
        description?: string
        project_id?: string
      } = {
        queue_id: defaultQueueId,
        title: title.trim(),
        description: instructions.trim() || undefined,
        project_id: projectId || selectedProjectId || undefined,
      }

      const createdTask = await api.createTask(taskData)

      // If position is top and we need to reorder
      if (position === 'top' && sequence !== undefined) {
        const taskId = createdTask._id || createdTask.id
        await api.reorderTasks([{ id: taskId, sequence }])
      }

      // Reset form
      setTitle('')
      setSelectedProjectId(projectId || '')
      setProjectQuery('')
      setInstructions('')
      onTaskCreated()
      setTimeout(() => titleRef.current?.focus(), 0)
    } catch (err) {
      console.error('Failed to create task:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (title.trim()) {
        handleCreateTask()
      }
    } else if (e.key === 'Tab' && !e.shiftKey && title.trim()) {
      e.preventDefault()
      if (!projectId && projects.length > 0) {
        projectRef.current?.focus()
        setShowProjectDropdown(true)
      } else {
        instructionsRef.current?.focus()
      }
    }
  }

  const handleProjectKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // If dropdown is showing and there's a matching project, select it
      const filteredProjects = projects.filter((p) =>
        getProjectDisplayName(p, projects).toLowerCase().includes(projectQuery.toLowerCase())
      )
      if (filteredProjects.length === 1) {
        setSelectedProjectId(filteredProjects[0]._id || filteredProjects[0].id)
        setProjectQuery(getProjectDisplayName(filteredProjects[0], projects))
      }
      setShowProjectDropdown(false)
      if (title.trim()) {
        handleCreateTask()
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      setShowProjectDropdown(false)
      instructionsRef.current?.focus()
    } else if (e.key === 'Escape') {
      setShowProjectDropdown(false)
    }
  }

  const handleInstructionsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (title.trim()) {
        handleCreateTask()
      }
    }
  }

  const showProjectSelector = !projectId && projects.length > 0

  return (
    <div
      className={`flex items-start gap-2 px-2 py-1.5 border-b border-gray-100 ${
        position === 'top' ? 'bg-blue-50/30' : 'bg-gray-50/30'
      }`}
    >
      <div
        className={`flex-shrink-0 pt-0.5 ${position === 'top' ? 'text-blue-400' : 'text-gray-400'}`}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <input
            ref={titleRef}
            type="text"
            placeholder={placeholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            disabled={isCreating}
            className="flex-1 text-xs font-medium text-gray-900 placeholder-gray-400 bg-transparent border-none outline-none focus:ring-0 p-0"
          />
          {title && showProjectSelector && (
            <div className="relative w-28 flex-shrink-0">
              <input
                ref={projectRef}
                type="text"
                placeholder="Project..."
                value={projectQuery}
                onChange={(e) => {
                  setProjectQuery(e.target.value)
                  setShowProjectDropdown(true)
                  // Clear selection if typing
                  if (selectedProjectId) {
                    const selectedProject = projects.find(
                      (p) => (p._id || p.id) === selectedProjectId
                    )
                    if (
                      selectedProject &&
                      getProjectDisplayName(selectedProject, projects) !== e.target.value
                    ) {
                      setSelectedProjectId('')
                    }
                  }
                }}
                onFocus={() => setShowProjectDropdown(true)}
                onBlur={() => setTimeout(() => setShowProjectDropdown(false), 200)}
                onKeyDown={handleProjectKeyDown}
                disabled={isCreating}
                className="w-full text-xs text-gray-600 placeholder-gray-400 bg-white border border-gray-200 rounded px-2 py-0.5 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200"
              />
              {showProjectDropdown && projectQuery && (
                <div
                  className={`absolute z-10 right-0 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-auto min-w-max ${
                    position === 'bottom' ? 'bottom-full mb-1' : 'top-full mt-1'
                  }`}
                >
                  {projects
                    .filter((p) =>
                      getProjectDisplayName(p, projects)
                        .toLowerCase()
                        .includes(projectQuery.toLowerCase())
                    )
                    .slice(0, 5)
                    .map((project) => (
                      <div
                        key={project._id || project.id}
                        className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 cursor-pointer truncate"
                        onMouseDown={() => {
                          setSelectedProjectId(project._id || project.id)
                          setProjectQuery(getProjectDisplayName(project, projects))
                          setShowProjectDropdown(false)
                        }}
                      >
                        {getProjectDisplayName(project, projects)}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
        {title && (
          <textarea
            ref={instructionsRef}
            placeholder="Instructions (Tab to focus, Enter to save)"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            onKeyDown={handleInstructionsKeyDown}
            disabled={isCreating}
            rows={2}
            className="w-full mt-1 text-xs text-gray-600 placeholder-gray-400 bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200 resize-none"
          />
        )}
      </div>
    </div>
  )
}
