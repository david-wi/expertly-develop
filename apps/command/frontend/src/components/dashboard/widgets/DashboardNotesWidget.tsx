import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Save, X, History } from 'lucide-react'
import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { api, DashboardNote, DashboardNoteVersionEntry } from '../../../services/api'
import { useDashboardStore } from '../../../stores/dashboardStore'
import ReactMarkdown from 'react-markdown'

export function DashboardNotesWidget({ widgetId, config }: WidgetProps) {
  const { updateWidgetConfig } = useDashboardStore()
  const [notes, setNotes] = useState<DashboardNote[]>([])
  const [allUserNotes, setAllUserNotes] = useState<DashboardNote[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<DashboardNoteVersionEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')

  const noteIds = config.noteIds || []

  // Fetch all user notes for the add menu
  const fetchAllUserNotes = useCallback(async () => {
    try {
      const data = await api.getDashboardNotes()
      setAllUserNotes(data)
    } catch (err) {
      console.error('Failed to fetch user notes:', err)
    }
  }, [])

  // Fetch the specific notes for this widget
  const fetchNotes = useCallback(async () => {
    if (noteIds.length === 0) {
      setNotes([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const notePromises = noteIds.map(id => api.getDashboardNote(id).catch(() => null))
      const results = await Promise.all(notePromises)
      const validNotes = results.filter((n): n is DashboardNote => n !== null)
      setNotes(validNotes)

      // Set active tab to first note if not set
      if (!activeTabId && validNotes.length > 0) {
        setActiveTabId(validNotes[0]._id || validNotes[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err)
    } finally {
      setLoading(false)
    }
  }, [noteIds, activeTabId])

  useEffect(() => {
    fetchNotes()
    fetchAllUserNotes()
  }, [fetchNotes, fetchAllUserNotes])

  const activeNote = notes.find(n => (n._id || n.id) === activeTabId)

  const handleEdit = () => {
    if (activeNote) {
      setEditContent(activeNote.content || '')
      setEditMode(true)
    }
  }

  const handleCancelEdit = () => {
    setEditMode(false)
    setEditContent('')
  }

  const handleSave = async () => {
    if (!activeNote) return

    try {
      setSaving(true)
      await api.updateDashboardNote(activeNote._id || activeNote.id, { content: editContent })
      await fetchNotes()
      setEditMode(false)
      setEditContent('')
    } catch (err) {
      console.error('Failed to save note:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleAddExistingNote = (noteId: string) => {
    if (!noteIds.includes(noteId)) {
      const newNoteIds = [...noteIds, noteId]
      updateWidgetConfig(widgetId, { ...config, noteIds: newNoteIds })
      setActiveTabId(noteId)
    }
    setShowAddMenu(false)
  }

  const handleCreateNewNote = async () => {
    if (!newNoteTitle.trim()) return

    try {
      setSaving(true)
      const newNote = await api.createDashboardNote({
        title: newNoteTitle.trim(),
        content: ''
      })
      await fetchAllUserNotes()

      // Add to widget and set as active
      const newNoteId = newNote._id || newNote.id
      const newNoteIds = [...noteIds, newNoteId]
      updateWidgetConfig(widgetId, { ...config, noteIds: newNoteIds })
      setActiveTabId(newNoteId)
      setCreatingNew(false)
      setNewNoteTitle('')
      setShowAddMenu(false)

      // Refetch notes
      await fetchNotes()
    } catch (err) {
      console.error('Failed to create note:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveTab = (noteId: string) => {
    const newNoteIds = noteIds.filter(id => id !== noteId)
    updateWidgetConfig(widgetId, { ...config, noteIds: newNoteIds })

    // If removing active tab, switch to another
    if (activeTabId === noteId && newNoteIds.length > 0) {
      setActiveTabId(newNoteIds[0])
    } else if (newNoteIds.length === 0) {
      setActiveTabId(null)
    }
  }

  const handleShowHistory = async () => {
    if (!activeNote) return

    try {
      setLoadingHistory(true)
      const historyData = await api.getDashboardNoteHistory(activeNote._id || activeNote.id)
      setHistory(historyData)
      setShowHistory(true)
    } catch (err) {
      console.error('Failed to fetch history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleRevertToVersion = async (version: number) => {
    if (!activeNote) return

    try {
      setSaving(true)
      await api.revertDashboardNoteToVersion(activeNote._id || activeNote.id, version)
      await fetchNotes()
      setShowHistory(false)
    } catch (err) {
      console.error('Failed to revert:', err)
    } finally {
      setSaving(false)
    }
  }

  const getWidgetTitle = (): string => {
    return config.widgetTitle || 'Notes'
  }

  // Available notes that aren't already in the widget
  const availableNotes = allUserNotes.filter(n => !noteIds.includes(n._id || n.id))

  const headerAction = (
    <div className="flex items-center gap-2">
      {activeNote && !editMode && (
        <>
          <button
            onClick={handleShowHistory}
            disabled={loadingHistory}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            title="Version history"
          >
            <History className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleEdit}
            className="p-1 text-gray-400 hover:text-primary-600 rounded"
            title="Edit note"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      {editMode && (
        <>
          <button
            onClick={handleCancelEdit}
            disabled={saving}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-1 text-primary-600 hover:text-primary-700 rounded"
            title="Save"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      <div className="relative">
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="p-1 text-gray-400 hover:text-primary-600 rounded"
          title="Add note tab"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {showAddMenu && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            <div className="p-2 border-b border-gray-100">
              <button
                onClick={() => setCreatingNew(true)}
                className="w-full text-left px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create new note
              </button>
            </div>

            {creatingNew && (
              <div className="p-3 border-b border-gray-100">
                <input
                  type="text"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder="Note title..."
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateNewNote()
                    if (e.key === 'Escape') setCreatingNew(false)
                  }}
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setCreatingNew(false)}
                    className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateNewNote}
                    disabled={!newNoteTitle.trim() || saving}
                    className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}

            {availableNotes.length > 0 && (
              <div className="max-h-48 overflow-auto">
                <div className="px-3 py-1.5 text-xs text-gray-500 font-medium">
                  Add existing note
                </div>
                {availableNotes.map(note => (
                  <button
                    key={note._id || note.id}
                    onClick={() => handleAddExistingNote(note._id || note.id)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 truncate"
                  >
                    {note.title}
                  </button>
                ))}
              </div>
            )}

            {availableNotes.length === 0 && !creatingNew && (
              <div className="px-3 py-2 text-xs text-gray-500">
                No other notes available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowAddMenu(false)
      setCreatingNew(false)
    }
    if (showAddMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showAddMenu])

  return (
    <WidgetWrapper widgetId={widgetId} title={getWidgetTitle()} headerAction={headerAction}>
      <div className="flex flex-col h-full">
        {/* Tabs */}
        {notes.length > 0 && (
          <div className="flex border-b border-gray-200 overflow-x-auto flex-shrink-0">
            {notes.map(note => (
              <div
                key={note._id || note.id}
                className={`group flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer border-b-2 whitespace-nowrap ${
                  activeTabId === (note._id || note.id)
                    ? 'border-primary-500 text-primary-600 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTabId(note._id || note.id)}
              >
                <span className="truncate max-w-[120px]">{note.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveTab(note._id || note.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 transition-opacity"
                  title="Remove from widget"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-3">
          {loading ? (
            <div className="text-xs text-gray-500">Loading...</div>
          ) : notes.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-4">
              <p className="mb-2">No notes added yet</p>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowAddMenu(true)
                }}
                className="text-primary-600 hover:text-primary-700 flex items-center gap-1 mx-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                Add a note
              </button>
            </div>
          ) : !activeNote ? (
            <div className="text-xs text-gray-500">Select a note</div>
          ) : editMode ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-full min-h-[120px] p-2 text-sm border border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500 resize-none font-mono"
              placeholder="Write your notes in markdown..."
              autoFocus
            />
          ) : !activeNote.content ? (
            <div className="text-xs text-gray-500 italic">
              This note is empty.{' '}
              <button onClick={handleEdit} className="text-primary-600 hover:text-primary-700">
                Start writing
              </button>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown>{activeNote.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Version info */}
        {activeNote && !editMode && (
          <div className="px-3 py-1.5 border-t border-gray-100 text-[10px] text-gray-400 flex-shrink-0">
            v{activeNote.version} • Updated {new Date(activeNote.updated_at).toLocaleDateString()}
          </div>
        )}

        {/* History modal */}
        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Version History</h3>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-auto max-h-[60vh]">
                {history.map((entry) => (
                  <div
                    key={entry.version}
                    className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        Version {entry.version}
                        {entry.is_current && (
                          <span className="ml-2 text-xs text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                            Current
                          </span>
                        )}
                      </span>
                      {!entry.is_current && (
                        <button
                          onClick={() => handleRevertToVersion(entry.version)}
                          disabled={saving}
                          className="text-xs text-primary-600 hover:text-primary-700"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(entry.changed_at).toLocaleString()}
                    </div>
                    {entry.content && (
                      <div className="mt-2 text-xs text-gray-600 line-clamp-3">
                        {entry.content.substring(0, 200)}
                        {entry.content.length > 200 && '...'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </WidgetWrapper>
  )
}
