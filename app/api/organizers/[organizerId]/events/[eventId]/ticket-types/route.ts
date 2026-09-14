import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'

const payload = z.object({ name: z.string().trim().min(1).max(160), description: z.string().max(5000).default(''), priceMinorUnits: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), capacity: z.number().int().nonnegative().max(2147483647), saleStartsAt: z.string().datetime({ offset: true }).optional(), saleEndsAt: z.string().datetime({ offset: true }).optional(), active: z.boolean().default(false) }).refine((value) => !value.saleStartsAt || !value.saleEndsAt || new Date(value.saleStartsAt) < new Date(value.saleEndsAt), { message: 'Ticket sale end must be after sale start' })

export async function POST(request: NextRequest, { params }: { params: Promise<{ organizerId: string; eventId: string }> }) {
  const { organizerId, eventId } = await params
  const context = await getTicketUGContext()
  if (!context) return Response.json({ message: 'Authentication required' }, { status: 401 })
  const parsed = payload.safeParse(await request.json())
  if (!parsed.success) return Response.json({ message: parsed.error.issues[0]?.message ?? 'Invalid ticket type' }, { status: 400 })
  const event = await pool.query('SELECT id FROM ticketug.event WHERE id=$1 AND organizer_id=$2 AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id=$2 AND user_profile_id=$3 AND status=\'ACTIVE\' AND role IN (\'ORGANIZER_OWNER\',\'ORGANIZER_MANAGER\'))', [eventId, organizerId, context.profileId])
  if (!event.rows[0]) return Response.json({ message: 'Organizer access denied' }, { status: 403 })
  const result = await pool.query('INSERT INTO ticketug.ticket_type (id,event_id,public_id,name,description,price_minor_units,currency,capacity, sale_starts_at,sale_ends_at,active) VALUES (gen_random_uuid(),$1,\'tt_\' || substr(replace(gen_random_uuid()::text,\'-\',\'\'),1,16),$2,$3,$4,\'UGX\',$5,$6,$7,$8) RETURNING public_id,name,description,price_minor_units,currency,capacity,sale_starts_at,sale_ends_at,active', [eventId, parsed.data.name, parsed.data.description, parsed.data.priceMinorUnits, parsed.data.capacity, parsed.data.saleStartsAt ?? null, parsed.data.saleEndsAt ?? null, parsed.data.active])
  return Response.json(result.rows[0], { status: 201 })
}
