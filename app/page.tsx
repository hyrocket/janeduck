import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import Link from "next/link"
import Image from "next/image"

export default async function LandingPage() {
  const session = await auth()

  if (session?.user?.id) {
    const rows = await sql`
      SELECT onboarding_done, display_name FROM user_profiles WHERE user_id = ${session.user.id} LIMIT 1
    `
    const profile = rows[0] ?? null
    if (profile?.display_name) redirect("/decks")
    if (profile?.onboarding_done) redirect("/onboarding?step=2")
    redirect("/onboarding")
  }

  return (
    <main className="min-h-screen bg-yellow-50 flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-16">
        {/* Logo */}
        <div className="mb-6">
          <Image
            src="/logo.png"
            alt="JaneDuck"
            width={120}
            height={120}
            className="rounded-3xl shadow-lg mx-auto"
            priority
          />
        </div>

        <h1 className="text-4xl font-extrabold text-gray-800 mb-3">JaneDuck</h1>
        <p className="text-lg text-gray-500 max-w-xs leading-relaxed">
          Micro Writing Coach for Secondary Students
        </p>

        {/* Features */}
        <div className="mt-10 space-y-3 w-full max-w-xs text-left">
          {[
            { icon: "📇", text: "Flashcard warm-up — flip & self-rate" },
            { icon: "✍️", text: "Write a sentence, get instant AI feedback" },
            { icon: "📈", text: "Track your mastery word by word" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm">
              <span className="text-xl">{icon}</span>
              <p className="text-sm text-gray-600">{text}</p>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="mt-10 w-full max-w-xs space-y-3">
          <Link
            href="/login"
            className="block w-full bg-yellow-400 hover:bg-yellow-500 active:bg-yellow-600 text-white font-semibold text-base py-4 rounded-2xl text-center transition-colors shadow-md"
          >
            Sign in with Google
          </Link>
          <Link
            href="/decks"
            className="block w-full bg-white hover:bg-gray-50 text-gray-600 font-medium text-sm py-3 rounded-2xl text-center transition-colors border border-gray-200"
          >
            Try without signing in
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline ml-1"><path d="M9 18l6-6-6-6" /></svg>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-gray-300 pb-8">
        Built for Singapore secondary students 🇸🇬
      </p>
    </main>
  )
}
