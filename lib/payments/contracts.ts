import type { PaymentStatus } from '../rules/payment-rules'

export type ProviderInitiation = { providerAttemptReference: string; redirectUrl?: string; instructions?: string; metadata?: Record<string, string> }
export type VerifiedProviderEvent = { providerEventId: string; eventType: string; providerAttemptReference: string; status: PaymentStatus; amountMinorUnits: bigint; currency: string; orderReference: string }

export interface PaymentProviderAdapter {
  readonly name: string
  initiate(input: { paymentPublicId: string; attemptPublicId: string; amountMinorUnits: bigint; currency: string; orderReference: string; customer?: ProviderCustomer }): Promise<ProviderInitiation>
  verifyWebhook(input: { headers: Record<string, string | undefined>; rawBody: string; body: unknown }): VerifiedProviderEvent
}

// Purchaser contact details the provider needs to reach the payer. Phone is
// the mobile-money address for push prompts (Uganda: MTN/Airtel); name/email
// come from the order's purchaser fields.
export type ProviderCustomer = { name?: string | null; email?: string | null; phone?: string | null }
