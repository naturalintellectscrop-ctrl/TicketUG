// Safe internal-redirect validation for ?next= style parameters.
// Only same-origin absolute paths are allowed — no protocol-relative ('//'),
// no scheme links ('https://…'), no control characters — so a crafted
// sign-in link can never bounce a user off-site after authentication.

export function isSafeInternalPath(path: unknown): path is string {
  if (typeof path !== 'string') return false
  if (path.length === 0 || path.length > 512) return false
  if (!path.startsWith('/')) return false
  if (path.startsWith('//') || path.startsWith('/\\')) return false
  if (/[\r\n\t]/.test(path)) return false
  return true
}

// Returns a validated internal path or the fallback. Convenience for pages.
export function safeInternalPath(path: unknown, fallback: string): string {
  return isSafeInternalPath(path) ? path : fallback
}
