import type { MetadataRoute } from 'next'
import { SITE_DESCRIPTION } from '@/lib/site'

// Web app manifest: brand identity for install surfaces and browser UI theming.
// Icons are the real brand assets served by the app/icon.png + app/apple-icon.png
// file conventions — no invented artwork.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ticket Uganda',
    short_name: 'TicketUG',
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#f3efe5',
    theme_color: '#ea0d1c',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' }
    ]
  }
}
