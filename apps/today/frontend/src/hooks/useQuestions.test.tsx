import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { server } from '../test/mocks/server'
import { mockQuestions } from '../test/mocks/handlers'
import { useQuestions, useUnansweredQuestions, useAnswerQuestion } from './useQuestions'

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

describe('useQuestions', () => {
  it('fetches questions successfully', async () => {
    const { result } = renderHook(() => useQuestions(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].text).toBe(mockQuestions[0].text)
  })

  it('returns loading state initially', () => {
    const { result } = renderHook(() => useQuestions(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
  })
})

describe('useUnansweredQuestions', () => {
  it('fetches only unanswered questions', async () => {
    const { result } = renderHook(() => useUnansweredQuestions(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.every((q) => q.status === 'unanswered')).toBe(true)
  })
})

describe('useAnswerQuestion', () => {
  it('answers question successfully', async () => {
    const { result } = renderHook(() => useAnswerQuestion(), {
      wrapper: createWrapper(),
    })

    let response: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      response = await result.current.mutateAsync({ id: 'q1', answer: 'The answer' })
    })

    expect(response?.question.status).toBe('answered')
    expect(response?.question.answer).toBe('The answer')
  })
})
