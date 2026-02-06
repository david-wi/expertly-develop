import { useState, useEffect, useRef, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseDebouncedSearchOptions<T> {
  /**
   * Async search function. Receives the current query string and an
   * `AbortSignal` for cancellation.
   */
  searchFn: (query: string, signal: AbortSignal) => Promise<T>
  /** Debounce delay in milliseconds. Default: 300. */
  delay?: number
  /** Minimum query length before triggering a search. Default: 1. */
  minLength?: number
}

interface UseDebouncedSearchResult<T> {
  /** Current value of the search input. */
  query: string
  /** Update the search query. */
  setQuery: (value: string) => void
  /** Search results (or null before first search). */
  results: T | null
  /** Whether a search request is in flight. */
  isSearching: boolean
  /** Error from the last search, if any. */
  error: string | null
  /** Clear query, results, and error. */
  clear: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Debounced search hook.
 *
 * - Waits for the user to stop typing (configurable delay)
 * - Cancels in-flight requests when the query changes
 * - Manages loading and error states
 */
export function useDebouncedSearch<T>({
  searchFn,
  delay = 300,
  minLength = 1,
}: UseDebouncedSearchOptions<T>): UseDebouncedSearchResult<T> {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<T | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Cancel previous request
    abortRef.current?.abort()

    if (query.length < minLength) {
      setResults(null)
      setIsSearching(false)
      setError(null)
      return
    }

    const timer = setTimeout(() => {
      const controller = new AbortController()
      abortRef.current = controller

      setIsSearching(true)
      setError(null)

      searchFn(query, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) {
            setResults(data)
          }
        })
        .catch((err) => {
          if (controller.signal.aborted) return
          setError(err instanceof Error ? err.message : 'Search failed')
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSearching(false)
          }
        })
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [query, delay, minLength, searchFn])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const clear = useCallback(() => {
    abortRef.current?.abort()
    setQuery('')
    setResults(null)
    setError(null)
    setIsSearching(false)
  }, [])

  return { query, setQuery, results, isSearching, error, clear }
}

export default useDebouncedSearch
