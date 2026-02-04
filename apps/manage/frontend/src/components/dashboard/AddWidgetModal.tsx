import { useEffect, useState } from 'react'
import { X, ArrowLeft } from 'lucide-react'
import { widgetList } from './widgets/registry'
import { useDashboardStore } from '../../stores/dashboardStore'
import { useAppStore } from '../../stores/appStore'
import { WidgetDefinition, WidgetConfig } from './widgets/types'
import { api, Project } from '../../services/api'

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

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep('select')
      setSelectedWidget(null)
      setConfig({})
      setFilterType('project')
      setSelectedProjectIds([])
      setSelectedPlaybookId('')
    }
  }, [isOpen])

  // Fetch projects and playbooks when needed for active-tasks config
  useEffect(() => {
    if (isOpen && selectedWidget?.requiresConfig === 'active-tasks') {
      api.getProjects({ status: 'active' }).then(setProjects).catch(console.error)
      api.getPlaybooks({ active_only: true }).then(setPlaybooks).catch(console.error)
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
                  {projects.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">No active projects</div>
                  ) : (
                    projects.map((project) => {
                      const projectId = project._id || project.id
                      const isSelected = selectedProjectIds.includes(projectId)
                      return (
                        <div
                          key={projectId}
                          onClick={() => toggleProjectSelection(projectId)}
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
                          <span className="text-sm text-gray-700 truncate">
                            {getProjectDisplayName(project)}
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
                {step === 'select' ? 'Add Widget' : `Configure ${selectedWidget?.name}`}
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
