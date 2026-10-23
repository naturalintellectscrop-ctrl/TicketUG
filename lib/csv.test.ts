import { describe, expect, it } from 'vitest'
import { csvFileName, escapeCsvField, toCsv } from './csv'

describe('escapeCsvField', () => {
  it('leaves plain text untouched', () => {
    expect(escapeCsvField('General admission')).toBe('General admission')
    expect(escapeCsvField('')).toBe('')
    expect(escapeCsvField(null)).toBe('')
    expect(escapeCsvField(undefined)).toBe('')
  })

  it('quotes fields containing commas, quotes and newlines', () => {
    expect(escapeCsvField('Roast, Rhymes & Routes')).toBe('"Roast, Rhymes & Routes"')
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
    expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"')
  })

  it('prefixes spreadsheet formula triggers with an apostrophe', () => {
    expect(escapeCsvField('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)")
    expect(escapeCsvField('+1+2')).toBe("'+1+2")
    expect(escapeCsvField('@import')).toBe("'@import")
    expect(escapeCsvField('\tcmd')).toBe("'\tcmd")
    // CR-prefixed: apostrophe lands first (formula guard), then RFC quoting
    // wraps the embedded CR — on import the cell starts with ' so it is text.
    expect(escapeCsvField('\r=cmd')).toBe('"\'\r=cmd"')
    expect(escapeCsvField('-notANumber')).toBe("'-notANumber")
  })

  it('keeps plain decimal numbers intact (negative totals are data, not formulas)', () => {
    expect(escapeCsvField('-5')).toBe('-5')
    expect(escapeCsvField('-1250000.50')).toBe('-1250000.50')
    expect(escapeCsvField('1250000')).toBe('1250000')
  })

  it('does not double-prefix already-quoted content', () => {
    // A quote-leading cell is data (e.g. a note that begins with ") — quoting
    // rules apply, the formula guard does not ( " is not a formula trigger).
    expect(escapeCsvField('"quoted note"')).toBe('"""quoted note"""')
  })
})

describe('toCsv', () => {
  it('writes CRLF line endings and a trailing CRLF', () => {
    const csv = toCsv(['Order', 'Total'], [['o-1', 5000], ['o,2', 250]])
    expect(csv).toBe('Order,Total\r\no-1,5000\r\n"o,2",250\r\n')
  })

  it('emits a header-only document when there are no rows', () => {
    expect(toCsv(['A', 'B'], [])).toBe('A,B\r\n')
  })
})

describe('csvFileName', () => {
  it('stamps the date and sanitizes the report id', () => {
    expect(csvFileName('sales-by-event', new Date('2026-10-11T09:30:00Z'))).toBe('ticketug-sales-by-event-20261011.csv')
    expect(csvFileName('Weird Report ID!', new Date('2026-01-02T00:00:00Z'))).toBe('ticketug-weird-report-id-20260102.csv')
  })
})
