import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'

/**
 * Props for the VirtualList component.
 *
 * @typeParam T - The type of each item in the list.
 */
interface VirtualListProps<T> {
  /** Full array of items (only the visible slice is rendered). */
  items: T[]
  /** Estimated height of each item in pixels (used for positioning). */
  itemHeight: number
  /** Render function for a single item. */
  renderItem: (item: T, index: number) => ReactNode
  /** Fired when the user scrolls near the bottom. Useful for infinite loading. */
  onEndReached?: () => void
  /** Pixel threshold before the end to fire `onEndReached`. Default: 200 */
  endReachedThreshold?: number
  /** Height of the scrollable container. Default: 600 */
  containerHeight?: number
  /** Extra items rendered above/below the visible window. Default: 5 */
  overscan?: number
  /** CSS class for the outer container. */
  className?: string
}

/**
 * Reusable virtual-scrolling list.
 *
 * Renders only the items currently visible in the viewport (plus an
 * overscan buffer) for efficient rendering of large datasets.
 */
export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  onEndReached,
  endReachedThreshold = 200,
  containerHeight = 600,
  overscan = 5,
  className = '',
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const endReachedCalledRef = useRef(false)

  // Total scrollable height
  const totalHeight = items.length * itemHeight

  // Visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const visibleCount = Math.ceil(containerHeight / itemHeight) + 2 * overscan
  const endIndex = Math.min(items.length, startIndex + visibleCount)

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    setScrollTop(el.scrollTop)

    // End-reached detection
    if (onEndReached) {
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
      if (remaining < endReachedThreshold) {
        if (!endReachedCalledRef.current) {
          endReachedCalledRef.current = true
          onEndReached()
        }
      } else {
        endReachedCalledRef.current = false
      }
    }
  }, [onEndReached, endReachedThreshold])

  // Reset end-reached flag when items change
  useEffect(() => {
    endReachedCalledRef.current = false
  }, [items.length])

  // Sentinel-based IntersectionObserver for an alternative end detection
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!onEndReached || !sentinelRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onEndReached()
        }
      },
      { root: containerRef.current, rootMargin: `${endReachedThreshold}px` },
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [onEndReached, endReachedThreshold])

  const visibleItems = items.slice(startIndex, endIndex)
  const offsetY = startIndex * itemHeight

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight, position: 'relative' }}
    >
      {/* Spacer to maintain correct scrollbar size */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Translated container holding only visible items */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${offsetY}px)`,
          }}
        >
          {visibleItems.map((item, i) => (
            <div
              key={startIndex + i}
              style={{ height: itemHeight, overflow: 'hidden' }}
            >
              {renderItem(item, startIndex + i)}
            </div>
          ))}
        </div>

        {/* Sentinel at the bottom for IntersectionObserver */}
        <div
          ref={sentinelRef}
          style={{ position: 'absolute', bottom: 0, height: 1, width: '100%' }}
        />
      </div>
    </div>
  )
}

export default VirtualList
