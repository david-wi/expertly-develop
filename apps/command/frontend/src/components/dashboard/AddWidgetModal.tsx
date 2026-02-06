import { useEffect, useState, useMemo } from 'react'
import { X, ArrowLeft, Plus } from 'lucide-react'
import { widgetList } from './widgets/registry'
import { useDashboardStore } from '../../stores/dashboardStore'
import { useAppStore } from '../../stores/appStore'
import { WidgetDefinition, WidgetConfig } from './widgets/types'
import { api, Project, DashboardNote } from '../../services/api'

interface Playbook {
  _id?: string
  id: string
  name: string
}

interface AddWidgetModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AddWidgetModal({ isOpen, onClose }: AddWidgetModalProps) {
  const { widgets, addWidget } = useDashboardStore()
  const { queues } = useAppStore()
  const [step, setStep] = useState<'select' | 'configure'>('select')
  const [selectedWidget, setSelectedWidget] = useState<WidgetDefinition | null>(null)
  const [config, setConfig] = useState<WidgetConfig>({})

  // For active-tasks configuration
  const [filterType, setFilterType] = useState<'project' | 'playbook'>('project')
  const [projects, setProjects] = useState<Project[]>([])
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>('')

  // For project-next-steps configuration
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')

  // For notes configuration
  const [dashboardNotes, setDashboardNotes] = useState<DashboardNote[]>([])
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([])
  const [creatingNewNote, setCreatingNewNote] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep('select')
      setSelectedWidget(null)
      setConfig({})
      setFilterType('project')
      setSelectedProjectIds([])
      setSelectedPlaybookId('')
      setSelectedProjectId('')
      setSelectedNoteIds([])
      setCreatingNewNote(false)
      setNewNoteTitle('')
    }
  }, [isOpen])

  // Fetch projects and playbooks when needed for active-tasks config
  useEffect(() => {
    if (isOpen && selectedWidget?.requiresConfig === 'active-tasks') {
      api.getProjects({ status: 'active' }).then(setProjects).catch(console.error)
      api.getPlaybooks({ active_only: true }).then(setPlaybooks).catch(console.error)
    }
  }, [isOpen, selectedWidget])

  // Fetch projects for project-next-steps config
  useEffect(() => {
    if (isOpen && selectedWidget?.requiresConfig === 'project') {
      api.getProjects({ status: 'active' }).then(setProjects).catch(console.error)
    }
  }, [isOpen, selectedWidget])

  // Fetch dashboard notes for notes config
  useEffect(() => {
    if (isOpen && selectedWidget?.requiresConfig === 'notes') {
      api.getDashboardNotes().then(setDashboardNotes).catch(console.error)
    }
  }, [isOpen, selectedWidget])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const activeWidgetTypes = new Set(widgets.map(w => w.type))

  const handleSelectWidget = (widget: WidgetDefinition) => {
    if (widget.requiresConfig) {
      setSelectedWidget(widget)
      setStep('configure')
    } else {
      addWidget(widget.id)
      onClose()
    }
  }

  const handleAddConfiguredWidget = () => {
    if (selectedWidget) {
      addWidget(selectedWidget.id, config)
      onClose()
    }
  }

  const handleBack = () => {
    setStep('select')
    setSelectedWidget(null)
    setConfig({})
    setFilterType('project')
    setSelectedProjectIds([])
    setSelectedPlaybookId('')
    setSelectedProjectId('')
    setSelectedNoteIds([])
    setCreatingNewNote(false)
    setNewNoteTitle('')
  }

  const isWidgetDisabled = (widget: WidgetDefinition): boolean => {
    if (widget.allowMultiple) return false
    return activeWidgetTypes.has(widget.id)
  }

  const renderSelectStep = () => (
    <div className="p-6">
      <div className="grid grid-cols-2 gap-4">
        {widgetList.map((widget) => {
          const isActive = isWidgetDisabled(widget)
          const Icon = widget.icon
          return (
            <div
              key={widget.id}
              className={`p-4 border rounded-lg ${
                isActive
                  ? 'border-gray-200 bg-gray-50 opacity-60'
                  : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50 cursor-pointer'
              }`}
              onClick={() => !isActive && handleSelectWidget(widget)}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${isActive ? 'bg-gray-200' : 'bg-primary-100'}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-gray-500' : 'text-primary-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${isActive ? 'text-gray-500' : 'text-gray-900'}`}>
                    {widget.name}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{widget.description}</p>
                  {isActive && (
                    <span className="inline-block mt-2 text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                      Already added
                    </span>
                  )}
                  {widget.allowMultiple && !isActive && (
                    <span className="inline-block mt-2 text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                      Can add multiple
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  // Helper to build display name for projects
  const getProjectDisplayName = (project: Project): string => {
    if (!project.parent_project_id) return project.name
    const parent = projects.find(p => (p._id || p.id) === project.parent_project_id)
    if (parent) {
      return `${getProjectDisplayName(parent)} > ${project.name}`
    }
    return project.name
  }

  // Build depth map for project indentation
  const getProjectDepth = (projectId: string, visited = new Set<string>()): number => {
    if (visited.has(projectId)) return 0 // Prevent cycles
    visited.add(projectId)
    const project = projects.find(p => (p._id || p.id) === projectId)
    if (!project || !project.parent_project_id) return 0
    return 1 + getProjectDepth(project.parent_project_id, visited)
  }

  // Build hierarchically sorted projects (parent -> children, alphabetical at each level)
  const sortedProjects = useMemo(() => {
    const buildTree = (parentId: string | null): Project[] => {
      const children = projects
        .filter(p => (p.parent_project_id || null) === parentId)
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))

      const result: Project[] = []
      for (const child of children) {
        result.push(child)
        result.push(...buildTree(child._id || child.id))
      }
      return result
    }
    return buildTree(null)
  }, [projects])

  // Get user-friendly configure step title based on widget type
  const getConfigureTitle = (): string => {
    if (!selectedWidget) return 'Configure Widget'
    switch (selectedWidget.requiresConfig) {
      case 'active-tasks':
        return 'Which Tasks to Show?'
      case 'project':
        return 'Select a Project'
      case 'queue':
        return 'Select a Queue'
      case 'notes':
        return 'Select Notes'
      default:
        return `Configure ${selectedWidget.name}`
    }
  }

  // Get preview title for active-tasks widget
  const getActiveTasksPreviewTitle = (): string => {
    if (filterType === 'playbook' && selectedPlaybookId) {
      const playbook = playbooks.find(p => (p._id || p.id) === selectedPlaybookId)
      return playbook ? `${playbook.name} Tasks` : 'Playbook Tasks'
    }
    if (filterType === 'project' && selectedProjectIds.length > 0) {
      if (selectedProjectIds.length === 1) {
        const project = projects.find(p => (p._id || p.id) === selectedProjectIds[0])
        return project ? `${project.name} Tasks` : 'Project Tasks'
      }
      return `${selectedProjectIds.length} Projects Tasks`
    }
    return 'Active Tasks'
  }

  // Handle adding active-tasks widget with config
  const handleAddActiveTasksWidget = () => {
    const widgetConfig: WidgetConfig = {}
    if (filterType === 'project' && selectedProjectIds.length > 0) {
      widgetConfig.projectIds = selectedProjectIds
    } else if (filterType === 'playbook' && selectedPlaybookId) {
      widgetConfig.playbookId = selectedPlaybookId
    }
    if (selectedWidget) {
      addWidget(selectedWidget.id, widgetConfig)
      onClose()
    }
  }

  // Check if active-tasks config is valid
  const isActiveTasksConfigValid = (): boolean => {
    if (filterType === 'project') {
      return selectedProjectIds.length > 0
    }
    return !!selectedPlaybookId
  }

  // Toggle project selection
  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    )
  }

  // Handle adding project-next-steps widget
  const handleAddProjectNextStepsWidget = () => {
    if (selectedWidget && selectedProjectId) {
      const project = projects.find(p => (p._id || p.id) === selectedProjectId)
      addWidget(selectedWidget.id, {
        projectId: selectedProjectId,
        widgetTitle: project ? `${project.name} - Next Steps` : 'Project Next Steps'
      })
      onClose()
    }
  }

  // Toggle note selection for notes widget
  const toggleNoteSelection = (noteId: string) => {
    setSelectedNoteIds(prev =>
      prev.includes(noteId)
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    )
  }

  // Create new note
  const handleCreateNewNote = async () => {
    if (!newNoteTitle.trim()) return

    try {
      setSavingNote(true)
      const newNote = await api.createDashboardNote({
        title: newNoteTitle.trim(),
        content: ''
      })
      setDashboardNotes(prev => [newNote, ...prev])
      setSelectedNoteIds(prev => [...prev, newNote.id])
      setCreatingNewNote(false)
      setNewNoteTitle('')
    } catch (err) {
      console.error('Failed to create note:', err)
    } finally {
      setSavingNote(false)
    }
  }

  // Handle adding notes widget
  const handleAddNotesWidget = () => {
    if (selectedWidget && selectedNoteIds.length > 0) {
      addWidget(selectedWidget.id, {
        noteIds: selectedNoteIds,
        widgetTitle: 'Notes'
      })
      onClose()
    }
  }

  const renderConfigureStep = () => {
    if (!selectedWidget) return null

    return (
      <div className="p-6">
        {selectedWidget.requiresConfig === 'queue' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select a Queue
              </label>
              <select
                value={config.queueId || ''}
                onChange={(e) => setConfig({ ...config, queueId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Choose a queue...</option>
                {queues.map((queue) => (
                  <option key={queue._id || queue.id} value={queue._id || queue.id}>
                    {queue.purpose}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleAddConfiguredWidget}
                disabled={!config.queueId}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Widget
              </button>
            </div>
          </div>
        )}

        {selectedWidget.requiresConfig === 'active-tasks' && (
          <div className="space-y-4">
            {/* Filter type selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter By
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="filterType"
                    value="project"
                    checked={filterType === 'project'}
                    onChange={() => {
                      setFilterType('project')
                      setSelectedPlaybookId('')
                    }}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">By Project</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="filterType"
                    value="playbook"
                    checked={filterType === 'playbook'}
                    onChange={() => {
                      setFilterType('playbook')
                      setSelectedProjectIds([])
                    }}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">By Playbook</span>
                </label>
              </div>
            </div>

            {/* Project multi-select */}
            {filterType === 'project' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Project(s)
                </label>
                <div className="max-h-48 overflow-auto border border-gray-300 rounded-md">
                  {sortedProjects.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">No active projects</div>
                  ) : (
                    sortedProjects.map((project) => {
                      const projectId = project._id || project.id
                      const isSelected = selectedProjectIds.includes(projectId)
                      const depth = getProjectDepth(projectId)
                      return (
                        <div
                          key={projectId}
                          onClick={() => toggleProjectSelection(projectId)}
                          className={`flex items-center gap-2 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                            isSelected ? 'bg-primary-50' : ''
                          }`}
                          style={{ paddingLeft: `${depth * 16 + 12}px`, paddingRight: '12px' }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="text-primary-600 focus:ring-primary-500 rounded flex-shrink-0"
                          />
                          {depth > 0 && (
                            <span className="text-gray-400 text-sm flex-shrink-0">
                              {'─'.repeat(depth)}
                            </span>
                          )}
                          <span className="text-sm text-gray-700 truncate">
                            {project.name}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
                {selectedProjectIds.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedProjectIds.length} project{selectedProjectIds.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}

            {/* Playbook single-select */}
            {filterType === 'playbook' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Playbook
                </label>
                <select
                  value={selectedPlaybookId}
                  onChange={(e) => setSelectedPlaybookId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Choose a playbook...</option>
                  {playbooks.map((playbook) => (
                    <option key={playbook._id || playbook.id} value={playbook._id || playbook.id}>
                      {playbook.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Widget title preview */}
            <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Widget Title Preview</p>
              <p className="text-sm font-medium text-gray-900">{getActiveTasksPreviewTitle()}</p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleAddActiveTasksWidget}
                disabled={!isActiveTasksConfigValid()}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Widget
              </button>
            </div>
          </div>
        )}

        {selectedWidget.requiresConfig === 'project' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select a Project
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Choose a project...</option>
                {projects.map((project) => (
                  <option key={project._id || project.id} value={project._id || project.id}>
                    {getProjectDisplayName(project)}
                  </option>
                ))}
              </select>
            </div>

            {selectedProjectId && (
              <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Widget Title Preview</p>
                <p className="text-sm font-medium text-gray-900">
                  {projects.find(p => (p._id || p.id) === selectedProjectId)?.name || 'Project'} - Next Steps
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleAddProjectNextStepsWidget}
                disabled={!selectedProjectId}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Widget
              </button>
            </div>
          </div>
        )}

        {selectedWidget.requiresConfig === 'notes' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Notes to Display
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Select one or more notes to show as tabs in the widget. You can add more tabs later.
              </p>

              {/* Create new note option */}
              {!creatingNewNote ? (
                <button
                  onClick={() => setCreatingNewNote(true)}
                  className="w-full mb-2 px-3 py-2 text-sm text-primary-600 border border-dashed border-primary-300 rounded-md hover:bg-primary-50 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create a new note
                </button>
              ) : (
                <div className="mb-2 p-3 border border-primary-200 bg-primary-50 rounded-md">
                  <input
                    type="text"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    placeholder="Note title..."
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateNewNote()
                      if (e.key === 'Escape') setCreatingNewNote(false)
                    }}
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => {
                        setCreatingNewNote(false)
                        setNewNoteTitle('')
                      }}
                      className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateNewNote}
                      disabled={!newNoteTitle.trim() || savingNote}
                      className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                    >
                      {savingNote ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              )}

              {/* Existing notes list */}
              <div className="max-h-48 overflow-auto border border-gray-300 rounded-md">
                {dashboardNotes.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">No notes yet. Create one above!</div>
                ) : (
                  dashboardNotes.map((note) => {
                    const noteId = note._id || note.id
                    const isSelected = selectedNoteIds.includes(noteId)
                    return (
                      <div
                        key={noteId}
                        onClick={() => toggleNoteSelection(noteId)}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                          isSelected ? 'bg-primary-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="text-primary-600 focus:ring-primary-500 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-700 truncate block">{note.title}</span>
                          {note.description && (
                            <span className="text-xs text-gray-500 truncate block">{note.description}</span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              {selectedNoteIds.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  {selectedNoteIds.length} note{selectedNoteIds.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleAddNotesWidget}
                disabled={selectedNoteIds.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Widget
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-30" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              {step === 'configure' && (
                <button
                  onClick={handleBack}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h3 className="text-lg font-semibold text-gray-900">
                {step === 'select' ? 'Add Widget' : getConfigureTitle()}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {step === 'select' ? renderSelectStep() : renderConfigureStep()}
        </div>
      </div>
    </div>
  )
}
