import { describe, expect, it } from 'vitest'
import { assertPaymentTransition } from './payment.rules'

describe('payment transitions', () => {
  it('allows processing to succeed', () => expect(() => assertPaymentTransition('PROCESSING', 'SUCCEEDED')).not.toThrow())
  it('rejects succeeded to pending', () => expect(() => assertPaymentTransition('SUCCEEDED', 'PENDING')).toThrow('PAYMENT_STATE_TRANSITION_INVALID'))
  it('rejects failed to succeed', () => expect(() => assertPaymentTransition('FAILED', 'SUCCEEDED')).toThrow('PAYMENT_STATE_TRANSITION_INVALID'))
})
