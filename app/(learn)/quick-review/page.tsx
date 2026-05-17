import { sql } from "@/lib/db"
import { auth } from "@/auth"
import { notFound } from "next/navigation"
import QuickReviewClient from "./QuickReviewClient"

interface Props {
  searchParams: { deckId?: string }
}

export default async function QuickReviewPage({ searchParams }: Props) {
  const deckId = searchParams.deckId
  if (!deckId) notFound()

  const session = await auth()
  const userId = session?.user?.id ?? null

  const [deckRows, cards] = await Promise.all([
    sql`SELECT name FROM decks WHERE id = ${deckId} LIMIT 1`,
    sql`
      SELECT id, word, definition, part_of_speech, example_sentences,
             difficulty_band, order_in_deck
      FROM cards
      WHERE deck_id = ${deckId}
      ORDER BY order_in_deck
    `,
  ])

  if (deckRows.length === 0) notFound()
  const deckName = deckRows[0].name as string

  // Fetch user_cards if logged in
  let ucMap = new Map<string, unknown>()
  if (userId && cards.length > 0) {
    const cardIds = cards.map(c => c.id)
    const userCards = await sql`
      SELECT card_id, mastery_level, last_self_eval_rating, writing_attempts_count,
             srs_state, ease_factor, interval_days, next_review_at, is_starred
      FROM user_cards
      WHERE user_id = ${userId}
        AND card_id = ANY(${cardIds}::uuid[])
    `
    ucMap = new Map(userCards.map(uc => [uc.card_id as string, uc]))
  }

  const merged = buildQueue(cards as CardRow[], ucMap)

  return (
    <main className="bg-yellow-50 min-h-screen">
      <div className="max-w-lg mx-auto h-screen flex flex-col">
        <QuickReviewClient
          cards={merged}
          deckName={deckName}
          isAuthed={!!userId}
        />
      </div>
    </main>
  )
}

interface CardRow {
  id: string
  word: string
  definition: string
  part_of_speech: string | null
  example_sentences: { sentence: string; context?: string }[] | null
  difficulty_band: string | null
  order_in_deck: number
}

interface UcRow {
  card_id: string
  srs_state: string
  next_review_at: string
  mastery_level: number
  is_starred: boolean
  last_self_eval_rating: string | null
}

function buildQueue(cards: CardRow[], ucMap: Map<string, unknown>) {
  const now = new Date()
  const MAX = 20

  const due: (CardRow & { user_card: UcRow })[] = []
  const weak: (CardRow & { user_card: UcRow })[] = []
  const starred: (CardRow & { user_card: UcRow })[] = []
  const newCards: (CardRow & { user_card: null })[] = []

  for (const card of cards) {
    const uc = ucMap.get(card.id) as UcRow | undefined
    if (!uc) {
      newCards.push({ ...card, user_card: null })
      continue
    }
    const isDue = new Date(uc.next_review_at) <= now
    if (["learning", "review", "relearning"].includes(uc.srs_state) && isDue) {
      due.push({ ...card, user_card: uc })
    } else if (uc.is_starred && isDue) {
      starred.push({ ...card, user_card: uc })
    } else if (uc.mastery_level >= 1 && uc.mastery_level <= 2) {
      weak.push({ ...card, user_card: uc })
    }
  }

  const queue: (CardRow & { user_card: UcRow | null })[] = []
  const seen = new Set<string>()

  const add = (pool: (CardRow & { user_card: UcRow | null })[], limit: number) => {
    for (const c of pool) {
      if (queue.length >= MAX || limit-- <= 0) break
      if (!seen.has(c.id)) { queue.push(c); seen.add(c.id) }
    }
  }

  add(due, 10)
  add(weak, 4)
  add(starred, 3)
  add(newCards, MAX - queue.length)

  // backfill if still under MAX
  if (queue.length < MAX) {
    add([...due, ...weak, ...starred, ...newCards], MAX - queue.length)
  }

  return queue
}
