import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'

const eventPayload = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().max(5000).default(''),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  timezone: z.string().regex(/^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/).default('Africa/Kampala'),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180),
  venueId: z.string().nullable().optional(),
})

export async function GET(_: NextRequest, { params }: { params: Promise<{ organizerId: string }> }) { const { organizerId } = await params; const context = await getTicketUGContext(); if (!context) return Response.json({ message: 'Authentication required' }, { status: 401 }); const result = await pool.query('SELECT id, public_id, slug, title, description, timezone, starts_at, ends_at, publication_state, lifecycle_state, discoverable, venue_id, created_at, updated_at FROM ticketug.event WHERE organizer_id=$1 AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id=$1 AND user_profile_id=$2 AND status=\'ACTIVE\') ORDER BY starts_at DESC', [organizerId, context.profileId]); return Response.json(result.rows) }
export async function POST(request: NextRequest, { params }: { params: Promise<{ organizerId: string }> }) { const { organizerId } = await params; const context = await getTicketUGContext(); if (!context) return Response.json({ message: 'Authentication required' }, { status: 401 }); const parsed = eventPayload.safeParse(await request.json()); if (!parsed.success) return Response.json({ message: 'Invalid event details' }, { status: 400 }); if (new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt)) return Response.json({ message: 'Event end must be after start' }, { status: 400 }); if (parsed.data.venueId) { const venue = await pool.query('SELECT id FROM ticketug.venue WHERE id=$1 AND organizer_id=$2', [parsed.data.venueId, organizerId]); if (!venue.rows[0]) return Response.json({ message: 'Venue does not belong to organizer' }, { status: 400 }); } const result = await pool.query('INSERT INTO ticketug.event (id,organizer_id,venue_id,public_id,slug,title,description,timezone,starts_at,ends_at,created_by) SELECT gen_random_uuid(),$1,$2,\'evt_\' || substr(replace(gen_random_uuid()::text,\'-\',\'\'),1,16),$3,$4,$5,$6,$7,$8,$9 WHERE EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id=$1 AND user_profile_id=$10 AND status=\'ACTIVE\' AND role IN (\'ORGANIZER_OWNER\',\'ORGANIZER_MANAGER\')) RETURNING *', [organizerId, parsed.data.venueId ?? null, parsed.data.slug, parsed.data.title, parsed.data.description, parsed.data.timezone, parsed.data.startsAt, parsed.data.endsAt, context.profileId]); if (!result.rows[0]) return Response.json({ message: 'Organizer access denied' }, { status: 403 }); return Response.json(result.rows[0], { status: 201 }) }
