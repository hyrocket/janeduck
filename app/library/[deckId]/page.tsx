import { sql } from "@/lib/db"
import { auth, signOut } from "@/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { LibraryDeckDetailClient, type LibraryCard } from "./LibraryDeckDetailClient"

export const dynamic = "force-dynamic"

interface Props {
  params: { deckId: string }
}

export default async function LibraryDeckDetailPage({ params }: Props) {
  const { deckId } = params
  const session = await auth()

  const [deckRows, cardRows] = await Promise.all([
    sql`
      SELECT id, name, description, level, card_count
      FROM decks
      WHERE id = ${deckId} AND deck_type = 'library'
      LIMIT 1
    `,
    sql`
      SELECT id, word, definition, part_of_speech, pronunciation, order_in_deck
      FROM cards
      WHERE deck_id = ${deckId}
      ORDER BY order_in_deck
    `,
  ])

  if (deckRows.length === 0) notFound()

  const deck = deckRows[0]

  return (
    <main className="min-h-screen bg-yellow-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/">
              <h1 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
                JaneDuck
                <Image src="/logo-small.png" alt="" width={36} height={36} />
              </h1>
            </Link>
            {session?.user?.name && (
              <p className="text-xs text-gray-400 mt-0.5">Hi, {session.user.name.split(" ")[0]}</p>
            )}
          </div>
          {session ? (
            <form action={async () => { "use server"; await signOut({ redirectTo: "/" }) }}>
              <button type="submit" className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/login" className="text-xs font-medium text-yellow-600 bg-yellow-100 hover:bg-yellow-200 px-3 py-1.5 rounded-lg transition-colors">
              Sign in
            </Link>
          )}
        </div>

        <LibraryDeckDetailClient
          deck={{
            id: deck.id as string,
            name: deck.name as string,
            description: deck.description as string | null,
            level: deck.level as number,
            card_count: deck.card_count as number,
          }}
          cards={cardRows as LibraryCard[]}
          isLoggedIn={!!session}
        />
      </div>
    </main>
  )
}
