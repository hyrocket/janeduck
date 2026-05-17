import { sql } from "@/lib/db"
import Link from "next/link"

export default async function Home() {
  const decks = await sql`
    SELECT id, name, description, level, card_count
    FROM decks
    WHERE is_public = true
    ORDER BY level, name
  `

  return (
    <main className="min-h-screen bg-yellow-50">
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-yellow-500 mb-1">JaneDuck</h1>
          <p className="text-sm text-gray-500">AI Writing Coach for Secondary Students</p>
        </div>

        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Choose a Deck
        </h2>

        <div className="space-y-3">
          {decks.map(deck => (
            <Link
              key={deck.id as string}
              href={`/quick-review?deckId=${deck.id}`}
              className="block bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">{deck.name as string}</h3>
                  {deck.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {deck.description as string}
                    </p>
                  )}
                </div>
                <span className="text-xs bg-yellow-100 text-yellow-600 font-medium px-2 py-1 rounded-full whitespace-nowrap ml-3">
                  Sec {deck.level}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-3">{deck.card_count as number} words</p>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/login" className="text-sm text-yellow-500 hover:underline">
            Sign in to save progress →
          </Link>
        </div>
      </div>
    </main>
  )
}
