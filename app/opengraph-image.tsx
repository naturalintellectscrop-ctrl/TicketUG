import { ImageResponse } from 'next/og'
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site'

// Default Open Graph / Twitter share card (file convention). Every route
// without its own og:image inherits this — event pages without hero media,
// sign-in/sign-up, contact, etc. Shared links stop rendering as bare domains
// in WhatsApp/Telegram/X previews.
export const alt = 'Ticket Uganda — buy and sell event tickets in Uganda'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #f6f1e7 0%, #f9e9d8 55%, #f7d9c4 100%)',
          padding: 72,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 88,
              borderRadius: 12,
              background: '#191612',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: 40, height: 52, borderRadius: 6, background: '#ef5b43', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 22, height: 30, borderRadius: 3, background: '#f6f1e7' }} />
            </div>
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', color: '#191612' }}>
            {SITE_NAME}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 76, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1.02, color: '#191612', maxWidth: 940 }}>
            <span>Every moment deserves</span>
            <span>a real crowd.</span>
          </div>
          <div style={{ fontSize: 32, color: '#5c5347', maxWidth: 880 }}>
            {`${SITE_TAGLINE} Concerts, festivals, parties, sports and more — pay with mobile money, walk in with a QR ticket.`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ padding: '10px 26px', borderRadius: 999, background: '#191612', color: '#f6f1e7', fontSize: 24, fontWeight: 700 }}>
            {SITE_URL.replace(/^https?:\/\//, '')}
          </div>
          <div style={{ padding: '10px 26px', borderRadius: 999, border: '2px solid #191612', color: '#191612', fontSize: 24, fontWeight: 700 }}>
            Uganda
          </div>
        </div>
      </div>
    ),
    size,
  )
}
