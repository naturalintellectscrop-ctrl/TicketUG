/**
 * Pure presentation helpers for the Platform Control Center.
 *
 * Kept free of I/O so they stay unit-testable: page loaders in
 * lib/platform/queries.ts call these when shaping rows for the UI.
 */

/** UGX amounts are stored as whole UGX in *_minor_units columns (no cents in
 * the Ugandan shilling); the product convention everywhere is `1,250,000 UGX`. */
export function formatMoney(minor: number, currency = 'UGX'): string {
  return `${Number(minor ?? 0).toLocaleString('en-UG')} ${currency}`
}

/** 1-based page clamp against a known total count. */
export function clampPage(page: number | null | undefined, totalCount: number, pageSize: number): number {
  const raw = typeof page === 'number' && Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const maxPage = Math.max(1, Math.ceil(totalCount / pageSize))
  return Math.min(raw, maxPage)
}

export function pageOffset(page: number, pageSize: number): number {
  return (clampPage(page, Number.MAX_SAFE_INTEGER, pageSize) - 1) * pageSize
}

/** `?q=…&status=…` builder that drops empty values so URLs stay clean. */
export function buildFilterQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    const asString = String(value).trim()
    if (asString === '') continue
    search.set(key, asString)
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

/** Compact absolute timestamps for dense operational tables. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-UG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Kampala' }).format(date)
}

/** Short YYYY-MM-DD for schedule columns. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-UG', { dateStyle: 'medium', timeZone: 'Africa/Kampala' }).format(date)
}

/** Human event-lifecycle labels (values are the CHECK constraint values). */
export const LIFECYCLE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  SALES_OPEN: 'Sales open',
  SALES_CLOSED: 'Sales closed',
  EVENT_LIVE: 'Event live',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  SUSPENDED: 'Suspended',
  ARCHIVED: 'Archived',
}

export const ORDER_PAYMENT_STATE_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: 'Awaiting payment',
  PAYMENT_PROCESSING: 'Payment processing',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
}

export const WEBHOOK_STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Received',
  PROCESSED: 'Processed',
  DUPLICATE: 'Duplicate',
  REJECTED: 'Rejected',
  FAILED: 'Failed',
}

export const TICKET_STATUS_LABELS: Record<string, string> = {
  ISSUED: 'Issued',
  CHECKED_IN: 'Checked in',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  VOID: 'Void',
}

export function labelOf(dictionary: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '—'
  return dictionary[value] ?? value.replaceAll('_', ' ').toLowerCase()
}
