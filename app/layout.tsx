import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { DM_Sans, Syne } from "next/font/google"
import { SITE_NAME, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_URL } from "@/lib/site"
import "./globals.css"

const bodyFont = DM_Sans({ subsets: ["latin"], variable: "--font-body" })
const displayFont = Syne({ subsets: ["latin"], variable: "--font-display", weight: ["400", "500", "600", "700", "800"] })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Ticket Uganda — Buy Event Tickets in Uganda",
    template: "%s · Ticket Uganda"
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_UG",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Ticket Uganda — Buy Event Tickets in Uganda",
    description: SITE_DESCRIPTION
  },
  twitter: {
    card: "summary_large_image",
    title: "Ticket Uganda — Buy Event Tickets in Uganda",
    description: SITE_DESCRIPTION
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 }
  },
  category: "events"
}

export const viewport: Viewport = {
  themeColor: "#f3efe5"
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-UG">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>{children}</body>
    </html>
  )
}
