import { auth } from "@/auth"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

interface CardInput {
  word: string
  definition: string
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id
  const deckId = params.id

  const deckRows = await sql`
    SELECT owner_id, deck_type FROM decks WHERE id = ${deckId} LIMIT 1
  `
  if (deckRows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const deck = deckRows[0]
  if (deck.deck_type !== "user" || (deck.owner_id as string) !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const cards: CardInput[] = (body.cards ?? [])
    .filter((c: CardInput) => c.word?.trim() && c.definition?.trim())
    .map((c: CardInput) => ({ word: c.word.trim(), definition: c.definition.trim() }))

  if (cards.length === 0) return NextResponse.json({ error: "No valid cards" }, { status: 400 })
  if (cards.length > 200) return NextResponse.json({ error: "Max 200 cards per import" }, { status: 400 })

  const orderRows = await sql`
    SELECT COALESCE(MAX(order_in_deck), -1) AS max_order FROM cards WHERE deck_id = ${deckId}
  `
  let nextOrder = (orderRows[0].max_order as number) + 1

  for (const card of cards) {
    await sql`
      INSERT INTO cards (deck_id, word, definition, order_in_deck, source)
      VALUES (${deckId}, ${card.word}, ${card.definition}, ${nextOrder}, 'user')
    `
    nextOrder++
  }

  await sql`UPDATE decks SET card_count = card_count + ${cards.length} WHERE id = ${deckId}`

  return NextResponse.json({ imported: cards.length }, { status: 201 })
}
