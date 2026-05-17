import { sql } from "@/lib/db"
import { auth } from "@/auth"
import { notFound } from "next/navigation"
import { calculateReviewPriority } from "@/lib/srs/update"
import type { SelfEvalRating } from "@/lib/types"
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
      SELECT id, word, definition, part_of_speech, pronunciation,
             example_sentences, difficulty_band, order_in_deck
      FROM cards
      WHERE deck_id = ${deckId}
      ORDER BY order_in_deck
    `,
  ])

  if (deckRows.length === 0) notFound()
  const deckName = deckRows[0].name as string

  let ucMap = new Map<string, UcRow>()
  if (userId && cards.length > 0) {
    const cardIds = cards.map(c => c.id)
    const userCards = await sql`
      SELECT card_id, mastery_level, last_self_eval_rating,
             writing_attempts_count, last_reviewed_at, is_starred
      FROM user_cards
      WHERE user_id = ${userId}
        AND card_id = ANY(${cardIds}::uuid[])
    `
    ucMap = new Map(userCards.map(uc => [uc.card_id as string, uc as UcRow]))
  }

  const queue = buildQueue(cards as CardRow[], ucMap)

  return (
    <main className="bg-yellow-50 min-h-screen">
      <div className="max-w-lg mx-auto h-screen flex flex-col">
        <QuickReviewClient
          cards={queue}
          deckName={deckName}
          isAuthed={!!userId}
        />
      </div>
    </main>
  )
}

// ── Types ─────────────────────────────────────────────────────

interface CardRow {
  id: string
  word: string
  definition: string
  part_of_speech: string | null
  pronunciation: string | null
  example_sentences: { sentence: string; context?: string }[] | null
  difficulty_band: string | null
  order_in_deck: number
}

interface UcRow {
  card_id: string
  mastery_level: number
  last_self_eval_rating: string | null
  writing_attempts_count: number
  last_reviewed_at: string | null
  is_starred: boolean
}

type QueueCard = CardRow & { user_card: UcRow | null }

// ── buildQueue — SRS_SPEC.md §2 ───────────────────────────────

const MAX_QUEUE = 20

function buildQueue(cards: CardRow[], ucMap: Map<string, UcRow>): QueueCard[] {
  // ── 1. Split into three pools ─────────────────────────────
  const newPool:     QueueCard[] = []
  const reviewPool:  (QueueCard & { _p: number })[] = []
  const starredPool: (QueueCard & { _p: number })[] = []

  for (const card of cards) {
    const uc = ucMap.get(card.id)
    if (!uc) {
      newPool.push({ ...card, user_card: null })
      continue
    }

    const priority = calculateReviewPriority({
      mastery_level:          uc.mastery_level,
      last_reviewed_at:       uc.last_reviewed_at ? new Date(uc.last_reviewed_at) : null,
      last_self_eval_rating:  uc.last_self_eval_rating as SelfEvalRating | null,
      writing_attempts_count: uc.writing_attempts_count,
    })

    const qCard = { ...card, user_card: uc, _p: priority }
    reviewPool.push(qCard)
    if (uc.is_starred) starredPool.push(qCard)
  }

  // ── 2. Sort pools by priority desc ────────────────────────
  reviewPool.sort((a, b) => b._p - a._p)
  starredPool.sort((a, b) => b._p - a._p)

  // ── 3. Progress-based ratios (SRS_SPEC §2-2) ──────────────
  const progress = cards.length > 0 ? ucMap.size / cards.length : 0
  let [newRatio, reviewRatio, starredRatio] =
    progress < 0.3  ? [0.6, 0.3, 0.1] :
    progress <= 0.7 ? [0.3, 0.5, 0.2] :
                      [0.1, 0.7, 0.2]

  const targetNew     = Math.round(MAX_QUEUE * newRatio)
  const targetStarred = Math.round(MAX_QUEUE * starredRatio)
  const targetReview  = MAX_QUEUE - targetNew - targetStarred

  // ── 4. Slice pools (rule 2: take what's available, no error) ──
  const sliceNew     = newPool.slice(0, targetNew)
  const sliceStarred = starredPool.slice(0, targetStarred)

  // Review excludes cards already in starred slice (dedup)
  const starredTakenIds = new Set(sliceStarred.map(c => c.id))
  const reviewFiltered  = reviewPool.filter(c => !starredTakenIds.has(c.id))
  const sliceReview     = reviewFiltered.slice(0, targetReview)

  // ── 5. Interleave: N, R, S, N, R, S … (SRS_SPEC §2-3 rule 3) ─
  const queue: QueueCard[] = roundRobin([sliceNew, sliceReview, sliceStarred])
  const seen = new Set(queue.map(c => c.id))

  // ── 6. Fill remaining (SRS_SPEC §2-3 rule 2) ─────────────
  const tryAdd = (pool: QueueCard[]) => {
    for (const c of pool) {
      if (queue.length >= MAX_QUEUE) return
      if (!seen.has(c.id)) { queue.push(c); seen.add(c.id) }
    }
  }
  tryAdd(reviewFiltered)  // remaining review (highest priority first)
  tryAdd(newPool)         // remaining new
  tryAdd(starredPool)     // remaining starred

  return queue
}

/** Round-robin merge: N[0], R[0], S[0], N[1], R[1], … */
function roundRobin<T>(pools: T[][]): T[] {
  const result: T[] = []
  const maxLen = Math.max(0, ...pools.map(p => p.length))
  for (let i = 0; i < maxLen; i++) {
    for (const pool of pools) {
      if (i < pool.length) result.push(pool[i])
    }
  }
  return result
}
