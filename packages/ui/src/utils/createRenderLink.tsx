import type { ReactNode } from 'react'

export interface RenderLinkProps {
  href: string
  className: string
  children: ReactNode
  onClick?: () => void
}

/**
 * Creates a renderLink function for use with Sidebar and UserMenu components.
 * Uses native <a> tags with href attributes to ensure right-click "Open in New Tab" works.
 *
 * @param navigate - Router navigation function (e.g., from useNavigate())
 * @returns A renderLink function that renders accessible links with SPA navigation
 *
 * @example
 * ```tsx
 * import { useNavigate } from 'react-router-dom'
 * import { createRenderLink } from '@expertly/ui'
 *
 * function Layout() {
 *   const navigate = useNavigate()
 *   return (
 *     <Sidebar
 *       renderLink={createRenderLink(navigate)}
 *       ...
 *     />
 *   )
 * }
 * ```
 */
export function createRenderLink(navigate: (path: string) => void) {
  return ({ href, className, children, onClick }: RenderLinkProps) => (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        // Call the onClick handler first (e.g., close menu)
        onClick?.()

        // Allow modifier keys and right-click to work naturally
        // Only intercept normal left-clicks for SPA navigation
        if (
          e.button === 0 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey
        ) {
          e.preventDefault()
          navigate(href)
        }
      }}
    >
      {children}
    </a>
  )
}
