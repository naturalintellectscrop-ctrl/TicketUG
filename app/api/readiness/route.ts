import { NextResponse } from "next/server"

export function GET() {
  const ready = Boolean(process.env.DATABASE_URL)
  return NextResponse.json({ status: ready ? "ready" : "not_ready", checks: { databaseConfigured: ready } }, { status: ready ? 200 : 503 })
}
