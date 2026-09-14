import type { PaymentStatus } from './payment.rules'

export type ProviderInitiation = { providerAttemptReference: string; redirectUrl?: string; instructions?: string; metadata?: Record<string, string> }
export type VerifiedProviderEvent = { providerEventId: string; eventType: string; providerAttemptReference: string; status: PaymentStatus; amountMinorUnits: bigint; currency: string; orderReference: string }

export interface PaymentProviderAdapter {
  readonly name: string
  initiate(input: { paymentPublicId: string; attemptPublicId: string; amountMinorUnits: bigint; currency: string; orderReference: string }): Promise<ProviderInitiation>
  verifyWebhook(input: { headers: Record<string, string | undefined>; rawBody: string; body: unknown }): VerifiedProviderEvent
}
