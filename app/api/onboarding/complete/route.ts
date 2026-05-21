import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { sql } from "@/lib/db"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { displayName } = await req.json()
  const name = typeof displayName === "string" ? displayName.trim().slice(0, 50) : null

  await sql`
    INSERT INTO user_profiles (user_id, display_name, onboarding_done)
    VALUES (${session.user.id}, ${name}, true)
    ON CONFLICT (user_id) DO UPDATE
      SET display_name    = EXCLUDED.display_name,
          onboarding_done = true
  `

  return NextResponse.json({ ok: true })
}
