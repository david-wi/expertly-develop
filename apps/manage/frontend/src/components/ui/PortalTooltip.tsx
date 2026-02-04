import { useState, useRef, useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface PortalTooltipProps {
  children: ReactNode
  content: ReactNode
  className?: string
}

export function PortalTooltip({ children, content, className = '' }: PortalTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      // Position below the trigger element, centered horizontally
      setPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      })
    }
  }, [isVisible])

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className={className}
      >
        {children}
      </div>
      {isVisible &&
        createPortal(
          <div
            className="fixed z-[9999] px-3 py-2 bg-gray-900 text-white text-xs rounded-lg pointer-events-none whitespace-nowrap -translate-x-1/2"
            style={{
              top: position.top,
              left: position.left,
            }}
          >
            {/* Arrow pointing up */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
            {content}
          </div>,
          document.body
        )}
    </>
  )
}
