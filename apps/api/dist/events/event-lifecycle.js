export const EVENT_STATES = ['DRAFT', 'PUBLISHED', 'SALES_OPEN', 'SALES_CLOSED', 'EVENT_LIVE', 'COMPLETED', 'CANCELLED', 'SUSPENDED', 'ARCHIVED'];
const transitions = {
    DRAFT: ['PUBLISHED', 'CANCELLED'],
    PUBLISHED: ['SALES_OPEN', 'CANCELLED', 'SUSPENDED'],
    SALES_OPEN: ['SALES_CLOSED', 'SUSPENDED', 'CANCELLED'],
    SALES_CLOSED: ['EVENT_LIVE', 'CANCELLED'],
    EVENT_LIVE: ['COMPLETED', 'CANCELLED'],
    COMPLETED: ['ARCHIVED'],
    CANCELLED: ['ARCHIVED'],
    SUSPENDED: ['PUBLISHED', 'CANCELLED', 'ARCHIVED'],
    ARCHIVED: [],
};
export function canTransition(from, to) {
    return transitions[from]?.includes(to) ?? false;
}
export function assertTransition(from, to) {
    if (!canTransition(from, to))
        throw new Error(`Invalid event lifecycle transition: ${from} -> ${to}`);
}
export function publicationStateForTransition(to) {
    if (to === 'PUBLISHED')
        return 'PUBLIC';
    if (to === 'DRAFT')
        return 'PRIVATE';
    return undefined;
}
