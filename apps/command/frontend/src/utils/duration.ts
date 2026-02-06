// Format seconds to H:MM display (e.g., 600 -> "0:10" for 10 minutes)
export function formatDuration(seconds: number | undefined): string {
  if (!seconds) return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}:${minutes.toString().padStart(2, '0')}`
}

// Parse H:MM or M:SS string to seconds (e.g., "0:10" -> 600 for 10 minutes)
export function parseDuration(value: string): number | null {
  if (!value.trim()) return null
  const parts = value.split(':')
  if (parts.length === 2) {
    const hours = parseInt(parts[0], 10) || 0
    const minutes = parseInt(parts[1], 10) || 0
    return hours * 3600 + minutes * 60
  }
  // If just a number, treat as minutes
  const mins = parseInt(value, 10)
  if (!isNaN(mins)) return mins * 60
  return null
}
