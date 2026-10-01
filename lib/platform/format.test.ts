import { describe, expect, it } from 'vitest'
import { buildFilterQuery, clampPage, formatMoney, labelOf, pageOffset } from './format'

describe('formatMoney', () => {
  it('renders whole UGX amounts with en-UG grouping', () => {
    expect(formatMoney(1250000)).toBe('1,250,000 UGX')
    expect(formatMoney(0)).toBe('0 UGX')
  })

  it('honours an explicit currency and treats null as zero', () => {
    expect(formatMoney(50, 'USD')).toBe('50 USD')
    expect(formatMoney(null as unknown as number)).toBe('0 UGX')
  })
})

describe('clampPage', () => {
  it('floors invalid and non-positive pages to 1', () => {
    expect(clampPage(null, 100, 25)).toBe(1)
    expect(clampPage(0, 100, 25)).toBe(1)
    expect(clampPage(-3, 100, 25)).toBe(1)
    expect(clampPage(Number.NaN, 100, 25)).toBe(1)
  })

  it('caps the page at the last page that holds rows', () => {
    expect(clampPage(9, 100, 25)).toBe(4)
    expect(clampPage(4, 100, 25)).toBe(4)
  })

  it('returns 1 for an empty dataset regardless of the requested page', () => {
    expect(clampPage(5, 0, 25)).toBe(1)
  })
})

describe('pageOffset', () => {
  it('maps pages to LIMIT/OFFSET arithmetic', () => {
    expect(pageOffset(1, 25)).toBe(0)
    expect(pageOffset(3, 25)).toBe(50)
  })
})

describe('buildFilterQuery', () => {
  it('drops empty, null and undefined values and trims strings', () => {
    expect(buildFilterQuery({ q: '  afro  ', status: '', state: undefined, page: 2 })).toBe('?q=afro&page=2')
  })

  it('returns an empty string when nothing survives', () => {
    expect(buildFilterQuery({ q: '', status: null })).toBe('')
  })
})

describe('labelOf', () => {
  it('uses the dictionary, then a readable fallback, then an em dash', () => {
    expect(labelOf({ SALES_OPEN: 'Sales open' }, 'SALES_OPEN')).toBe('Sales open')
    expect(labelOf({}, 'SUSPENDED')).toBe('suspended')
    expect(labelOf({}, undefined)).toBe('—')
  })
})
