import { auth } from "@/auth"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id
  const deckId = params.id

  const deckRows = await sql`
    SELECT id, owner_id, deck_type FROM decks WHERE id = ${deckId} LIMIT 1
  `
  if (deckRows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const deck = deckRows[0]

  if (deck.deck_type !== "user" || (deck.owner_id as string) !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const cardRows = await sql`SELECT id FROM cards WHERE deck_id = ${deckId}`
  const cardIds = cardRows.map((c) => c.id as string)

  if (cardIds.length > 0) {
    await sql`DELETE FROM writing_attempts WHERE card_id = ANY(${cardIds}::uuid[])`
    await sql`DELETE FROM user_cards WHERE card_id = ANY(${cardIds}::uuid[])`
    await sql`DELETE FROM cards WHERE deck_id = ${deckId}`
  }

  await sql`DELETE FROM decks WHERE id = ${deckId}`

  return NextResponse.json({ ok: true })
}
