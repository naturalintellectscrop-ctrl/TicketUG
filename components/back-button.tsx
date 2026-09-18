"use client"

import { useRouter, usePathname } from "next/navigation"

export function BackButton() {
  const router = useRouter()
  const pathname = usePathname()

  if (pathname === "/") return null

  return (
    <button type="button" className="back-button" onClick={() => { if (window.history.length > 1) router.back(); else router.push("/") }} aria-label="Go back to the previous page">
      <span aria-hidden="true">←</span> Back
    </button>
  )
}
