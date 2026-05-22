import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { copyDeckToUser, DuplicateNameError } from "@/lib/decks/download"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { libraryDeckId, name } = await req.json()
  if (!libraryDeckId) {
    return NextResponse.json({ error: "libraryDeckId required" }, { status: 400 })
  }

  try {
    const newDeckId = await copyDeckToUser(libraryDeckId, session.user.id, name)
    return NextResponse.json({ deckId: newDeckId })
  } catch (err) {
    if (err instanceof DuplicateNameError) {
      return NextResponse.json({ conflict: true, existingName: err.deckName }, { status: 409 })
    }
    console.error("deck download error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
