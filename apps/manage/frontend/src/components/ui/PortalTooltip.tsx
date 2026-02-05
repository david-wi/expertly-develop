import { useState, useRef, useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface PortalTooltipProps {
  children: ReactNode
  content: ReactNode
  className?: string
}

export function PortalTooltip({ children, content, className = '' }: PortalTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, alignRight: false })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2

      // Check if tooltip would overflow right edge (estimate 300px max width)
      const estimatedTooltipWidth = 300
      const wouldOverflowRight = centerX + estimatedTooltipWidth / 2 > window.innerWidth - 8

      if (wouldOverflowRight) {
        // Align to right edge of trigger
        setPosition({
          top: rect.bottom + 8,
          left: rect.right,
          alignRight: true,
        })
      } else {
        // Center horizontally as before
        setPosition({
          top: rect.bottom + 8,
          left: centerX,
          alignRight: false,
        })
      }
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
            ref={tooltipRef}
            className={`fixed z-[9999] px-3 py-2 bg-gray-900 text-white text-xs rounded-lg pointer-events-none whitespace-nowrap ${
              position.alignRight ? '-translate-x-full' : '-translate-x-1/2'
            }`}
            style={{
              top: position.top,
              left: position.left,
            }}
          >
            {/* Arrow pointing up */}
            <div className={`absolute bottom-full border-4 border-transparent border-b-gray-900 ${
              position.alignRight ? 'right-3' : 'left-1/2 -translate-x-1/2'
            }`} />
            {content}
          </div>,
          document.body
        )}
    </>
  )
}
