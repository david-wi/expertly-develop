import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { server } from '../test/mocks/server'
import { mockTasks } from '../test/mocks/handlers'
import { useTasks, useTask, useNextTask } from './useTasks'

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

// Create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useTasks', () => {
  it('fetches tasks successfully', async () => {
    const { result } = renderHook(() => useTasks(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].title).toBe('Test Task 1')
  })

  it('returns loading state initially', () => {
    const { result } = renderHook(() => useTasks(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
  })

  it('passes params to query key', async () => {
    const params = { status: 'queued', limit: 10 }
    const { result } = renderHook(() => useTasks(params), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Query should succeed (mock returns all tasks regardless of params)
    expect(result.current.data).toBeDefined()
  })
})

describe('useTask', () => {
  it('fetches single task by ID', async () => {
    const { result } = renderHook(() => useTask('1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.id).toBe('1')
    expect(result.current.data?.title).toBe('Test Task 1')
  })

  it('is disabled when id is empty', () => {
    const { result } = renderHook(() => useTask(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useNextTask', () => {
  it('fetches next task with context', async () => {
    const { result } = renderHook(() => useNextTask(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.task).toBeDefined()
    expect(result.current.data?.task.title).toBe(mockTasks[0].title)
    expect(result.current.data?.context).toBeDefined()
    expect(result.current.data?.matched_playbooks).toBeDefined()
  })
})
