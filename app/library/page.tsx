import { sql } from "@/lib/db"
import { auth } from "@/auth"
import Link from "next/link"
import Image from "next/image"
import { LibraryClient } from "./LibraryClient"

export const dynamic = "force-dynamic"

export default async function LibraryPage() {
  const session = await auth()

  const decks = await sql`
    SELECT id, name, description, level, card_count
    FROM decks
    WHERE deck_type = 'library'
    ORDER BY level, name
  `

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
          {session ? (
            <Link href="/decks" className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              My Decks
            </Link>
          ) : (
            <Link href="/login" className="text-xs font-medium text-yellow-600 bg-yellow-100 hover:bg-yellow-200 px-3 py-1.5 rounded-lg transition-colors">
              Sign in
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-1 shadow-sm mb-6">
          <Link
            href="/decks"
            className="flex-1 text-center text-sm font-medium py-2 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
          >
            My Decks
          </Link>
          <span className="flex-1 text-center text-sm font-bold py-2 rounded-xl bg-yellow-400 text-yellow-900">
            Library
          </span>
        </div>

        <p className="text-xs text-gray-400 mb-4">
          {session
            ? "Add a deck to start learning."
            : "Sign in to add decks to your collection."}
        </p>

        <LibraryClient
          decks={decks as { id: string; name: string; description: string | null; level: number; card_count: number }[]}
          isLoggedIn={!!session}
        />
      </div>
    </main>
  )
}
