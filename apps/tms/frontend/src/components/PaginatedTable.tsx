import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Loader2,
  AlertCircle,
  Inbox,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Column<T> {
  /** Unique key for the column (should match a field on T or be arbitrary). */
  key: string
  /** Display header text. */
  header: string
  /** Render cell content. Falls back to `row[key]`. */
  render?: (row: T) => ReactNode
  /** Whether this column is sortable server-side. */
  sortable?: boolean
  /** Minimum width in pixels. */
  minWidth?: number
  /** Default width in pixels. */
  width?: number
}

export interface FetchParams {
  page: number
  pageSize: number
  sortField?: string
  sortDirection?: 'asc' | 'desc'
  search?: string
}

export interface FetchResult<T> {
  data: T[]
  total: number
}

interface PaginatedTableProps<T> {
  /** Column definitions. */
  columns: Column<T>[]
  /** Async function that fetches a page of data. */
  fetchData: (params: FetchParams) => Promise<FetchResult<T>>
  /** Rows per page. Default: 25. */
  pageSize?: number
  /** Unique key extractor for each row. */
  rowKey: (row: T) => string
  /** Show the search bar. Default: true. */
  searchable?: boolean
  /** Placeholder text for the search input. */
  searchPlaceholder?: string
  /** Extra CSS class on the wrapper div. */
  className?: string
  /** Render a custom empty-state message. */
  emptyMessage?: string
  /** Allow column resizing via drag. Default: true. */
  resizable?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Reusable server-side paginated table with sort, search, and column resize.
 */
export function PaginatedTable<T>({
  columns,
  fetchData,
  pageSize = 25,
  rowKey,
  searchable = true,
  searchPlaceholder = 'Search...',
  className = '',
  emptyMessage = 'No results found.',
  resizable = true,
}: PaginatedTableProps<T>) {
  // ── State ────────────────────────────────────────────────────────────
  const [data, setData] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<string | undefined>()
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const col of columns) {
      init[col.key] = col.width ?? col.minWidth ?? 120
    }
    return init
  })

  const fetchIdRef = useRef(0)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch data whenever deps change
  useEffect(() => {
    const id = ++fetchIdRef.current
    setLoading(true)
    setError(null)

    fetchData({
      page,
      pageSize,
      sortField,
      sortDirection,
      search: debouncedSearch || undefined,
    })
      .then((res) => {
        // Discard stale responses
        if (id !== fetchIdRef.current) return
        setData(res.data)
        setTotal(res.total)
      })
      .catch((err) => {
        if (id !== fetchIdRef.current) return
        setError(err instanceof Error ? err.message : 'Failed to load data')
      })
      .finally(() => {
        if (id !== fetchIdRef.current) return
        setLoading(false)
      })
  }, [page, pageSize, sortField, sortDirection, debouncedSearch, fetchData])

  // ── Derived ──────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleSort = useCallback(
    (key: string) => {
      if (sortField === key) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField(key)
        setSortDirection('asc')
      }
      setPage(1)
    },
    [sortField],
  )

  // Column resize via mouse drag
  const handleResizeStart = useCallback(
    (colKey: string, startX: number) => {
      const startWidth = colWidths[colKey] ?? 120

      const onMove = (e: MouseEvent) => {
        const delta = e.clientX - startX
        setColWidths((prev) => ({
          ...prev,
          [colKey]: Math.max(60, startWidth + delta),
        }))
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [colWidths],
  )

  const sortIcon = (key: string) => {
    if (sortField !== key)
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
    )
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Search bar */}
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="relative px-4 py-3 font-medium text-gray-700 select-none whitespace-nowrap"
                  style={{ width: colWidths[col.key], minWidth: col.minWidth ?? 60 }}
                >
                  <div className="flex items-center gap-1">
                    {col.sortable ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-blue-600"
                        onClick={() => handleSort(col.key)}
                      >
                        {col.header}
                        {sortIcon(col.key)}
                      </button>
                    ) : (
                      col.header
                    )}
                  </div>

                  {/* Resize handle */}
                  {resizable && (
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleResizeStart(col.key, e.clientX)
                      }}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {/* Loading overlay */}
            {loading && data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Loading...</span>
                  </div>
                </td>
              </tr>
            )}

            {/* Error state */}
            {error && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-red-500">
                    <AlertCircle className="w-6 h-6" />
                    <span>{error}</span>
                    <button
                      type="button"
                      className="mt-1 text-sm text-blue-600 hover:underline"
                      onClick={() => {
                        setError(null)
                        setPage(page)
                      }}
                    >
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty state */}
            {!loading && !error && data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Inbox className="w-6 h-6" />
                    <span>{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            )}

            {/* Data rows */}
            {data.map((row) => (
              <tr
                key={rowKey(row)}
                className="hover:bg-gray-50 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-4 py-3 text-gray-900"
                    style={{ width: colWidths[col.key], minWidth: col.minWidth ?? 60 }}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Loading bar at top when refetching */}
        {loading && data.length > 0 && (
          <div className="h-0.5 bg-blue-500 animate-pulse" />
        )}
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {Math.min((page - 1) * pageSize + 1, total)}
          {' - '}
          {Math.min(page * pageSize, total)} of {total}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(1)}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 py-1">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(totalPages)}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default PaginatedTable
