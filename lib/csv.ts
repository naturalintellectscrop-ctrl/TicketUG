/**
 * Minimal RFC 4180 CSV writer with spreadsheet formula-injection defense.
 *
 * Pure (no I/O) so it stays unit-testable; used by the organizer report
 * export route. Every field goes through BOTH layers:
 *   1. Injection guard — a cell that a spreadsheet would evaluate as a
 *      formula (=, +, -, @, tab, CR prefixes) gets a leading apostrophe,
 *      EXCEPT plain decimal numbers (a "-5" total is data, not a formula).
 *   2. RFC 4180 quoting — cells containing quotes, commas, CR or LF are
 *      wrapped in double quotes with embedded quotes doubled. Lines end
 *      with CRLF per the spec.
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/

export function escapeCsvField(value: unknown): string {
  let cell = value === null || value === undefined ? '' : String(value)
  if (FORMULA_PREFIX.test(cell) && !PLAIN_NUMBER.test(cell)) {
    cell = `'${cell}`
  }
  if (/[",\r\n]/.test(cell)) {
    cell = `"${cell.replaceAll('"', '""')}"`
  }
  return cell
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(escapeCsvField).join(',')]
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(','))
  }
  return `${lines.join('\r\n')}\r\n`
}

/** Safe filename segment for Content-Disposition (report ids are ours). */
export function csvFileName(report: string, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10).replaceAll('-', '')
  const safe = report.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '')
  return `ticketug-${safe}-${stamp}.csv`
}
