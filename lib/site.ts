// Single source of truth for the public brand identity and SEO surfaces.
// Product/code identifiers (schema name `ticketug`, QR payload prefix
// `ticketug:v1:`, PDF filename prefix, env var names, helper names like
// getTicketUGContext) are functional contracts and intentionally stay as-is —
// only the human-facing name is "Ticket Uganda".
export const SITE_NAME = 'Ticket Uganda'
export const SITE_LEGAL_NAME = 'Ticket Uganda · Natural Intellects Ltd'
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://ticketug.vercel.app').replace(/\/$/, '')
export const SITE_TAGLINE = 'Built for the moments that matter.'
export const SITE_DESCRIPTION =
  'Ticket Uganda is the trusted way to buy and sell event tickets in Uganda — concerts, festivals, parties, sports, food markets, conferences and church gatherings. Pay with mobile money, get secure QR tickets, walk in ready.'
export const SITE_KEYWORDS = [
  'Uganda ticketing system',
  'events in Uganda',
  'Uganda events',
  'buy tickets Uganda',
  'event tickets Uganda',
  'concert tickets Kampala',
  'festival tickets Uganda',
  'party tickets Kampala',
  'Ugandan concerts',
  'Kampala events',
  'mobile money tickets Uganda',
  'Ticket Uganda'
]
