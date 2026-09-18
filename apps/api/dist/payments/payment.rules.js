const transitions = {
    PENDING: ['PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'],
    PROCESSING: ['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'],
    SUCCEEDED: [], FAILED: [], CANCELLED: [], EXPIRED: [],
};
export function assertPaymentTransition(from, to) {
    if (!transitions[from] || !transitions[from].includes(to))
        throw new Error(`PAYMENT_STATE_TRANSITION_INVALID: ${from} -> ${to}`);
}
export function isTerminalPaymentStatus(status) { return ['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(status); }
