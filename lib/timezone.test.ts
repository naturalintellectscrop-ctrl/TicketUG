import { describe, expect, it } from 'vitest'
import { utcToWallTime, wallTimeToUtcIso } from './timezone'

describe('wallTimeToUtcIso', () => {
  it('converts Kampala wall time (fixed UTC+3, no DST)', () => {
    expect(wallTimeToUtcIso('2026-06-01T18:00', 'Africa/Kampala')).toBe('2026-06-01T15:00:00.000Z')
    expect(wallTimeToUtcIso('2026-12-31T23:30', 'Africa/Kampala')).toBe('2026-12-31T20:30:00.000Z')
  })

  it('resolves summer time correctly in a DST zone (London, UTC+1 in July)', () => {
    expect(wallTimeToUtcIso('2026-07-01T12:00', 'Europe/London')).toBe('2026-07-01T11:00:00.000Z')
    expect(wallTimeToUtcIso('2026-01-15T12:00', 'Europe/London')).toBe('2026-01-15T12:00:00.000Z')
  })

  it('handles a half-hour offset zone', () => {
    expect(wallTimeToUtcIso('2026-03-10T09:00', 'Asia/Kolkata')).toBe('2026-03-10T03:30:00.000Z')
  })

  it('rejects malformed wall times and unknown zones (never guesses)', () => {
    expect(wallTimeToUtcIso('2026-06-01 18:00', 'Africa/Kampala')).toBeNull()
    expect(wallTimeToUtcIso('2026-06-01T18:00', 'Mars/Olympus')).toBeNull()
    expect(wallTimeToUtcIso('not-a-date', 'Africa/Kampala')).toBeNull()
  })
})

describe('utcToWallTime', () => {
  it('renders the wall time an input[type=datetime-local] needs', () => {
    expect(utcToWallTime('2026-06-01T15:00:00.000Z', 'Africa/Kampala')).toBe('2026-06-01T18:00')
    expect(utcToWallTime(new Date('2026-07-01T11:00:00.000Z'), 'Europe/London')).toBe('2026-07-01T12:00')
  })

  it('degrades to an empty string on invalid input (form defaults stay empty, not garbage)', () => {
    expect(utcToWallTime('not-a-date', 'Africa/Kampala')).toBe('')
    expect(utcToWallTime('2026-06-01T15:00:00Z', 'Mars/Olympus')).toBe('')
  })
})
