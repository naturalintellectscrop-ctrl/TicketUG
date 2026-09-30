import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/organizer', '/account', '/guest', '/scanner', '/profile', '/api', '/invitations'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  }
}
