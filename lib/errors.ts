export function errorMessage(err: unknown): string {
  if (isOfflineError(err)) return "You're offline. Check your connection and try again."
  if (err instanceof Error && err.message) return err.message
  const s = String(err)
  return s && s !== '[object Object]' ? s : 'Something went wrong. Please try again.'
}

export function isOfflineError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code
  return code === 'unavailable' || code === 'failed-precondition'
}
