import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search,
  X,
  Truck,
  Users,
  Building2,
  Loader2,
  Clock,
  ArrowRight,
} from 'lucide-react'
import { useDebouncedSearch } from '../hooks/useDebouncedSearch'

// ---------------------------------------------------------------------------
// Local API helpers (per requirement: do not import from api.ts)
// ---------------------------------------------------------------------------

import { httpErrorMessage } from '../utils/httpErrors'

const SEARCH_API = import.meta.env.VITE_API_URL || ''

async function searchRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${SEARCH_API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || httpErrorMessage(response.status))
  }
  return response.json()
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResultItem {
  id: string
  type: 'shipment' | 'customer' | 'carrier'
  title: string
  subtitle: string
  score: number
}

interface SearchResponse {
  results: SearchResultItem[]
  total: number
  next_cursor?: string | null
  query: string
  entity_type: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECENT_SEARCHES_KEY = 'tms-recent-searches'
const MAX_RECENT = 8

const TYPE_ICON: Record<string, typeof Truck> = {
  shipment: Truck,
  customer: Users,
  carrier: Building2,
}

const TYPE_LABEL: Record<string, string> = {
  shipment: 'Shipment',
  customer: 'Customer',
  carrier: 'Carrier',
}

const TYPE_COLOR: Record<string, string> = {
  shipment: 'text-blue-600 bg-blue-50',
  customer: 'text-green-600 bg-green-50',
  carrier: 'text-purple-600 bg-purple-50',
}

// ---------------------------------------------------------------------------
// Recent searches helpers
// ---------------------------------------------------------------------------

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function addRecentSearch(query: string) {
  const recent = getRecentSearches().filter((s) => s !== query)
  recent.unshift(query)
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT)),
  )
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Grouped results
  const [groupedResults, setGroupedResults] = useState<
    Record<string, SearchResultItem[]>
  >({})

  const searchFn = useCallback(
    async (q: string, signal: AbortSignal) => {
      const res = await searchRequest<SearchResponse>(
        `/api/v1/search?q=${encodeURIComponent(q)}&type=all&limit=30`,
        { signal },
      )
      return res
    },
    [],
  )

  const { query, setQuery, results, isSearching, error, clear } =
    useDebouncedSearch<SearchResponse>({
      searchFn,
      delay: 250,
      minLength: 2,
    })

  // Group results by type when they change
  useEffect(() => {
    if (!results) {
      setGroupedResults({})
      return
    }
    const grouped: Record<string, SearchResultItem[]> = {}
    for (const item of results.results) {
      if (!grouped[item.type]) grouped[item.type] = []
      grouped[item.type].push(item)
    }
    setGroupedResults(grouped)
  }, [results])

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setRecentSearches(getRecentSearches())
    } else {
      clear()
    }
  }, [isOpen, clear])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const handleSelectResult = useCallback(
    (item: SearchResultItem) => {
      addRecentSearch(query)
      setIsOpen(false)

      // Navigate based on type
      const paths: Record<string, string> = {
        shipment: `/shipments/${item.id}`,
        customer: `/customers/${item.id}`,
        carrier: `/carriers/${item.id}`,
      }
      const path = paths[item.type]
      if (path) {
        window.location.href = path
      }
    },
    [query],
  )

  const handleRecentClick = useCallback(
    (term: string) => {
      setQuery(term)
    },
    [setQuery],
  )

  const handleClearRecent = useCallback(() => {
    clearRecentSearches()
    setRecentSearches([])
  }, [])

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span>Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-mono bg-gray-200 rounded">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm">
      <div
        ref={panelRef}
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shipments, customers, carriers..."
            className="flex-1 text-base outline-none placeholder:text-gray-400"
          />
          {isSearching && <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1 rounded hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Results area */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Error */}
          {error && (
            <div className="px-4 py-8 text-center text-sm text-red-500">
              {error}
            </div>
          )}

          {/* Empty state after search */}
          {!error && query.length >= 2 && results && results.results.length === 0 && !isSearching && (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Grouped results */}
          {Object.entries(groupedResults).map(([type, items]) => {
            const Icon = TYPE_ICON[type] ?? Truck
            return (
              <div key={type}>
                <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  {TYPE_LABEL[type] ?? type}s ({items.length})
                </div>
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectResult(item)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${TYPE_COLOR[item.type] ?? 'text-gray-600 bg-gray-50'}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {item.subtitle}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
            )
          })}

          {/* Recent searches (shown when no active search) */}
          {query.length < 2 && recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recent Searches
                </span>
                <button
                  type="button"
                  onClick={handleClearRecent}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handleRecentClick(term)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-700">{term}</span>
                </button>
              ))}
            </div>
          )}

          {/* Empty state with no recent searches */}
          {query.length < 2 && recentSearches.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              Type to search across shipments, customers, and carriers.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-500">Esc</kbd>
              to close
            </span>
          </div>
          {results && (
            <span>{results.total} result{results.total !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  )
}
