/**
 * Format a Unix timestamp as M.DD.HH.MM (e.g., "1.26.14.34" for Jan 26 at 14:34)
 * Used to display build timestamps in the sidebar
 */
export function formatBuildTimestamp(timestamp: string | undefined): string | null {
  if (!timestamp) return null
  try {
    const date = new Date(parseInt(timestamp) * 1000)
    if (isNaN(date.getTime())) return null
    const month = date.getMonth() + 1
    const day = date.getDate().toString().padStart(2, '0')
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    return `${month}.${day}.${hour}.${minute}`
  } catch {
    return null
  }
}

/**
 * React component for displaying build timestamp in sidebar
 * Use with Sidebar's buildInfo prop
 */
export function BuildTimestamp({ timestamp }: { timestamp: string | undefined }) {
  const formatted = formatBuildTimestamp(timestamp)
  if (!formatted) return null
  return (
    <span className="text-[10px] text-gray-400 block text-right">{formatted}</span>
  )
}
