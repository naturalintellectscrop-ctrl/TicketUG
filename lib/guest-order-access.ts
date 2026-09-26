// Guest order access-key helpers.
//
// A guest order's only credential is its access token (sha256-hashed at rest
// as ticketug.order.guest_access_token_hash). The token is issued once at
// creation, kept in the creating tab's sessionStorage, and — since the
// recovery feature — may also travel in a recovery link (?key=…) that the
// order status page adopts into sessionStorage and then strips from the URL.

export const GUEST_ORDER_KEY_QUERY = 'key'

export function guestTokenStorageKey(publicId: string) { return `ticketug:guest-token:${publicId}` }

// Recovery link: opens the order status page with the key in the query string.
// The status page adopts the key into sessionStorage and immediately rewrites
// the URL clean, so the token never persists in the address bar or history.
export function buildRecoveryPath(publicId: string, token: string) { return `/guest/orders/${publicId}?${GUEST_ORDER_KEY_QUERY}=${encodeURIComponent(token)}` }

// Extracts a recovery key from a query string ('' or '?key=…' form).
export function recoveryKeyFromSearch(search: string) {
  try {
    const value = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(GUEST_ORDER_KEY_QUERY)
    return value && value.length > 0 ? value : null
  } catch { return null }
}
