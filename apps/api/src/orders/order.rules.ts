export type OrderStatus = 'AWAITING_PAYMENT' | 'CANCELLED'

export function validateOrderItems(items: Array<{ ticketTypeId: string; quantity: number }>) {
  if (!items.length) throw new Error('At least one order item is required')
  const ids = new Set<string>()
  for (const item of items) {
    if (ids.has(item.ticketTypeId)) throw new Error('Each ticket type may appear once per order')
    ids.add(item.ticketTypeId)
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) throw new Error('Quantity must be a positive integer')
  }
}

export function calculateLineTotal(unitPriceMinorUnits: number, quantity: number) {
  if (!Number.isSafeInteger(unitPriceMinorUnits) || unitPriceMinorUnits < 0) throw new Error('Invalid unit price')
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Invalid quantity')
  const total = BigInt(unitPriceMinorUnits) * BigInt(quantity)
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Order total exceeds supported range')
  return Number(total)
}

export function calculateOrderTotal(lines: number[]) {
  const total = lines.reduce((sum, line) => sum + BigInt(line), BigInt(0))
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Order total exceeds supported range')
  return Number(total)
}
