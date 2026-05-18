import { auth } from "@/auth"
import { redirect } from "next/navigation"  // still used for missing params
import WritingClient from "./WritingClient"

interface Props {
  searchParams: Promise<{
    cardId?: string
    word?: string
    definition?: string
    mastery?: string
    sessionId?: string
  }>
}

export default async function WritingPage({ searchParams }: Props) {
  const [session, params] = await Promise.all([auth(), searchParams])

  const { cardId, word, definition, mastery, sessionId } = params

  if (!cardId || !word || !definition) {
    redirect("/decks")
  }

  return (
    <main className="bg-yellow-50 min-h-dvh">
      <div className="max-w-lg mx-auto h-dvh flex flex-col">
        <WritingClient
          cardId={cardId}
          word={word}
          definition={definition}
          mastery={Number(mastery ?? 0)}
          userId={session?.user?.id ?? null}
          sessionId={sessionId ?? null}
        />
      </div>
    </main>
  )
}
