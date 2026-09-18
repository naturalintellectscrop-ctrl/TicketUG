export function validateTicketNumbers(priceMinorUnits, capacity) {
    if (!Number.isSafeInteger(priceMinorUnits) || priceMinorUnits < 0)
        throw new Error('Ticket price must be a non-negative integer');
    if (!Number.isSafeInteger(capacity) || capacity < 0)
        throw new Error('Ticket capacity must be a non-negative integer');
}
export function validateSaleWindow(startsAt, endsAt) {
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt))
        throw new Error('Ticket sale end must be after sale start');
}
export function getTicketAvailability(input) {
    if (!input.active)
        return 'INACTIVE';
    if (input.capacity === 0)
        return 'SOLD_OUT';
    const now = input.now ?? new Date();
    if (input.saleStartsAt && now < new Date(input.saleStartsAt))
        return 'BEFORE_SALE';
    if (input.saleEndsAt && now >= new Date(input.saleEndsAt))
        return 'AFTER_SALE';
    return 'ON_SALE';
}
