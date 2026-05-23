import { auth } from "@/auth"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id
  const deckId = params.id

  const deckRows = await sql`
    SELECT id, owner_id, deck_type FROM decks WHERE id = ${deckId} LIMIT 1
  `
  if (deckRows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const deck = deckRows[0]
  if (deck.deck_type !== "user" || (deck.owner_id as string) !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()

  // icon-only update (no name required)
  if ("icon" in body && !("name" in body)) {
    const icon: string | null = body.icon ?? null
    const updated = await sql`
      UPDATE decks SET icon = ${icon} WHERE id = ${deckId}
      RETURNING id, icon
    `
    return NextResponse.json(updated[0])
  }

  const name: string = (body.name ?? "").trim()
  const description: string | null = (body.description ?? "").trim() || null
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

  const duplicate = await sql`
    SELECT id FROM decks
    WHERE owner_id = ${userId} AND deck_type = 'user' AND name = ${name} AND id != ${deckId}
    LIMIT 1
  `
  if (duplicate.length > 0) {
    return NextResponse.json({ error: "A deck with this name already exists" }, { status: 409 })
  }

  const updated = await sql`
    UPDATE decks SET name = ${name}, description = ${description}
    WHERE id = ${deckId}
    RETURNING id, name, description
  `
  return NextResponse.json(updated[0])
}

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
