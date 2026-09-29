export type TicketStatus = 'ISSUED' | 'CHECKED_IN' | 'CANCELLED' | 'REFUNDED' | 'VOID'
export type TicketProjection = {
  publicId: string; orderPublicId: string; orderNumber: string; eventId: string; eventTitle: string; eventStartsAt: string; eventEndsAt: string; venueName: string | null; venueCity: string | null; ticketTypeName: string; attendeeName: string; attendeeEmail: string; status: TicketStatus; issuedAt: string; credential?: string; qrDataUrl?: string
}
