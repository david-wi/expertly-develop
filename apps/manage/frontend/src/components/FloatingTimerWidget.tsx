import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Pause, X, Clock, Plus, Check, ChevronDown, ChevronUp, GripHorizontal } from 'lucide-react'
import {
  useTimerStore,
  formatTime,
  playTimerSound,
  speakText,
  Timer,
} from '../stores/timerStore'
import { api } from '../services/api'
import { useAppStore } from '../stores/appStore'
import RichTextEditor, { isRichTextEmpty } from './RichTextEditor'

interface FloatingTimerWidgetProps {
  className?: string
}

export default function FloatingTimerWidget({ className = '' }: FloatingTimerWidgetProps) {
  const navigate = useNavigate()
  const { fetchTasks } = useAppStore()
  const {
    timers,
    tickTimers,
    pauseTimer,
    resumeTimer,
    addTime,
    setWhatNext,
    setNotes,
    acknowledgeTimer,
    stopTimer,
  } = useTimerStore()

  const [isExpanded, setIsExpanded] = useState(true)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [savingNotes, setSavingNotes] = useState(false)
  const hasPlayedAlertRef = useRef<Set<string>>(new Set())

  // Draggable state
  const [position, setPosition] = useState({ x: 16, y: 16 }) // top-right default (right: 16, top: 16)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Get the active (non-acknowledged) timer
  const activeTimer = timers.find((t) => !t.acknowledged)

  // Tick timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      tickTimers()
    }, 1000)
    return () => clearInterval(interval)
  }, [tickTimers])

  // Play alert when timer completes
  useEffect(() => {
    timers.forEach((timer) => {
      if (timer.isComplete && !timer.acknowledged && !hasPlayedAlertRef.current.has(timer.id)) {
        hasPlayedAlertRef.current.add(timer.id)
        playTimerSound()
        setTimeout(() => {
          speakText(`Your timeboxed session for ${timer.label} is complete.`)
        }, 2000)
      }
    })
  }, [timers])

  // Save notes as a task comment if there are notes and a task context
  const saveNotesAsComment = async (timer: Timer): Promise<void> => {
    if (!timer.context?.taskId || !timer.notes || isRichTextEmpty(timer.notes)) {
      return
    }

    setSavingNotes(true)
    try {
      await api.createTaskComment(timer.context.taskId, {
        content: timer.notes,
      })
    } catch (err) {
      console.error('Failed to save timer notes as comment:', err)
    } finally {
      setSavingNotes(false)
    }
  }

  // Handle completing the task
  const handleCompleteTask = async (timer: Timer) => {
    if (!timer.context?.taskId) return

    setCompletingTaskId(timer.context.taskId)
    try {
      // Save notes as a comment first
      await saveNotesAsComment(timer)
      await api.quickCompleteTask(timer.context.taskId)
      fetchTasks()
      stopTimer(timer.id)
    } catch (err) {
      console.error('Failed to complete task:', err)
    } finally {
      setCompletingTaskId(null)
    }
  }

  // Handle dismissing the timer
  const handleDismiss = async (timer: Timer) => {
    // Save notes as a comment before dismissing
    await saveNotesAsComment(timer)

    if (timer.isComplete) {
      acknowledgeTimer(timer.id)
      stopTimer(timer.id)
    } else {
      stopTimer(timer.id)
    }
  }

  // Handle navigating to the task
  const handleGoToTask = (timer: Timer) => {
    if (timer.context?.taskId) {
      navigate(`/queues?task=${timer.context.taskId}`)
    }
  }

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    }
  }, [position])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y

    // Calculate new position (using right/top positioning)
    const newX = Math.max(0, dragStartRef.current.posX - deltaX)
    const newY = Math.max(0, dragStartRef.current.posY + deltaY)

    // Constrain to viewport
    const maxX = window.innerWidth - (containerRef.current?.offsetWidth || 320) - 16
    const maxY = window.innerHeight - (containerRef.current?.offsetHeight || 200) - 16

    setPosition({
      x: Math.min(newX, maxX),
      y: Math.min(newY, maxY),
    })
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Add/remove global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  if (!activeTimer) return null

  const progress = activeTimer.duration > 0
    ? ((activeTimer.duration - activeTimer.remaining) / activeTimer.duration) * 100
    : 0

  return (
    <div
      ref={containerRef}
      className={`fixed z-50 ${className} ${isDragging ? 'cursor-grabbing' : ''}`}
      style={{
        minWidth: '320px',
        maxWidth: '400px',
        right: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl border-2 overflow-hidden transition-all ${
          activeTimer.isComplete
            ? 'border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.5)] animate-glow'
            : 'border-primary-400'
        }`}
        style={activeTimer.isComplete ? {
          animation: 'timer-glow 2s ease-in-out infinite',
        } : undefined}
      >
        {/* Custom keyframes for glow animation */}
        <style>{`
          @keyframes timer-glow {
            0%, 100% { box-shadow: 0 0 20px rgba(74, 222, 128, 0.5); }
            50% { box-shadow: 0 0 40px rgba(74, 222, 128, 0.8), 0 0 60px rgba(74, 222, 128, 0.4); }
          }
        `}</style>
        {/* Header */}
        <div
          className={`px-4 py-3 flex items-center justify-between ${
            activeTimer.isComplete
              ? 'bg-gradient-to-r from-green-500 to-green-600'
              : 'bg-gradient-to-r from-primary-500 to-primary-600'
          }`}
        >
          {/* Drag handle */}
          <div
            className="cursor-grab active:cursor-grabbing p-1 -ml-2 mr-1 hover:bg-white/20 rounded transition-colors"
            onMouseDown={handleMouseDown}
            title="Drag to move"
          >
            <GripHorizontal className="w-4 h-4 text-white/70" />
          </div>
          <div
            className="flex items-center gap-2 text-white flex-1 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Clock className="w-5 h-5" />
            <span className="font-medium truncate max-w-[200px]">
              {activeTimer.isComplete ? 'Time\'s Up!' : activeTimer.label}
            </span>
          </div>
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span className="text-white font-mono text-lg font-bold">
              {formatTime(activeTimer.remaining)}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-white/80" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/80" />
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div
            className={`h-full transition-all duration-1000 ${
              activeTimer.isComplete ? 'bg-green-400' : 'bg-primary-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="p-4 space-y-4">
            {/* Timer controls */}
            {!activeTimer.isComplete && (
              <div className="flex items-center justify-center gap-2">
                {activeTimer.isPaused ? (
                  <button
                    onClick={() => resumeTimer(activeTimer.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={() => pauseTimer(activeTimer.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                )}
              </div>
            )}

            {/* Add time buttons - always visible so user can extend even after completion */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">
                {activeTimer.isComplete ? 'Extend:' : 'Add time:'}
              </span>
              <button
                onClick={() => addTime(activeTimer.id, 5 * 60)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                <Plus className="w-3 h-3" />
                5m
              </button>
              <button
                onClick={() => addTime(activeTimer.id, 20 * 60)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                <Plus className="w-3 h-3" />
                20m
              </button>
              <button
                onClick={() => addTime(activeTimer.id, 60 * 60)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                <Plus className="w-3 h-3" />
                1hr
              </button>
            </div>

            {/* What next field */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                What to do after this?
              </label>
              <input
                type="text"
                value={activeTimer.whatNext || ''}
                onChange={(e) => setWhatNext(activeTimer.id, e.target.value)}
                placeholder="Remind yourself what's next..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Session notes - only shown for task timers */}
            {activeTimer.context?.type === 'task' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Session Notes
                  <span className="font-normal text-gray-400 ml-1">(saved to task)</span>
                </label>
                <RichTextEditor
                  value={activeTimer.notes || ''}
                  onChange={(notes) => setNotes(activeTimer.id, notes)}
                  placeholder="Take notes while working..."
                  minHeight={60}
                  disabled={savingNotes}
                />
              </div>
            )}

            {/* Completion actions */}
            {activeTimer.isComplete && (
              <div className="space-y-2">
                <p className="text-center text-green-700 font-medium">
                  Great work! Session complete.
                </p>
                {activeTimer.whatNext && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-600 font-medium">Next up:</p>
                    <p className="text-sm text-amber-800">{activeTimer.whatNext}</p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {activeTimer.context?.type === 'task' && activeTimer.context.taskId && (
                    <button
                      onClick={() => handleCompleteTask(activeTimer)}
                      disabled={completingTaskId === activeTimer.context.taskId}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      {completingTaskId === activeTimer.context.taskId
                        ? 'Completing...'
                        : 'Mark Complete'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(activeTimer)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons while timer is running */}
            {!activeTimer.isComplete && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                {activeTimer.context?.type === 'task' && activeTimer.context.taskId && (
                  <button
                    onClick={() => handleCompleteTask(activeTimer)}
                    disabled={completingTaskId === activeTimer.context.taskId}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 text-sm"
                  >
                    <Check className="w-4 h-4" />
                    {completingTaskId === activeTimer.context.taskId
                      ? 'Completing...'
                      : 'Mark Complete'}
                  </button>
                )}
                <button
                  onClick={() => handleDismiss(activeTimer)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  <X className="w-4 h-4" />
                  Close
                </button>
              </div>
            )}

            {/* Task link */}
            {!activeTimer.isComplete && activeTimer.context?.type === 'task' && (
              <div className="flex items-center justify-center">
                <button
                  onClick={() => handleGoToTask(activeTimer)}
                  className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
                >
                  View task
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
