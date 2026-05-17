import { sql } from "@/lib/db"
import { auth } from "@/auth"
import Link from "next/link"
import { signOut } from "@/auth"

export default async function DecksPage() {
  const [session, decks] = await Promise.all([
    auth(),
    sql`
      SELECT id, name, description, level, card_count
      FROM decks
      WHERE is_public = true
      ORDER BY level, name
    `,
  ])

  return (
    <main className="min-h-screen bg-yellow-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-yellow-500">JaneDuck 🦆</h1>
            {session?.user?.name && (
              <p className="text-xs text-gray-400 mt-0.5">Hi, {session.user.name.split(" ")[0]}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/starred"
              className="text-xl text-yellow-400 hover:text-yellow-500 px-2 py-1 rounded-lg hover:bg-yellow-50 transition-colors"
              title="Starred words"
            >
              ★
            </Link>
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
        </div>

        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Choose a Deck
        </h2>

        <div className="space-y-3">
          {decks.map(deck => (
            <Link
              key={deck.id as string}
              href={`/quick-review?deckId=${deck.id}`}
              className="block bg-white rounded-2xl shadow-sm p-5 hover:shadow-md active:shadow-sm transition-shadow"
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

        {!session && (
          <p className="mt-8 text-center text-xs text-gray-400">
            <Link href="/login" className="text-yellow-500 hover:underline">Sign in</Link> to save your progress
          </p>
        )}
      </div>
    </main>
  )
}
