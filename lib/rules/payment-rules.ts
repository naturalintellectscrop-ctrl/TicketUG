export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED'

// The authoritative payment state machine is enforced inside
// ticketug.apply_payment_event (migrations 012/013): only PENDING/PROCESSING
// attempts may move to a terminal status, and terminal statuses are final.
// This module carries the shared status vocabulary only, so the TypeScript
// side cannot drift from the database's copy.
