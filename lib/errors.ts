export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  const s = String(err)
  return s && s !== '[object Object]' ? s : 'Something went wrong. Please try again.'
}
