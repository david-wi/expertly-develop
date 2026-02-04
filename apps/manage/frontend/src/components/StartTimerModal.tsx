import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Clock, Play } from 'lucide-react'
import { useTimerStore } from '../stores/timerStore'

interface StartTimerModalProps {
  isOpen: boolean
  onClose: () => void
  /** Context for the timer - task info, or generic */
  context?: {
    type: 'task' | 'generic'
    taskId?: string
    taskTitle?: string
  }
  /** Default label if no context provided */
  defaultLabel?: string
}

const PRESET_DURATIONS = [
  { label: '5 min', seconds: 5 * 60 },
  { label: '10 min', seconds: 10 * 60 },
  { label: '15 min', seconds: 15 * 60 },
  { label: '25 min', seconds: 25 * 60 },
  { label: '45 min', seconds: 45 * 60 },
  { label: '1 hour', seconds: 60 * 60 },
]

export default function StartTimerModal({
  isOpen,
  onClose,
  context,
  defaultLabel = 'Focus Session',
}: StartTimerModalProps) {
  const { startTimer } = useTimerStore()
  const [selectedDuration, setSelectedDuration] = useState(5 * 60) // 5 minutes default
  const [customMinutes, setCustomMinutes] = useState('')

  const label = context?.taskTitle || defaultLabel

  const handleStart = () => {
    const duration = customMinutes ? parseInt(customMinutes, 10) * 60 : selectedDuration

    if (duration <= 0) return

    const timerId = context?.taskId
      ? `task-${context.taskId}`
      : `generic-${Date.now()}`

    startTimer({
      id: timerId,
      label,
      duration,
      context,
    })

    onClose()
  }

  const handlePresetClick = (seconds: number) => {
    setSelectedDuration(seconds)
    setCustomMinutes('')
  }

  const handleCustomChange = (value: string) => {
    setCustomMinutes(value)
    if (value) {
      setSelectedDuration(0) // Clear preset selection when custom is entered
    }
  }

  const effectiveDuration = customMinutes ? parseInt(customMinutes, 10) * 60 : selectedDuration

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-30" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-white">
                <Clock className="w-6 h-6" />
                <div>
                  <h3 className="text-lg font-semibold">Start Timer</h3>
                  <p className="text-sm text-white/80 truncate max-w-[280px]">
                    {label}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-white/80 hover:text-white rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Preset durations */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select duration
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_DURATIONS.map((preset) => (
                  <button
                    key={preset.seconds}
                    onClick={() => handlePresetClick(preset.seconds)}
                    className={`px-4 py-3 text-sm font-medium rounded-lg border-2 transition-all ${
                      selectedDuration === preset.seconds && !customMinutes
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or enter custom minutes
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="480"
                  value={customMinutes}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  placeholder="e.g., 30"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <span className="text-gray-500">minutes</span>
              </div>
            </div>

            {/* Preview */}
            {effectiveDuration > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-500">Timer will run for</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.floor(effectiveDuration / 60)} minute{Math.floor(effectiveDuration / 60) !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStart}
              disabled={effectiveDuration <= 0}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              Start Timer
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
