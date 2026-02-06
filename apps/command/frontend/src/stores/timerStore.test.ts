import { describe, it, expect, beforeEach } from 'vitest'
import { useTimerStore } from './timerStore'

describe('timerStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useTimerStore.setState({ timers: [], isPoppedOut: false })
  })

  describe('startTimer', () => {
    it('should create a new timer', () => {
      const { startTimer } = useTimerStore.getState()

      startTimer({
        id: 'test-1',
        label: 'Test Timer',
        duration: 300,
      })

      const { timers } = useTimerStore.getState()
      expect(timers).toHaveLength(1)
      expect(timers[0]).toMatchObject({
        id: 'test-1',
        label: 'Test Timer',
        duration: 300,
        remaining: 300,
        isPaused: false,
        isComplete: false,
        acknowledged: false,
      })
    })

    it('should add new timer at the BEGINNING of the array to make it active', () => {
      const { startTimer, pauseTimer } = useTimerStore.getState()

      // Start first timer
      startTimer({
        id: 'timer-1',
        label: 'First Timer',
        duration: 300,
      })

      // Pause the first timer
      pauseTimer('timer-1')

      // Start a second timer (this should become the active one)
      startTimer({
        id: 'timer-2',
        label: 'Second Timer',
        duration: 600,
      })

      const { timers, getActiveTimer } = useTimerStore.getState()

      // Should have 2 timers
      expect(timers).toHaveLength(2)

      // New timer should be at the beginning
      expect(timers[0].id).toBe('timer-2')
      expect(timers[1].id).toBe('timer-1')

      // Active timer (first unacknowledged) should be the new one
      const activeTimer = getActiveTimer()
      expect(activeTimer?.id).toBe('timer-2')
      expect(activeTimer?.isPaused).toBe(false)
    })

    it('should replace existing timer with same ID', () => {
      const { startTimer } = useTimerStore.getState()

      startTimer({
        id: 'task-123',
        label: 'Original Timer',
        duration: 300,
      })

      startTimer({
        id: 'task-123',
        label: 'Replacement Timer',
        duration: 600,
      })

      const { timers } = useTimerStore.getState()
      expect(timers).toHaveLength(1)
      expect(timers[0].label).toBe('Replacement Timer')
      expect(timers[0].duration).toBe(600)
    })
  })

  describe('pauseTimer', () => {
    it('should pause an active timer', () => {
      const { startTimer, pauseTimer } = useTimerStore.getState()

      startTimer({
        id: 'test-1',
        label: 'Test Timer',
        duration: 300,
      })

      pauseTimer('test-1')

      const { timers } = useTimerStore.getState()
      expect(timers[0].isPaused).toBe(true)
    })
  })

  describe('resumeTimer', () => {
    it('should resume a paused timer', () => {
      const { startTimer, pauseTimer, resumeTimer } = useTimerStore.getState()

      startTimer({
        id: 'test-1',
        label: 'Test Timer',
        duration: 300,
      })

      pauseTimer('test-1')
      expect(useTimerStore.getState().timers[0].isPaused).toBe(true)

      resumeTimer('test-1')
      expect(useTimerStore.getState().timers[0].isPaused).toBe(false)
    })
  })

  describe('getActiveTimer', () => {
    it('should return the first unacknowledged timer', () => {
      const { startTimer, getActiveTimer } = useTimerStore.getState()

      startTimer({
        id: 'test-1',
        label: 'First Timer',
        duration: 300,
      })

      startTimer({
        id: 'test-2',
        label: 'Second Timer',
        duration: 600,
      })

      const activeTimer = getActiveTimer()
      // Second timer should be first (at beginning of array)
      expect(activeTimer?.id).toBe('test-2')
    })

    it('should return undefined when all timers are acknowledged', () => {
      const { startTimer, acknowledgeTimer, getActiveTimer } = useTimerStore.getState()

      startTimer({
        id: 'test-1',
        label: 'Test Timer',
        duration: 300,
      })

      acknowledgeTimer('test-1')

      const activeTimer = getActiveTimer()
      expect(activeTimer).toBeUndefined()
    })
  })

  describe('stopTimer', () => {
    it('should remove a timer from the list', () => {
      const { startTimer, stopTimer } = useTimerStore.getState()

      startTimer({
        id: 'test-1',
        label: 'Test Timer',
        duration: 300,
      })

      stopTimer('test-1')

      const { timers } = useTimerStore.getState()
      expect(timers).toHaveLength(0)
    })
  })
})
