import { describe, expect, it } from 'vitest'
import { buildEventIcs, icsStamp } from './ics'

describe('ics calendar builder', () => {
  const base = { uid: 'tkt_1@ticketug.ug', title: 'Launch Night — VIP', startsAt: '2026-10-01T18:00:00.000Z', endsAt: '2026-10-01T23:00:00.000Z' }

  it('formats UTC DATE-TIME stamps', () => {
    expect(icsStamp('2026-10-01T18:00:00.000Z')).toBe('20261001T180000Z')
    expect(icsStamp('2026-01-02T03:04:05.678Z')).toBe('20260102T030405Z')
  })

  it('rejects invalid dates', () => {
    expect(() => icsStamp('not-a-date')).toThrow()
  })

  it('builds a complete VCALENDAR with CRLF endings', () => {
    const ics = buildEventIcs({ ...base, location: 'Serena Gardens, Kampala', description: 'Ticket tkt_1' })
    const lines = ics.split('\r\n')
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('VERSION:2.0')
    expect(lines).toContain('UID:tkt_1@ticketug.ug')
    expect(lines).toContain('DTSTART:20261001T180000Z')
    expect(lines).toContain('DTEND:20261001T230000Z')
    expect(lines).toContain('LOCATION:Serena Gardens\\, Kampala')
    expect(lines[lines.length - 2]).toBe('END:VCALENDAR')
    expect(lines[lines.length - 1]).toBe('')
    expect(ics.endsWith('\r\n')).toBe(true)
  })

  it('escapes RFC 5545 special characters in text values', () => {
    const ics = buildEventIcs({ ...base, title: 'Back\\slash, semi;colon\nnewline' })
    expect(ics).toContain('SUMMARY:Back\\\\slash\\, semi\\;colon\\nnewline')
  })

  it('omits optional properties when absent', () => {
    const ics = buildEventIcs(base)
    expect(ics).not.toContain('LOCATION:')
    expect(ics).not.toContain('DESCRIPTION:')
  })

  it('requires uid and title', () => {
    expect(() => buildEventIcs({ ...base, uid: '' })).toThrow()
    expect(() => buildEventIcs({ ...base, title: '' })).toThrow()
  })
})
