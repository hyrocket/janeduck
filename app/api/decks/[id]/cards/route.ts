import { sql } from "@/lib/db"
import { auth } from "@/auth"
import { NextResponse } from "next/server"

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  const deckId = params.id

  // Base card query
  const cards = await sql`
    SELECT id, word, definition, part_of_speech, example_sentences,
           difficulty_band, order_in_deck
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
           srs_state, ease_factor, interval_days, next_review_at, is_starred
    FROM user_cards
    WHERE user_id = ${userId}
      AND card_id = ANY(${cardIds}::uuid[])
  `

  const ucMap = new Map(userCards.map(uc => [uc.card_id, uc]))

  const merged = buildQueue(cards as CardRow[], ucMap as Map<string, UcRow>)

  return NextResponse.json(merged)
}

type CardRow = { id: string; [k: string]: unknown }
type UcRow = { card_id: string; srs_state: string; next_review_at: string; mastery_level: number; is_starred: boolean; [k: string]: unknown }

function buildQueue(cards: CardRow[], ucMap: Map<string, UcRow>) {
  const now = new Date()
  const MAX = 20

  const due: CardRow[] = []
  const weak: CardRow[] = []
  const starred: CardRow[] = []
  const newCards: CardRow[] = []

  for (const card of cards) {
    const uc = ucMap.get(card.id)
    if (!uc) {
      newCards.push({ ...card, user_card: null })
      continue
    }
    const isDue = new Date(uc.next_review_at) <= now
    const isStarred = uc.is_starred && isDue
    const isWeak = uc.mastery_level >= 1 && uc.mastery_level <= 2

    if (["learning", "review", "relearning"].includes(uc.srs_state) && isDue) {
      due.push({ ...card, user_card: uc })
    } else if (isStarred) {
      starred.push({ ...card, user_card: uc })
    } else if (isWeak) {
      weak.push({ ...card, user_card: uc })
    }
  }

  const queue: CardRow[] = []
  const add = (pool: CardRow[], limit: number) => {
    for (const c of pool) {
      if (queue.length >= MAX) break
      if (limit-- <= 0) break
      queue.push(c)
    }
  }

  add(due, 10)
  add(weak, 4)
  add(starred, 3)
  // fill remaining with new cards
  add(newCards, MAX - queue.length)

  // if still under MAX, backfill from remaining pools
  if (queue.length < MAX) {
    const used = new Set(queue.map(c => c.id))
    for (const c of [...due, ...weak, ...starred, ...newCards]) {
      if (queue.length >= MAX) break
      if (!used.has(c.id as string)) queue.push(c)
    }
  }

  return queue
}
