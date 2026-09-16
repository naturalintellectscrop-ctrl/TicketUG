import type { Metadata } from "next"
import type { ReactNode } from "react"
import { DM_Sans, Syne } from "next/font/google"
import { MotionShell } from "@/components/motion-shell"
import "./globals.css"

const bodyFont = DM_Sans({ subsets: ["latin"], variable: "--font-body" })
const displayFont = Syne({ subsets: ["latin"], variable: "--font-display", weight: ["400", "500", "600", "700", "800"] })

export const metadata: Metadata = {
  title: "TicketUG",
  description: "A trustworthy ticketing platform for Uganda.",
  applicationName: "TicketUG",
  themeColor: "#f3efe5"
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}><MotionShell>{children}</MotionShell></body>
    </html>
  )
}
