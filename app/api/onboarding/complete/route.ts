import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { sql } from "@/lib/db"
import { copyDeckToUser } from "@/lib/decks/download"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id
  const { displayName } = await req.json()
  const name = typeof displayName === "string" ? displayName.trim().slice(0, 50) : null

  await sql`
    INSERT INTO user_profiles (user_id, display_name, onboarding_done)
    VALUES (${userId}, ${name}, true)
    ON CONFLICT (user_id) DO UPDATE
      SET display_name    = EXCLUDED.display_name,
          onboarding_done = true
  `

  // Auto-download default library decks for new user (skip if already has decks)
  const existing = await sql`
    SELECT id FROM decks WHERE owner_id = ${userId} AND deck_type = 'user' LIMIT 1
  `
  if (existing.length === 0) {
    const defaultDecks = await sql`
      SELECT id, name FROM decks WHERE deck_type = 'library' AND is_default = true
    `
    for (const deck of defaultDecks) {
      try {
        await copyDeckToUser(deck.id as string, userId)
      } catch {
        // Duplicate name on retry — skip
      }
    }
  }

  return NextResponse.json({ ok: true })
}
