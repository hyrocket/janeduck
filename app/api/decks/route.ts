import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const decks = await sql`
    SELECT id, name, description, level, card_count, source, is_public
    FROM decks
    WHERE is_public = true
    ORDER BY level, name
  `
  return NextResponse.json(decks)
}
