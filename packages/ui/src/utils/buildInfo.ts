/**
 * Format a build timestamp for display in the sidebar.
 * Expects YYMMDD.HHMMSS format (e.g., "260207.143022") from the build pipeline.
 * Returns the value as-is since it's already human-readable.
 */
export function formatBuildTimestamp(timestamp: string | undefined): string | null {
  if (!timestamp) return null
  return timestamp
}
