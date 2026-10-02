import { describe, expect, it } from 'vitest'
import { parseV1Pagination, V1Error } from './http'

function params(input: Record<string, string>): URLSearchParams {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) search.set(key, value)
  return search
}

describe('parseV1Pagination', () => {
  it('defaults to 25/0 when params are absent', () => {
    expect(parseV1Pagination(new URLSearchParams())).toEqual({ limit: 25, offset: 0 })
  })

  it('accepts valid explicit values including the 100 cap', () => {
    expect(parseV1Pagination(params({ limit: '100', offset: '250' }))).toEqual({ limit: 100, offset: 250 })
    expect(parseV1Pagination(params({ limit: '1', offset: '0' }))).toEqual({ limit: 1, offset: 0 })
  })

  it('rejects non-numeric, zero-limit, over-cap and negative values with 400', () => {
    for (const bad of [params({ limit: 'abc' }), params({ limit: '0' }), params({ limit: '101' }), params({ offset: '-1' }), params({ offset: '1.5' })]) {
      let caught: unknown
      try {
        parseV1Pagination(bad)
      } catch (error) {
        caught = error
      }
      expect(caught).toBeInstanceOf(V1Error)
      expect((caught as V1Error).status).toBe(400)
      expect((caught as V1Error).code).toBe('INVALID_PAGINATION')
    }
  })
})
