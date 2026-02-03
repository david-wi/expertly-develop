import { useState, useRef, useEffect } from 'react'
import { Task, Project } from '../services/api'
import ProjectTypeahead from './ProjectTypeahead'

interface Playbook {
  _id?: string
  id: string
  name: string
}

interface TaskEditPanelProps {
  task: Task
  projects: Project[]
  playbooks: Playbook[]
  onSave: (updates: Partial<Task>) => Promise<void>
  onClose: () => void
  onOpenFullModal?: () => void // "More options..." link
}

export function TaskEditPanel({
  task,
  projects,
  playbooks,
  onSave,
  onClose,
  onOpenFullModal,
}: TaskEditPanelProps) {
  const [editTitle, setEditTitle] = useState(task.title)
  const [editProjectId, setEditProjectId] = useState(task.project_id || '')
  const [editDescription, setEditDescription] = useState(task.description || '')
  const [editPlaybookId, setEditPlaybookId] = useState(task.playbook_id || '')
  const [isSaving, setIsSaving] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)
  const instructionsRef = useRef<HTMLTextAreaElement>(null)
  const playbookRef = useRef<HTMLSelectElement>(null)
  const doneRef = useRef<HTMLButtonElement>(null)

  // Focus title when task changes
  useEffect(() => {
    setEditTitle(task.title)
    setEditProjectId(task.project_id || '')
    setEditDescription(task.description || '')
    setEditPlaybookId(task.playbook_id || '')
    setTimeout(() => titleRef.current?.focus(), 0)
  }, [task])

  const saveEditedTask = async () => {
    if (isSaving) return

    // Only save if something changed
    const titleChanged = editTitle !== task.title
    const projectChanged = editProjectId !== (task.project_id || '')
    const descChanged = editDescription !== (task.description || '')
    const playbookChanged = editPlaybookId !== (task.playbook_id || '')

    if (!titleChanged && !projectChanged && !descChanged && !playbookChanged) {
      return
    }

    if (!editTitle.trim()) return

    setIsSaving(true)
    try {
      await onSave({
        title: editTitle.trim(),
        project_id: editProjectId || undefined,
        description: editDescription.trim() || undefined,
        playbook_id: editPlaybookId || undefined,
      })
    } catch (err) {
      console.error('Failed to update task:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = async () => {
    await saveEditedTask()
    onClose()
  }

  return (
    <div className="w-1/2 p-3 overflow-auto bg-gray-50/50 border-l border-gray-200">
      <div className="space-y-3">
        {/* Editable title */}
        <div>
          <input
            ref={titleRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={saveEditedTask}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                saveEditedTask()
              } else if (e.key === 'Escape') {
                handleClose()
              } else if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault()
                instructionsRef.current?.focus()
              }
            }}
            disabled={isSaving}
            className="w-full text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200"
            placeholder="Task title"
          />
        </div>

        {/* Project selector */}
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">
            Project
          </label>
          <ProjectTypeahead
            projects={projects.map((p) => ({
              id: p._id || p.id,
              name: p.name,
              parent_project_id: p.parent_project_id,
            }))}
            selectedProjectId={editProjectId || null}
            onChange={(projectId) => {
              setEditProjectId(projectId || '')
              setTimeout(() => saveEditedTask(), 0)
            }}
            placeholder="Search projects..."
            disabled={isSaving}
            className="text-xs"
          />
        </div>

        {/* Editable instructions */}
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">
            Instructions
          </label>
          <textarea
            ref={instructionsRef}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            onBlur={saveEditedTask}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                handleClose()
              } else if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault()
                playbookRef.current?.focus()
              }
            }}
            disabled={isSaving}
            rows={4}
            className="w-full text-xs text-gray-700 bg-white border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200 resize-none"
            placeholder="Add instructions..."
          />
        </div>

        {/* Playbook selector */}
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">
            Playbook
          </label>
          <select
            ref={playbookRef}
            value={editPlaybookId}
            onChange={(e) => setEditPlaybookId(e.target.value)}
            onBlur={saveEditedTask}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleClose()
              } else if (e.key === 'Escape') {
                handleClose()
              } else if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault()
                doneRef.current?.focus()
              }
            }}
            disabled={isSaving}
            className="w-full text-xs text-gray-700 bg-white border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200"
          >
            <option value="">No playbook</option>
            {playbooks.map((pb) => (
              <option key={pb._id || pb.id} value={pb._id || pb.id}>
                {pb.name}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          {onOpenFullModal ? (
            <button onClick={onOpenFullModal} className="text-xs text-gray-500 hover:text-gray-700">
              More options...
            </button>
          ) : (
            <div />
          )}
          <button
            ref={doneRef}
            onClick={handleClose}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleClose()
              }
            }}
            className="px-3 py-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
