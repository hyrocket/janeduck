import { sql } from "@/lib/db"
import { auth } from "@/auth"
import Link from "next/link"
import { signOut } from "@/auth"

// Gradient + emoji cover per deck level (no DB image needed for MVP)
const COVER_STYLES: { gradient: string; emoji: string }[] = [
  { gradient: "from-sky-400 to-blue-500",      emoji: "📗" },
  { gradient: "from-violet-400 to-purple-500",  emoji: "📘" },
  { gradient: "from-amber-400 to-orange-500",   emoji: "📙" },
  { gradient: "from-rose-400 to-red-500",       emoji: "📕" },
]

function DeckCover({ level }: { level: number }) {
  const style = COVER_STYLES[(level - 1) % COVER_STYLES.length] ?? COVER_STYLES[0]
  return (
    <div
      className={`w-14 h-[4.5rem] rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-2xl shrink-0 shadow-sm`}
    >
      {style.emoji}
    </div>
  )
}

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

        {/* Section heading + starred button */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
            Choose a Deck
          </h2>
          <Link
            href="/starred"
            className="flex items-center gap-1.5 text-xs font-medium text-yellow-600 bg-yellow-100 px-3 py-1.5 rounded-full hover:bg-yellow-200 hover:shadow-sm active:scale-95 transition-all duration-150"
          >
            <span className="text-sm leading-none">★</span>
            별표 카드
          </Link>
        </div>

        <div className="space-y-3">
          {decks.map(deck => (
            <Link
              key={deck.id as string}
              href={`/quick-review?deckId=${deck.id}`}
              className="flex items-center gap-4 bg-white rounded-2xl shadow-sm px-4 py-4 hover:shadow-md active:shadow-sm transition-shadow"
            >
              <DeckCover level={deck.level as number} />

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-800 text-sm leading-snug">
                    {deck.name as string}
                  </h3>
                  <span className="text-xs bg-yellow-100 text-yellow-600 font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                    Sec {deck.level}
                  </span>
                </div>
                {deck.description && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                    {deck.description as string}
                  </p>
                )}
                <p className="text-xs text-gray-300 mt-2">{deck.card_count as number} words</p>
              </div>
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
