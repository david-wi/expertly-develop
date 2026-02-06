import { useState, useRef, useCallback, useEffect } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Page<T> {
  data: T[]
  nextCursor?: string | null
}

interface UseInfiniteQueryOptions<T> {
  /**
   * Async fetcher. Receives the current cursor (null on first page) and
   * should return a `Page<T>` with the data and an optional next cursor.
   */
  fetcher: (cursor: string | null) => Promise<Page<T>>
  /** Unique key to reset state when it changes (e.g., a search query). */
  queryKey?: string
  /** Stale time in ms before re-fetching. Default: 30_000 (30 s). */
  staleTime?: number
  /** Whether to start fetching immediately. Default: true. */
  enabled?: boolean
}

interface UseInfiniteQueryResult<T> {
  /** All loaded items across every page. */
  data: T[]
  /** Whether the initial fetch is in progress. */
  isLoading: boolean
  /** Whether a subsequent page is being fetched. */
  isFetchingMore: boolean
  /** Error message from the most recent fetch, if any. */
  error: string | null
  /** True when more pages are available. */
  hasMore: boolean
  /** Call to request the next page. Safe to call repeatedly (deduplicated). */
  fetchMore: () => void
  /** Reset and refetch from the beginning. */
  refetch: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Custom hook for cursor-based infinite loading.
 *
 * Features:
 * - Cursor-based pagination
 * - Automatic deduplication of concurrent requests
 * - Stale-while-revalidate caching by `queryKey`
 * - Auto-resets when `queryKey` changes
 */
export function useInfiniteQuery<T>({
  fetcher,
  queryKey = '',
  staleTime = 30_000,
  enabled = true,
}: UseInfiniteQueryOptions<T>): UseInfiniteQueryResult<T> {
  const [data, setData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const cursorRef = useRef<string | null>(null)
  const inFlightRef = useRef(false)
  const cacheRef = useRef<Map<string, { data: T[]; cursor: string | null; hasMore: boolean; ts: number }>>(new Map())
  const queryKeyRef = useRef(queryKey)

  // Reset on queryKey change
  useEffect(() => {
    if (queryKeyRef.current !== queryKey) {
      queryKeyRef.current = queryKey
      cursorRef.current = null
      setData([])
      setHasMore(true)
      setError(null)

      // Check cache
      const cached = cacheRef.current.get(queryKey)
      if (cached && Date.now() - cached.ts < staleTime) {
        setData(cached.data)
        cursorRef.current = cached.cursor
        setHasMore(cached.hasMore)
        return
      }
    }
  }, [queryKey, staleTime])

  const fetchPage = useCallback(
    async (isInitial: boolean) => {
      if (inFlightRef.current) return
      if (!isInitial && !hasMore) return

      inFlightRef.current = true
      if (isInitial) {
        setIsLoading(true)
      } else {
        setIsFetchingMore(true)
      }
      setError(null)

      try {
        const result = await fetcher(isInitial ? null : cursorRef.current)

        setData((prev) => (isInitial ? result.data : [...prev, ...result.data]))
        cursorRef.current = result.nextCursor ?? null
        const moreAvailable = !!result.nextCursor && result.data.length > 0
        setHasMore(moreAvailable)

        // Update cache
        setData((current) => {
          cacheRef.current.set(queryKeyRef.current, {
            data: current,
            cursor: cursorRef.current,
            hasMore: moreAvailable,
            ts: Date.now(),
          })
          return current
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch')
      } finally {
        inFlightRef.current = false
        setIsLoading(false)
        setIsFetchingMore(false)
      }
    },
    [fetcher, hasMore],
  )

  // Initial fetch
  useEffect(() => {
    if (!enabled) return
    fetchPage(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, enabled])

  const fetchMore = useCallback(() => {
    fetchPage(false)
  }, [fetchPage])

  const refetch = useCallback(() => {
    cursorRef.current = null
    setHasMore(true)
    cacheRef.current.delete(queryKeyRef.current)
    fetchPage(true)
  }, [fetchPage])

  return { data, isLoading, isFetchingMore, error, hasMore, fetchMore, refetch }
}

export default useInfiniteQuery
