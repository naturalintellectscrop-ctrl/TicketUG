export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED'

const transitions: Record<PaymentStatus, readonly PaymentStatus[]> = {
  PENDING: ['PROCESSING', 'FAILED', 'CANCELLED', 'EXPIRED'],
  PROCESSING: ['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'],
  SUCCEEDED: [], FAILED: [], CANCELLED: [], EXPIRED: [],
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus) {
  if (!transitions[from].includes(to)) throw new Error(`PAYMENT_STATE_TRANSITION_INVALID: ${from} -> ${to}`)
}

export function isTerminalPaymentStatus(status: PaymentStatus) { return ['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(status) }
