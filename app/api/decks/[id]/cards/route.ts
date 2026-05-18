import { sql } from "@/lib/db"
import { auth } from "@/auth"
import { NextResponse } from "next/server"

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  const deckId = params.id

  // Base card query — include pronunciation
  const cards = await sql`
    SELECT id, word, definition, part_of_speech, pronunciation,
           example_sentences, difficulty_band, order_in_deck
    FROM cards
    WHERE deck_id = ${deckId}
    ORDER BY order_in_deck
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
