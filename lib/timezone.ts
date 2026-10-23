/**
 * Timezone wall-time ↔ UTC conversion via Intl only (no date library).
 *
 * Why: the event editor collects schedule fields as `datetime-local` values
 * that mean "wall time at the event's venue" (event.timezone), while the API
 * contract and the database are UTC (`timestamptz`). `new Date('2026-…T18:00')`
 * in a browser would use the BROWSER's timezone — wrong whenever the buyer's
 * laptop is not in the venue timezone.
 *
 * Pure and isomorphic: used server-side (defaults for the edit form) and
 * client-side (submitting the form). The two-pass offset resolution handles
 * DST boundaries; Uganda itself has no DST (Africa/Kampala is fixed UTC+3).
 */

const WALL_SHAPE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

/** Offset (ms) of `timezone` at the given instant. */
function zoneOffsetMs(instant: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instant))
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return asUtc - instant
}

/** "YYYY-MM-DDTHH:mm" wall time in `timezone` → UTC ISO string, or null on
 * malformed input / unknown timezone. Two passes pin the offset on the
 * correct side of a DST boundary. */
export function wallTimeToUtcIso(wall: string, timezone: string): string | null {
  if (!WALL_SHAPE.test(wall) || !isValidTimeZone(timezone)) return null
  const asUtc = Date.parse(`${wall}:00Z`)
  if (Number.isNaN(asUtc)) return null
  const firstPass = asUtc - zoneOffsetMs(asUtc, timezone)
  const secondPass = asUtc - zoneOffsetMs(firstPass, timezone)
  return new Date(secondPass).toISOString()
}

/** UTC instant (ISO string or Date) → "YYYY-MM-DDTHH:mm" wall time in
 * `timezone`, for `<input type="datetime-local">` defaults. Returns an empty
 * string for invalid inputs so form defaults degrade to empty, not garbage. */
export function utcToWallTime(value: string | Date, timezone: string): string {
  const instant = value instanceof Date ? value.getTime() : Date.parse(value)
  if (Number.isNaN(instant) || !isValidTimeZone(timezone)) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(instant))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  const hour = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}
