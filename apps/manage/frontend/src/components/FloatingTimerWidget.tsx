import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Pause, X, Clock, Plus, Check, ChevronDown, ChevronUp } from 'lucide-react'
import {
  useTimerStore,
  formatTime,
  playTimerSound,
  speakText,
  Timer,
} from '../stores/timerStore'
import { api } from '../services/api'
import { useAppStore } from '../stores/appStore'

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
    acknowledgeTimer,
    stopTimer,
  } = useTimerStore()

  const [isExpanded, setIsExpanded] = useState(true)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const hasPlayedAlertRef = useRef<Set<string>>(new Set())

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

  // Handle completing the task
  const handleCompleteTask = async (timer: Timer) => {
    if (!timer.context?.taskId) return

    setCompletingTaskId(timer.context.taskId)
    try {
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
  const handleDismiss = (timer: Timer) => {
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

  if (!activeTimer) return null

  const progress = activeTimer.duration > 0
    ? ((activeTimer.duration - activeTimer.remaining) / activeTimer.duration) * 100
    : 0

  return (
    <div
      className={`fixed top-4 right-4 z-50 ${className}`}
      style={{ minWidth: '320px', maxWidth: '400px' }}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl border-2 overflow-hidden transition-all ${
          activeTimer.isComplete
            ? 'border-green-400 animate-pulse'
            : 'border-primary-400'
        }`}
      >
        {/* Header */}
        <div
          className={`px-4 py-3 flex items-center justify-between cursor-pointer ${
            activeTimer.isComplete
              ? 'bg-gradient-to-r from-green-500 to-green-600'
              : 'bg-gradient-to-r from-primary-500 to-primary-600'
          }`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 text-white">
            <Clock className="w-5 h-5" />
            <span className="font-medium truncate max-w-[200px]">
              {activeTimer.isComplete ? 'Time\'s Up!' : activeTimer.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
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

            {/* Add time buttons */}
            {!activeTimer.isComplete && (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">Add time:</span>
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
            )}

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

            {/* Task link and cancel */}
            {!activeTimer.isComplete && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                {activeTimer.context?.type === 'task' && (
                  <button
                    onClick={() => handleGoToTask(activeTimer)}
                    className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
                  >
                    View task
                  </button>
                )}
                <button
                  onClick={() => handleDismiss(activeTimer)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors ml-auto"
                >
                  <X className="w-3 h-3" />
                  Cancel timer
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
