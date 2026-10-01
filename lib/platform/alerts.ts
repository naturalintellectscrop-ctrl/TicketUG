/**
 * Operational alert derivation for the Platform Control Center overview.
 *
 * Pure function over a real metrics snapshot — the page renders whatever this
 * returns and nothing else, so an alert can never exist without a number
 * behind it, and "no alerts" always means the counters are actually clean.
 * DB-unavailable is NOT an alert here: the page renders an explicit
 * unavailable state for that instead (an outage is never dressed up as a
 * quiet platform).
 */

export type PlatformMetricsSnapshot = {
  paymentsStuckProcessing: number
  webhookFailures: number
  ticketIssuanceFailures: number
  invitationsExpiredPending: number
  ordersAwaitingPayment: number
}

export type PlatformAlertSeverity = 'high' | 'medium' | 'low'

export type PlatformAlert = {
  severity: PlatformAlertSeverity
  title: string
  detail: string
  href: string
}

export function derivePlatformAlerts(metrics: PlatformMetricsSnapshot): PlatformAlert[] {
  const alerts: PlatformAlert[] = []

  if (metrics.webhookFailures > 0) {
    alerts.push({
      severity: 'high',
      title: `${metrics.webhookFailures} payment webhook ${metrics.webhookFailures === 1 ? 'event' : 'events'} failed or were rejected`,
      detail: 'Provider events arrived but did not process cleanly. Payment state may be behind what the provider has charged. Inspect the webhook stream before treating any order as paid or unpaid.',
      href: '/platform/payments?webhook=FAILED',
    })
  }

  if (metrics.ticketIssuanceFailures > 0) {
    alerts.push({
      severity: 'high',
      title: `${metrics.ticketIssuanceFailures} ticket issuance ${metrics.ticketIssuanceFailures === 1 ? 'failure' : 'failures'} recorded`,
      detail: 'A payment succeeded but ticket issuance did not complete for at least one order. Purchasers may have paid without holding valid tickets.',
      href: '/platform/orders',
    })
  }

  if (metrics.paymentsStuckProcessing > 0) {
    alerts.push({
      severity: 'medium',
      title: `${metrics.paymentsStuckProcessing} payment ${metrics.paymentsStuckProcessing === 1 ? 'attempt' : 'attempts'} stuck in processing for over an hour`,
      detail: 'The provider has not returned a terminal state. The order expiry sweep will fail these payments when their window closes, but the provider side should be checked in the NylonPay dashboard.',
      href: '/platform/payments?status=PROCESSING',
    })
  }

  if (metrics.invitationsExpiredPending > 0) {
    alerts.push({
      severity: 'low',
      title: `${metrics.invitationsExpiredPending} organizer invitation${metrics.invitationsExpiredPending === 1 ? '' : 's'} ${metrics.invitationsExpiredPending === 1 ? 'is' : 'are'} past their expiry while still pending`,
      detail: 'These can no longer be accepted. An organizer owner needs to invite the member again.',
      href: '/platform/organizers',
    })
  }

  if (metrics.ordersAwaitingPayment > 0) {
    alerts.push({
      severity: 'low',
      title: `${metrics.ordersAwaitingPayment} order${metrics.ordersAwaitingPayment === 1 ? '' : 's'} ${metrics.ordersAwaitingPayment === 1 ? 'is' : 'are'} inside the payment window right now`,
      detail: 'Normal checkout activity — listed so an empty-looking sales board is never mistaken for a payment outage. These orders expire automatically when the window closes.',
      href: '/platform/orders?state=AWAITING_PAYMENT',
    })
  }

  return alerts
}
