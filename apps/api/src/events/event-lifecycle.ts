export const EVENT_STATES = ['DRAFT', 'PUBLISHED', 'SALES_OPEN', 'SALES_CLOSED', 'EVENT_LIVE', 'COMPLETED', 'CANCELLED', 'SUSPENDED', 'ARCHIVED'] as const
export type EventLifecycleState = typeof EVENT_STATES[number]

const transitions: Record<EventLifecycleState, readonly EventLifecycleState[]> = {
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['SALES_OPEN', 'CANCELLED', 'SUSPENDED'],
  SALES_OPEN: ['SALES_CLOSED', 'SUSPENDED', 'CANCELLED'],
  SALES_CLOSED: ['EVENT_LIVE', 'CANCELLED'],
  EVENT_LIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  SUSPENDED: ['PUBLISHED', 'CANCELLED', 'ARCHIVED'],
  ARCHIVED: [],
}

export function canTransition(from: EventLifecycleState, to: EventLifecycleState) {
  return transitions[from]?.includes(to) ?? false
}

export function assertTransition(from: EventLifecycleState, to: EventLifecycleState) {
  if (!canTransition(from, to)) throw new Error(`Invalid event lifecycle transition: ${from} -> ${to}`)
}
