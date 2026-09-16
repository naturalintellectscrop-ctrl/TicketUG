import { NextResponse } from 'next/server'
import { z } from 'zod'
import { pool, withTransaction } from '@/lib/db'
import { requireTicketUGContext } from '@/lib/request-context'

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(32).optional().or(z.literal('')),
  deliveryEmail: z.string().email().max(320).optional().or(z.literal('')),
  deliveryPhone: z.string().trim().max(32).optional().or(z.literal('')),
})

export async function GET() {
  try {
    const context = await requireTicketUGContext()
    const result = await pool.query(
      `SELECT up.id, up.auth_user_id, up.display_name, up.phone, up.profile_completed_at,
              ap.delivery_email, ap.delivery_phone
         FROM ticketug.user_profile up
         LEFT JOIN ticketug.attendee_profile ap ON ap.user_profile_id = up.id
        WHERE up.id = $1`,
      [context.profileId],
    )
    return NextResponse.json({ profile: result.rows[0] })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Unable to load profile' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireTicketUGContext()
    const parsed = profileSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid profile data' }, { status: 400 })

    const profile = await withTransaction(async (client) => {
      await client.query(
        `UPDATE ticketug.user_profile
            SET display_name = $1, phone = NULLIF($2, ''), profile_completed_at = now(), updated_at = now()
          WHERE id = $3`,
        [parsed.data.displayName, parsed.data.phone ?? '', context.profileId],
      )
      await client.query(
        `INSERT INTO ticketug.attendee_profile (user_profile_id, delivery_email, delivery_phone)
         VALUES ($1, NULLIF($2, ''), NULLIF($3, ''))
         ON CONFLICT (user_profile_id) DO UPDATE SET delivery_email = EXCLUDED.delivery_email, delivery_phone = EXCLUDED.delivery_phone, updated_at = now()`,
        [context.profileId, parsed.data.deliveryEmail ?? '', parsed.data.deliveryPhone ?? ''],
      )
      const result = await client.query(`SELECT id, display_name, phone, profile_completed_at FROM ticketug.user_profile WHERE id = $1`, [context.profileId])
      return result.rows[0]
    })

    return NextResponse.json({ profile })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Unable to update profile' }, { status: 500 })
  }
}
