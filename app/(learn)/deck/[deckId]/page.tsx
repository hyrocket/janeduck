import { sql } from "@/lib/db"
import { auth } from "@/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { DeckDetailClient, type DeckCard } from "./DeckDetailClient"

export const dynamic = "force-dynamic"

interface Props {
  params: { deckId: string }
}

export default async function DeckDetailPage({ params }: Props) {
  const { deckId } = params
  const session = await auth()
  const userId = session?.user?.id ?? null

  const [deckRows, cardRows] = await Promise.all([
    sql`SELECT id, name, description, level, card_count FROM decks WHERE id = ${deckId} LIMIT 1`,
    sql`
      SELECT
        c.id, c.word, c.definition, c.part_of_speech, c.pronunciation, c.order_in_deck,
        uc.mastery_level,
        uc.is_starred,
        uc.last_self_eval_rating
      FROM cards c
      LEFT JOIN user_cards uc
        ON uc.card_id = c.id AND uc.user_id = ${userId ?? "00000000-0000-0000-0000-000000000000"}
      WHERE c.deck_id = ${deckId}
      ORDER BY c.order_in_deck
    `,
  ])

  if (deckRows.length === 0) notFound()

  const deck = deckRows[0]
  const cards = cardRows as DeckCard[]

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

        {/* Back + Deck title */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/decks"
            className="text-gray-400 hover:text-gray-600 active:scale-90 transition-transform p-1 -ml-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-800">{deck.name as string}</h2>
            <p className="text-xs text-gray-400">{cards.length} words</p>
          </div>
        </div>

        <DeckDetailClient deckId={deckId} cards={cards} />
      </div>
    </main>
  )
}
