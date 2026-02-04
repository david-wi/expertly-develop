import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Timer {
  id: string
  label: string
  /** Total duration in seconds */
  duration: number
  /** Remaining time in seconds */
  remaining: number
  /** Whether the timer is paused */
  isPaused: boolean
  /** When the timer was last updated (for calculating elapsed time) */
  lastTick: number
  /** Optional context - e.g., task ID for task timers */
  context?: {
    type: 'task' | 'generic'
    taskId?: string
    taskTitle?: string
  }
  /** What to do after timer completes - user note */
  whatNext?: string
  /** Whether the timer has completed and is showing the completion dialog */
  isComplete: boolean
  /** Whether the completion alert has been acknowledged */
  acknowledged: boolean
}

interface TimerState {
  timers: Timer[]

  // Actions
  startTimer: (params: {
    id: string
    label: string
    duration: number
    context?: Timer['context']
  }) => void
  pauseTimer: (id: string) => void
  resumeTimer: (id: string) => void
  addTime: (id: string, seconds: number) => void
  setWhatNext: (id: string, text: string) => void
  tickTimers: () => void
  completeTimer: (id: string) => void
  acknowledgeTimer: (id: string) => void
  stopTimer: (id: string) => void
  getActiveTimer: () => Timer | undefined
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      timers: [],

      startTimer: ({ id, label, duration, context }) => {
        set((state) => {
          // Remove existing timer with same ID if any
          const filtered = state.timers.filter((t) => t.id !== id)
          return {
            timers: [
              ...filtered,
              {
                id,
                label,
                duration,
                remaining: duration,
                isPaused: false,
                lastTick: Date.now(),
                context,
                whatNext: '',
                isComplete: false,
                acknowledged: false,
              },
            ],
          }
        })
      },

      pauseTimer: (id) => {
        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === id ? { ...t, isPaused: true } : t
          ),
        }))
      },

      resumeTimer: (id) => {
        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === id ? { ...t, isPaused: false, lastTick: Date.now() } : t
          ),
        }))
      },

      addTime: (id, seconds) => {
        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === id
              ? {
                  ...t,
                  remaining: t.remaining + seconds,
                  duration: t.duration + seconds,
                  isComplete: false,
                  acknowledged: false,
                }
              : t
          ),
        }))
      },

      setWhatNext: (id, text) => {
        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === id ? { ...t, whatNext: text } : t
          ),
        }))
      },

      tickTimers: () => {
        const now = Date.now()
        set((state) => ({
          timers: state.timers.map((t) => {
            if (t.isPaused || t.isComplete) return t

            const elapsed = Math.floor((now - t.lastTick) / 1000)
            if (elapsed <= 0) return t

            const newRemaining = Math.max(0, t.remaining - elapsed)
            const isComplete = newRemaining === 0

            return {
              ...t,
              remaining: newRemaining,
              lastTick: now,
              isComplete,
            }
          }),
        }))
      },

      completeTimer: (id) => {
        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === id ? { ...t, isComplete: true, remaining: 0 } : t
          ),
        }))
      },

      acknowledgeTimer: (id) => {
        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === id ? { ...t, acknowledged: true } : t
          ),
        }))
      },

      stopTimer: (id) => {
        set((state) => ({
          timers: state.timers.filter((t) => t.id !== id),
        }))
      },

      getActiveTimer: () => {
        const state = get()
        return state.timers.find((t) => !t.acknowledged)
      },
    }),
    {
      name: 'expertly-manage-timers',
      // Only persist essential fields, recalculate lastTick on hydration
      partialize: (state) => ({
        timers: state.timers.map((t) => ({
          ...t,
          lastTick: Date.now(), // Reset lastTick on load
        })),
      }),
    }
  )
)

// Helper to format time as MM:SS or HH:MM:SS
export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Helper to speak text using Web Speech API
export function speakText(text: string): void {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.volume = 1
    window.speechSynthesis.speak(utterance)
  }
}

// Helper to play a notification sound
export function playTimerSound(): void {
  // Create a simple chime using Web Audio API
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

    const playNote = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = frequency
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.3, startTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration)

      oscillator.start(startTime)
      oscillator.stop(startTime + duration)
    }

    // Play a pleasant chime pattern (3 times)
    const now = audioContext.currentTime
    const notes = [523.25, 659.25, 783.99] // C5, E5, G5

    for (let repeat = 0; repeat < 3; repeat++) {
      const offset = repeat * 1.2
      notes.forEach((freq, i) => {
        playNote(freq, now + offset + i * 0.15, 0.4)
      })
    }
  } catch {
    // Fallback: no sound if Web Audio API not available
    console.log('Timer complete (audio not available)')
  }
}
