import { ConflictException, ForbiddenException } from '@nestjs/common';
export function assertPaidOrder(orderStatus, paymentStatus) { if (orderStatus !== 'PAID' || paymentStatus !== 'SUCCEEDED')
    throw new ConflictException('TICKETS_REQUIRE_VERIFIED_PAYMENT'); }
export function assertTicketReadable(status) { if (!['ISSUED', 'CHECKED_IN', 'CANCELLED', 'REFUNDED', 'VOID'].includes(status))
    throw new ConflictException('INVALID_TICKET_STATUS'); }
export function assertOrganizerRole(role) { if (!role || !['ORGANIZER_OWNER', 'ORGANIZER_MANAGER'].includes(role))
    throw new ForbiddenException('Organizer access denied'); }
