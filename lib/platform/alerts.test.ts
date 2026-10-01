import { describe, expect, it } from 'vitest'
import { derivePlatformAlerts, type PlatformMetricsSnapshot } from './alerts'

const clean: PlatformMetricsSnapshot = {
  paymentsStuckProcessing: 0,
  webhookFailures: 0,
  ticketIssuanceFailures: 0,
  invitationsExpiredPending: 0,
  ordersAwaitingPayment: 0,
}

describe('derivePlatformAlerts', () => {
  it('returns no alerts when every counter is clean', () => {
    expect(derivePlatformAlerts(clean)).toEqual([])
  })

  it('escalates webhook failures to high severity and links to the stream', () => {
    const alerts = derivePlatformAlerts({ ...clean, webhookFailures: 2 })
    expect(alerts).toHaveLength(1)
    expect(alerts[0].severity).toBe('high')
    expect(alerts[0].title).toContain('2 payment webhook events')
    expect(alerts[0].href).toBe('/platform/payments?webhook=FAILED')
  })

  it('flags ticket issuance failures as high severity (paid but no ticket)', () => {
    const alerts = derivePlatformAlerts({ ...clean, ticketIssuanceFailures: 1 })
    expect(alerts[0].severity).toBe('high')
    expect(alerts[0].title).toContain('1 ticket issuance failure')
  })

  it('flags stuck processing payments as medium severity', () => {
    const alerts = derivePlatformAlerts({ ...clean, paymentsStuckProcessing: 3 })
    expect(alerts[0].severity).toBe('medium')
    expect(alerts[0].href).toBe('/platform/payments?status=PROCESSING')
  })

  it('keeps expired pending invitations and open payment windows at low severity', () => {
    const alerts = derivePlatformAlerts({ ...clean, invitationsExpiredPending: 1, ordersAwaitingPayment: 4 })
    expect(alerts.map((alert) => alert.severity)).toEqual(['low', 'low'])
    expect(alerts[1].title).toContain('4 orders are')
  })

  it('orders alerts by severity: high, medium, low', () => {
    const alerts = derivePlatformAlerts({
      ...clean,
      webhookFailures: 1,
      paymentsStuckProcessing: 1,
      invitationsExpiredPending: 1,
      ordersAwaitingPayment: 1,
    })
    expect(alerts.map((alert) => alert.severity)).toEqual(['high', 'medium', 'low', 'low'])
  })
})
