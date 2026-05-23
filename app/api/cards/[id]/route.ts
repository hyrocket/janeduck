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
  const cardId = params.id

  const rows = await sql`
    SELECT c.id, c.deck_id, c.word, c.definition, c.order_in_deck,
           d.owner_id, d.deck_type
    FROM cards c
    JOIN decks d ON c.deck_id = d.id
    WHERE c.id = ${cardId}
    LIMIT 1
  `
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const current = rows[0]
  if (current.deck_type !== "user" || (current.owner_id as string) !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { word, definition, part_of_speech, pronunciation, example_sentences, collocations, starter_templates, topic_hints } = body

  const newWord = (word ?? "").trim()
  const newDef  = (definition ?? "").trim()
  if (!newWord || !newDef) {
    return NextResponse.json({ error: "word and definition are required" }, { status: 400 })
  }

  const wordChanged = newWord !== (current.word as string)
  const defChanged  = newDef  !== (current.definition as string)

  if (wordChanged || defChanged) {
    // Core identity changed → new card_id, learning history resets via cascade
    const inserted = await sql`
      INSERT INTO cards (
        deck_id, word, definition, part_of_speech, pronunciation,
        example_sentences, collocations, starter_templates, topic_hints,
        order_in_deck, source
      ) VALUES (
        ${current.deck_id as string}, ${newWord}, ${newDef},
        ${part_of_speech ?? null}, ${pronunciation ?? null},
        ${example_sentences ? JSON.stringify(example_sentences) : null},
        ${collocations ? JSON.stringify(collocations) : null},
        ${starter_templates ? JSON.stringify(starter_templates) : null},
        ${topic_hints ? JSON.stringify(topic_hints) : null},
        ${current.order_in_deck as number}, 'user'
      )
      RETURNING id, word, definition, part_of_speech, pronunciation, order_in_deck
    `
    // CASCADE deletes user_cards + writing_attempts for old card
    await sql`DELETE FROM cards WHERE id = ${cardId}`
    return NextResponse.json({ ...inserted[0], history_reset: true })
  }

  // Metadata-only change → in-place update, history preserved
  const updated = await sql`
    UPDATE cards SET
      part_of_speech    = ${part_of_speech ?? null},
      pronunciation     = ${pronunciation ?? null},
      example_sentences = ${example_sentences ? JSON.stringify(example_sentences) : null},
      collocations      = ${collocations ? JSON.stringify(collocations) : null},
      starter_templates = ${starter_templates ? JSON.stringify(starter_templates) : null},
      topic_hints       = ${topic_hints ? JSON.stringify(topic_hints) : null}
    WHERE id = ${cardId}
    RETURNING id, word, definition, part_of_speech, pronunciation, order_in_deck
  `
  return NextResponse.json({ ...updated[0], history_reset: false })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id
  const cardId = params.id

  const rows = await sql`
    SELECT c.deck_id, d.owner_id, d.deck_type
    FROM cards c
    JOIN decks d ON c.deck_id = d.id
    WHERE c.id = ${cardId}
    LIMIT 1
  `
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const card = rows[0]
  if (card.deck_type !== "user" || (card.owner_id as string) !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await sql`DELETE FROM writing_attempts WHERE card_id = ${cardId}`
  await sql`DELETE FROM user_cards WHERE card_id = ${cardId}`
  await sql`DELETE FROM cards WHERE id = ${cardId}`
  await sql`UPDATE decks SET card_count = GREATEST(card_count - 1, 0) WHERE id = ${card.deck_id as string}`

  return NextResponse.json({ ok: true })
}
