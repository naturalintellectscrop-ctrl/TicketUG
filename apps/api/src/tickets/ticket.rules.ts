import { ConflictException, ForbiddenException } from '@nestjs/common'
import type { TicketStatus } from './ticket.contracts'
export function assertPaidOrder(orderStatus: string, paymentStatus: string) { if (orderStatus !== 'PAID' || paymentStatus !== 'SUCCEEDED') throw new ConflictException('TICKETS_REQUIRE_VERIFIED_PAYMENT') }
export function assertTicketReadable(status: TicketStatus) { if (!['ISSUED','CHECKED_IN','CANCELLED','REFUNDED','VOID'].includes(status)) throw new ConflictException('INVALID_TICKET_STATUS') }
export function assertOrganizerRole(role: string | undefined) { if (!role || !['ORGANIZER_OWNER','ORGANIZER_MANAGER'].includes(role)) throw new ForbiddenException('Organizer access denied') }
