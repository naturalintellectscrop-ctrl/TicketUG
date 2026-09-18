"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { BackButton } from "@/components/back-button"

export function MotionShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return <div className={`motion-shell ${ready ? "motion-shell-ready" : ""} ${className}`}><BackButton />{children}</div>
}
