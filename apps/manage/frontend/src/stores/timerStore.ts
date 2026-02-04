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
  /** Rich text notes taken during the timer session */
  notes?: string
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
  setNotes: (id: string, notes: string) => void
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
                notes: '',
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

      setNotes: (id, notes) => {
        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === id ? { ...t, notes } : t
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

// Helper to speak text using Web Speech API with a natural voice
export function speakText(text: string): void {
  if (!('speechSynthesis' in window)) return

  // Cancel any pending speech
  window.speechSynthesis.cancel()

  const speak = () => {
    const utterance = new SpeechSynthesisUtterance(text)

    // Get available voices and find a natural-sounding one
    const voices = window.speechSynthesis.getVoices()

    // Priority list of natural-sounding voices (in order of preference)
    const preferredVoices = [
      'Samantha',           // macOS - very natural
      'Karen',              // macOS Australian - natural
      'Daniel',             // macOS British - natural
      'Moira',              // macOS Irish - natural
      'Tessa',              // macOS South African - natural
      'Google US English',  // Chrome - good quality
      'Google UK English Female',
      'Microsoft Zira',     // Windows - decent
      'Microsoft David',    // Windows - decent
    ]

    // Find the best available voice
    let selectedVoice: SpeechSynthesisVoice | null = null
    for (const name of preferredVoices) {
      const voice = voices.find(v => v.name.includes(name))
      if (voice) {
        selectedVoice = voice
        break
      }
    }

    // Fallback: find any English voice that's not the default robotic one
    if (!selectedVoice) {
      selectedVoice = voices.find(v =>
        v.lang.startsWith('en') &&
        !v.name.toLowerCase().includes('default') &&
        (v.localService || v.name.includes('Google'))
      ) || null
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice
    }

    utterance.rate = 0.95  // Slightly slower for clarity
    utterance.pitch = 1.0
    utterance.volume = 1.0

    window.speechSynthesis.speak(utterance)
  }

  // Voices may not be loaded yet, so we need to handle both cases
  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) {
    speak()
  } else {
    // Wait for voices to load
    window.speechSynthesis.onvoiceschanged = () => {
      speak()
    }
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
