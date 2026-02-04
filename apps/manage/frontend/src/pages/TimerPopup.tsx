import { useEffect, useRef, useState } from 'react'
import { Play, Pause, X, Clock, Plus, Check, MessageSquarePlus, ArrowDownToLine } from 'lucide-react'
import {
  useTimerStore,
  formatTime,
  playTimerSound,
  speakText,
  stopSpeech,
  Timer,
} from '../stores/timerStore'
import { api } from '../services/api'
import RichTextEditor, { isRichTextEmpty } from '../components/RichTextEditor'

/**
 * TimerPopup - A standalone page for the timer widget when popped out
 * This page is opened in a separate browser window and shows a minimal timer UI
 */
export default function TimerPopup() {
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
    markTimeLogged,
    setPoppedOut,
  } = useTimerStore()

  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const hasPlayedAlertRef = useRef<Set<string>>(new Set())

  // Get the active (non-acknowledged) timer
  const activeTimer = timers.find((t) => !t.acknowledged)

  // Mark as popped out on mount, reset on unmount
  useEffect(() => {
    setPoppedOut(true)

    // Set window title
    document.title = activeTimer ? `${formatTime(activeTimer.remaining)} - Timer` : 'Timer'

    return () => {
      setPoppedOut(false)
    }
  }, [setPoppedOut, activeTimer])

  // Update window title with remaining time
  useEffect(() => {
    if (activeTimer) {
      document.title = `${formatTime(activeTimer.remaining)} - ${activeTimer.label}`
    } else {
      document.title = 'Timer'
    }
  }, [activeTimer?.remaining, activeTimer?.label])

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

  // Log time worked to the task
  const logTimeToTask = async (timer: Timer): Promise<void> => {
    if (!timer.context?.taskId || timer.timeLogged) return

    const timeWorked = timer.duration - timer.remaining
    if (timeWorked < 60) return

    try {
      const startTime = timer.startedAt || new Date().toISOString()
      const endTime = new Date().toISOString()

      await api.logTimeEntry(timer.context.taskId, {
        start_time: startTime,
        end_time: endTime,
        notes: timer.notes || undefined,
      })
      markTimeLogged(timer.id)
    } catch (err) {
      console.error('Failed to log time to task:', err)
    }
  }

  // Explicitly save notes as a task comment
  const handleAddNotesToTask = async (timer: Timer): Promise<void> => {
    if (!timer.context?.taskId || !timer.notes || isRichTextEmpty(timer.notes)) {
      return
    }

    setSavingNotes(true)
    try {
      await api.createTaskComment(timer.context.taskId, {
        content: timer.notes,
      })
      setNotes(timer.id, '')
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save timer notes as comment:', err)
    } finally {
      setSavingNotes(false)
    }
  }

  // Handle completing the task
  const handleCompleteTask = async (timer: Timer) => {
    if (!timer.context?.taskId) return

    stopSpeech()
    setCompletingTaskId(timer.context.taskId)
    try {
      await logTimeToTask(timer)
      await api.quickCompleteTask(timer.context.taskId)
      stopTimer(timer.id)
    } catch (err) {
      console.error('Failed to complete task:', err)
    } finally {
      setCompletingTaskId(null)
    }
  }

  // Handle dismissing the timer
  const handleDismiss = async (timer: Timer) => {
    stopSpeech()
    await logTimeToTask(timer)
    if (timer.isComplete) {
      acknowledgeTimer(timer.id)
    }
    stopTimer(timer.id)
  }

  // Pop back into main window
  const handlePopIn = () => {
    setPoppedOut(false)
    window.close()
  }

  if (!activeTimer) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No active timer</p>
          <button
            onClick={() => window.close()}
            className="mt-4 text-sm text-primary-600 hover:text-primary-700"
          >
            Close window
          </button>
        </div>
      </div>
    )
  }

  const progress = activeTimer.duration > 0
    ? ((activeTimer.duration - activeTimer.remaining) / activeTimer.duration) * 100
    : 0

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-2">
      <div
        className={`w-full max-w-sm bg-white rounded-xl shadow-2xl border-2 overflow-hidden ${
          activeTimer.isComplete
            ? 'border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.5)]'
            : 'border-primary-400'
        }`}
        style={activeTimer.isComplete ? {
          animation: 'timer-glow 2s ease-in-out infinite',
        } : undefined}
      >
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
          <div className="flex items-center gap-2 text-white flex-1">
            <Clock className="w-5 h-5" />
            <span className="font-medium truncate">
              {activeTimer.isComplete ? "Time's Up!" : activeTimer.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white font-mono text-lg font-bold">
              {formatTime(activeTimer.remaining)}
            </span>
            <button
              onClick={handlePopIn}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Pop back into main window"
            >
              <ArrowDownToLine className="w-4 h-4 text-white/80" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-200">
          <div
            className={`h-full transition-all duration-1000 ${
              activeTimer.isComplete ? 'bg-green-400' : 'bg-primary-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
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

          {/* Add time buttons */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">
              {activeTimer.isComplete ? 'Extend:' : 'Add time:'}
            </span>
            <button
              onClick={() => { stopSpeech(); addTime(activeTimer.id, 5 * 60) }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              <Plus className="w-3 h-3" />
              5m
            </button>
            <button
              onClick={() => { stopSpeech(); addTime(activeTimer.id, 20 * 60) }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              <Plus className="w-3 h-3" />
              20m
            </button>
            <button
              onClick={() => { stopSpeech(); addTime(activeTimer.id, 60 * 60) }}
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-500">
                  Session Notes
                </label>
                {notesSaved ? (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Added to task
                  </span>
                ) : (
                  <button
                    onClick={() => handleAddNotesToTask(activeTimer)}
                    disabled={savingNotes || !activeTimer.notes || isRichTextEmpty(activeTimer.notes)}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    <MessageSquarePlus className="w-3 h-3" />
                    {savingNotes ? 'Saving...' : 'Add to Task'}
                  </button>
                )}
              </div>
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
        </div>
      </div>
    </div>
  )
}
