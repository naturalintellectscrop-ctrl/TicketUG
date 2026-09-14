import { describe, expect, it } from 'vitest'
import { assertPaidOrder } from './ticket.rules'

describe('ticket issuance rules', () => {
  it('requires the verified paid pair', () => { expect(() => assertPaidOrder('PAID', 'SUCCEEDED')).not.toThrow(); expect(() => assertPaidOrder('AWAITING_PAYMENT', 'SUCCEEDED')).toThrow('TICKETS_REQUIRE_VERIFIED_PAYMENT'); expect(() => assertPaidOrder('PAID', 'PROCESSING')).toThrow('TICKETS_REQUIRE_VERIFIED_PAYMENT') })
})
