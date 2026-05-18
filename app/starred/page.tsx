import { sql } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"

interface StarredCard {
  card_id: string
  word: string
  definition: string
  part_of_speech: string | null
  pronunciation: string | null
  mastery_level: number
  last_self_eval_rating: string | null
  starred_at: string
  deck_id: string
  deck_name: string
}

const MASTERY_DOTS = [0, 1, 2, 3, 4, 5]

function MasteryBar({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {MASTERY_DOTS.map(i => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i < level ? "bg-yellow-400" : "bg-gray-200"}`}
        />
      ))}
    </div>
  )
}

export default async function StarredPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const rows = await sql`
    SELECT
      uc.card_id, uc.mastery_level, uc.last_self_eval_rating,
      uc.starred_at,
      c.word, c.definition, c.part_of_speech, c.pronunciation,
      d.id   AS deck_id,
      d.name AS deck_name
    FROM user_cards uc
    JOIN cards  c ON c.id  = uc.card_id
    JOIN decks  d ON d.id  = c.deck_id
    WHERE uc.user_id   = ${session.user.id}
      AND uc.is_starred = true
    ORDER BY uc.starred_at DESC
  ` as StarredCard[]

  return (
    <main className="min-h-screen bg-yellow-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/decks"
            className="text-gray-400 hover:text-gray-600 active:scale-90 transition-transform p-1 -ml-1"
            aria-label="Back to decks"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 text-base leading-tight">Starred</p>
            <p className="text-xs text-gray-400">{rows.length} word{rows.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">

        {rows.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-4">☆</p>
            <p className="text-sm">No starred words yet.</p>
            <p className="text-xs mt-1">Tap ★ on any card to save it here.</p>
            <Link href="/decks" className="inline-block mt-6 text-sm text-yellow-500 hover:underline">
              Go to decks →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(card => (
              <Link
                key={card.card_id}
                href={`/quick-review?deckId=${card.deck_id}`}
                className="flex items-center gap-4 bg-white rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md active:shadow-sm transition-shadow"
              >
                {/* Word info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800 text-base">{card.word}</span>
                    {card.part_of_speech && (
                      <span className="text-xs text-yellow-500 font-medium uppercase tracking-wide">
                        {card.part_of_speech}
                      </span>
                    )}
                  </div>
                  {card.pronunciation && (
                    <p className="text-xs text-gray-400 mt-0.5">{card.pronunciation}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">{card.definition}</p>
                </div>

                {/* Right side: mastery + deck */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <MasteryBar level={card.mastery_level} />
                  <span className="text-xs bg-yellow-50 text-yellow-600 font-medium px-2 py-0.5 rounded-full">
                    {card.deck_name.replace(" (test)", "")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
