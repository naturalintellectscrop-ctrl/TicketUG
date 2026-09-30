import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { listPublicEvents } from '@/lib/public-events'

export const dynamic = 'force-dynamic'

// Static marketing + auth surfaces first, then every discoverable public event
// page. The DB call fails soft: if the listing query is unavailable the
// sitemap still ships the static routes.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/events`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/sign-up`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 }
  ]
  try {
    const { events } = await listPublicEvents({ page: 1, pageSize: 48 })
    return [...staticEntries, ...events.map((event) => ({
      url: `${SITE_URL}/events/${event.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8
    }))]
  } catch {
    return staticEntries
  }
}
