import { sql } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { calculateReviewPriority } from "@/lib/srs/update"
import type { SelfEvalRating } from "@/lib/types"
import QuickReviewClient from "@/app/(learn)/quick-review/QuickReviewClient"

export const dynamic = "force-dynamic"

export default async function StarredReviewPage({ searchParams }: { searchParams: { startCardId?: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const startCardId = searchParams.startCardId ?? null

  const userId = session.user.id

  const rows = await sql`
    SELECT
      c.id, c.word, c.definition, c.part_of_speech, c.pronunciation,
      c.example_sentences,
      uc.mastery_level, uc.last_self_eval_rating,
      uc.writing_attempts_count, uc.last_reviewed_at, uc.is_starred
    FROM user_cards uc
    JOIN cards c ON c.id = uc.card_id
    WHERE uc.user_id   = ${userId}
      AND uc.is_starred = true
    ORDER BY uc.starred_at DESC
  `

  if (rows.length === 0) redirect("/starred")

  const MAX = 20

  const queue = rows
    .map(r => {
      const priority = calculateReviewPriority({
        mastery_level:          r.mastery_level as number,
        last_reviewed_at:       r.last_reviewed_at ? new Date(r.last_reviewed_at as string) : null,
        last_self_eval_rating:  r.last_self_eval_rating as SelfEvalRating | null,
        writing_attempts_count: r.writing_attempts_count as number,
      })
      return {
        card: {
          id:               r.id as string,
          word:             r.word as string,
          definition:       r.definition as string,
          part_of_speech:   r.part_of_speech as string | null,
          pronunciation:    r.pronunciation as string | null,
          example_sentences: r.example_sentences as { sentence: string; context?: string }[] | null,
          user_card: {
            mastery_level:         r.mastery_level as number,
            is_starred:            true,
            last_self_eval_rating: r.last_self_eval_rating as string | null,
          },
        },
        priority,
      }
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX)
    .map(x => x.card)

  // 클릭한 카드가 있으면 큐 맨 앞으로
  if (startCardId) {
    const idx = queue.findIndex(c => c.id === startCardId)
    if (idx > 0) {
      const [target] = queue.splice(idx, 1)
      queue.unshift(target)
    }
  }

  return (
    <main className="bg-yellow-50 min-h-screen">
      <div className="max-w-lg mx-auto h-screen flex flex-col">
        <QuickReviewClient
          cards={queue}
          deckName="⭐ Starred Words"
          isAuthed={true}
          backHref="/starred"
        />
      </div>
    </main>
  )
}
