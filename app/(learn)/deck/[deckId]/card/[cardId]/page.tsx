import { sql } from "@/lib/db"
import { auth } from "@/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { MasteryBar } from "@/components/ui/MasteryBar"

export const dynamic = "force-dynamic"

interface Props {
  params: { deckId: string; cardId: string }
}

export default async function CardDetailPage({ params }: Props) {
  const { deckId, cardId } = params
  const session = await auth()
  const userId = session?.user?.id ?? null

  const rows = await sql`
    SELECT
      c.id, c.word, c.definition, c.part_of_speech, c.pronunciation,
      c.example_sentences, c.difficulty_band,
      d.name AS deck_name,
      uc.mastery_level,
      uc.is_starred,
      uc.writing_attempts_count
    FROM cards c
    JOIN decks d ON d.id = c.deck_id
    LEFT JOIN user_cards uc
      ON uc.card_id = c.id AND uc.user_id = ${userId ?? "00000000-0000-0000-0000-000000000000"}
    WHERE c.id = ${cardId} AND c.deck_id = ${deckId}
    LIMIT 1
  `

  if (rows.length === 0) notFound()

  const card = rows[0] as {
    id: string
    word: string
    definition: string
    part_of_speech: string | null
    pronunciation: string | null
    example_sentences: { sentence: string; context?: string }[] | null
    difficulty_band: string | null
    deck_name: string
    mastery_level: number | null
    is_starred: boolean | null
    writing_attempts_count: number | null
  }

  const examples = card.example_sentences ?? []

  return (
    <main className="min-h-screen bg-yellow-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <h1 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
              JaneDuck
              <Image src="/logo-small.png" alt="" width={36} height={36} />
            </h1>
          </Link>
        </div>

        {/* Back */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/deck/${deckId}`}
            className="text-gray-400 hover:text-gray-600 active:scale-90 transition-transform p-1 -ml-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <span className="text-xs text-gray-400">{card.deck_name}</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm px-6 py-8 space-y-5">
          {/* Word + meta */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-3xl font-bold text-gray-800">{card.word}</h2>
              {card.is_starred && (
                <span className="text-yellow-400 text-2xl leading-none mt-1">★</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              {card.part_of_speech && (
                <span className="text-xs text-yellow-500 font-semibold uppercase tracking-wide">
                  {card.part_of_speech}
                </span>
              )}
              {card.pronunciation && (
                <span className="text-sm text-gray-400">{card.pronunciation}</span>
              )}
              {card.difficulty_band && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {card.difficulty_band}
                </span>
              )}
            </div>
          </div>

          {/* Definition */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Definition</p>
            <p className="text-gray-700 text-base leading-relaxed">{card.definition}</p>
          </div>

          {/* Examples */}
          {examples.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Examples</p>
              <ul className="space-y-2">
                {examples.map((ex, i) => (
                  <li key={i} className="text-sm text-gray-600 italic leading-relaxed border-l-2 border-yellow-200 pl-3">
                    {ex.sentence}
                    {ex.context && (
                      <span className="text-xs text-gray-400 not-italic ml-2">({ex.context})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mastery */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-400 mb-1">Mastery</p>
              <MasteryBar level={card.mastery_level ?? 0} />
            </div>
            {(card.writing_attempts_count ?? 0) > 0 && (
              <span className="text-xs text-gray-400">
                ✏️ {card.writing_attempts_count} attempt{(card.writing_attempts_count ?? 0) !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6">
          <Link
            href={`/quick-review?deckId=${deckId}`}
            className="flex-1 text-center py-3 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 text-sm font-semibold rounded-2xl shadow-sm transition-all active:scale-95"
          >
            ⚡ Quick Review
          </Link>
        </div>
      </div>
    </main>
  )
}
