// Minimal RFC 5545 (iCalendar) VEVENT builder — client-usable, zero deps.
// Used by guest ticket pages for "Add to calendar" downloads.

function icsEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

// RFC 5545 DATE-TIME in UTC: YYYYMMDDTHHMMSSZ
export function icsStamp(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid calendar date: ${iso}`)
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export type CalendarEvent = { uid: string; title: string; startsAt: string; endsAt: string; location?: string | null; description?: string | null }

export function buildEventIcs(event: CalendarEvent) {
  if (!event.uid) throw new Error('Calendar event requires a uid')
  if (!event.title) throw new Error('Calendar event requires a title')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TicketUG//Natural Intellects Ltd//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${icsEscape(event.uid)}`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(event.startsAt)}`,
    `DTEND:${icsStamp(event.endsAt)}`,
    `SUMMARY:${icsEscape(event.title)}`,
  ]
  if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`)
  if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  // RFC 5545 requires CRLF line breaks and a final CRLF.
  return `${lines.join('\r\n')}\r\n`
}
