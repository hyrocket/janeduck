import { sql } from "@/lib/db"
import { auth } from "@/auth"
import { NextResponse } from "next/server"

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
  const { word, definition, part_of_speech, pronunciation, example_sentences, collocations, starter_templates, topic_hints } = body

  const newWord = (word ?? "").trim()
  const newDef  = (definition ?? "").trim()
  if (!newWord || !newDef) {
    return NextResponse.json({ error: "word and definition are required" }, { status: 400 })
  }

  const orderRows = await sql`
    SELECT COALESCE(MAX(order_in_deck), -1) AS max_order FROM cards WHERE deck_id = ${deckId}
  `
  const nextOrder = (orderRows[0].max_order as number) + 1

  const inserted = await sql`
    INSERT INTO cards (
      deck_id, word, definition, part_of_speech, pronunciation,
      example_sentences, collocations, starter_templates, topic_hints,
      order_in_deck, source
    ) VALUES (
      ${deckId}, ${newWord}, ${newDef},
      ${part_of_speech ?? null}, ${pronunciation ?? null},
      ${example_sentences ? JSON.stringify(example_sentences) : null},
      ${collocations ? JSON.stringify(collocations) : null},
      ${starter_templates ? JSON.stringify(starter_templates) : null},
      ${topic_hints ? JSON.stringify(topic_hints) : null},
      ${nextOrder}, 'user'
    )
    RETURNING id, word, definition, part_of_speech, pronunciation, order_in_deck
  `
  await sql`UPDATE decks SET card_count = card_count + 1 WHERE id = ${deckId}`

  return NextResponse.json(inserted[0], { status: 201 })
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  const deckId = params.id

  const cards = await sql`
    SELECT c.id, c.word, c.definition, c.part_of_speech, c.pronunciation,
           c.example_sentences, c.difficulty_band, c.order_in_deck,
           wa.audio_url
    FROM cards c
    LEFT JOIN word_audio wa ON wa.word = LOWER(TRIM(c.word))
    WHERE c.deck_id = ${deckId}
    ORDER BY c.order_in_deck
  `

  if (!session?.user?.id || cards.length === 0) {
    return NextResponse.json(cards.map(c => ({ ...c, user_card: null })))
  }

  const userId = session.user.id
  const cardIds = cards.map(c => c.id)

  const userCards = await sql`
    SELECT card_id, mastery_level, last_self_eval_rating, writing_attempts_count,
           last_reviewed_at, is_starred
    FROM user_cards
    WHERE user_id = ${userId}
      AND card_id = ANY(${cardIds}::uuid[])
  `

  const ucMap = new Map(userCards.map(uc => [uc.card_id, uc]))

  const merged = buildQueue(cards as CardRow[], ucMap as Map<string, UcRow>)

  return NextResponse.json(merged)
}

type CardRow = { id: string; [k: string]: unknown }
type UcRow = {
  card_id: string
  mastery_level: number
  is_starred: boolean
  last_reviewed_at: string | null
  writing_attempts_count: number
  [k: string]: unknown
}

// Mastery-based priority queue (SRS_SPEC.md §review_priority — simple MVP version).
// SM-2 fields (srs_state, interval_days) are intentionally NOT used here.
// Priority: starred > low mastery > not recently reviewed > new cards.
function buildQueue(cards: CardRow[], ucMap: Map<string, UcRow>) {
  const MAX = 20

  const withPriority = cards.map(card => {
    const uc = ucMap.get(card.id as string)
    if (!uc) {
      // New card — highest priority
      return { card: { ...card, user_card: null }, priority: 0 }
    }
    const mastery = uc.mastery_level ?? 0
    const lastReviewed = uc.last_reviewed_at ? new Date(uc.last_reviewed_at).getTime() : 0
    const isStarred = uc.is_starred ? 1 : 0

    // Lower score = higher priority in queue
    // Starred cards get a big boost (-1000)
    // Lower mastery = higher priority (mastery * 100)
    // Less recently reviewed = higher priority (older timestamp = smaller value)
    const score = -isStarred * 1000 + mastery * 100 + (lastReviewed / 1e10)

    return { card: { ...card, user_card: uc }, priority: score }
  })

  withPriority.sort((a, b) => a.priority - b.priority)

  return withPriority.slice(0, MAX).map(x => x.card)
}
