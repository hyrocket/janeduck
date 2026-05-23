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
    sql`SELECT id, name, description, level, card_count, deck_type, owner_id, icon FROM decks WHERE id = ${deckId} LIMIT 1`,
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
  const isOwner =
    deck.deck_type === "user" && userId !== null && (deck.owner_id as string) === userId

  return (
    <main className="min-h-screen bg-yellow-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* JaneDuck logo */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <h1 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
              JaneDuck
              <Image src="/logo-small.png" alt="" width={36} height={36} />
            </h1>
          </Link>
        </div>

        <DeckDetailClient
          deck={{
            id: deck.id as string,
            name: deck.name as string,
            description: deck.description as string | null,
            level: deck.level as number,
            card_count: deck.card_count as number,
            icon: deck.icon as string | null,
          }}
          cards={cards}
          isOwner={isOwner}
        />
      </div>
    </main>
  )
}
