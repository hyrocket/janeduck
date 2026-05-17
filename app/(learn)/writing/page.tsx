import { auth } from "@/auth"
import { redirect } from "next/navigation"
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

  if (!session?.user?.id) redirect("/login")

  const { cardId, word, definition, mastery, sessionId } = params

  if (!cardId || !word || !definition) {
    redirect("/decks")
  }

  return (
    <WritingClient
      cardId={cardId}
      word={word}
      definition={definition}
      mastery={Number(mastery ?? 0)}
      userId={session.user.id}
      sessionId={sessionId ?? null}
    />
  )
}
