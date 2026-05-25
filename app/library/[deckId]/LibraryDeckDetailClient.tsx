"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export interface LibraryCard {
  id: string
  word: string
  definition: string
  part_of_speech: string | null
  pronunciation: string | null
  order_in_deck: number
}

interface LibraryDeckInfo {
  id: string
  name: string
  description: string | null
  level: number
  card_count: number
}

const COVER_STYLES = [
  { gradient: "from-sky-400 to-blue-500" },
  { gradient: "from-violet-400 to-purple-500" },
  { gradient: "from-amber-400 to-orange-500" },
  { gradient: "from-rose-400 to-red-500" },
]
const LEVEL_EMOJI = ["📗", "📘", "📙", "📕"]

export function LibraryDeckDetailClient({
  deck,
  cards,
  isLoggedIn,
}: {
  deck: LibraryDeckInfo
  cards: LibraryCard[]
  isLoggedIn: boolean
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [modal, setModal] = useState<{ defaultName: string } | null>(null)
  const [modalName, setModalName] = useState("")
  const [modalError, setModalError] = useState("")
  const [modalLoading, setModalLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const style = COVER_STYLES[(deck.level - 1) % COVER_STYLES.length] ?? COVER_STYLES[0]
  const emoji = LEVEL_EMOJI[(deck.level - 1) % LEVEL_EMOJI.length] ?? "📗"

  async function handleAdd(name: string) {
    if (!isLoggedIn) {
      router.push("/login")
      return
    }
    setAdding(true)
    try {
      const res = await fetch("/api/decks/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryDeckId: deck.id, name }),
      })
      if (res.status === 409) {
        const data = await res.json()
        setModal({ defaultName: data.existingName })
        setModalName(data.existingName)
        setModalError("")
        return
      }
      if (!res.ok) throw new Error("Server error")
      setToast(name)
    } catch {
      alert("Something went wrong. Please try again.")
    } finally {
      setAdding(false)
    }
  }

  async function handleModalAdd() {
    if (!modal) return
    const name = modalName.trim()
    if (!name) return
    setModalLoading(true)
    setModalError("")
    try {
      const res = await fetch("/api/decks/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryDeckId: deck.id, name }),
      })
      if (res.status === 409) {
        setModalError(`"${name}" already exists. Please choose a different name.`)
        setModalLoading(false)
        return
      }
      if (!res.ok) throw new Error("Server error")
      setModal(null)
      setToast(name)
    } catch {
      setModalError("Something went wrong. Please try again.")
      setModalLoading(false)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-start gap-2">
          {/* Back */}
          <a
            href="/library"
            className="mt-2 text-gray-400 hover:text-gray-600 active:scale-90 transition-transform p-1 -ml-1 shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </a>

          {/* Icon */}
          <div className={`shrink-0 w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center text-2xl bg-gradient-to-br ${style.gradient} shadow-sm`}>
            {emoji}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-800 leading-tight truncate">{deck.name}</h2>
              <span className="text-xs bg-yellow-100 text-yellow-600 font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                Sec {deck.level}
              </span>
            </div>
            {deck.description && (
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed line-clamp-2">{deck.description}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">{deck.card_count} words</p>
          </div>

          {/* Download button */}
          <button
            onClick={() => handleAdd(deck.name)}
            disabled={adding}
            className="flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-500 active:scale-95 text-yellow-900 text-xs font-bold px-3 py-2 rounded-full transition-all disabled:opacity-60 shrink-0 mt-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
              <path d="M12 8v6M9 11h6" />
            </svg>
            {adding ? "Adding…" : "Add to My Decks"}
          </button>
        </div>
      </div>

      {/* Card list */}
      <div className="space-y-2">
        {cards.map((card) => (
          <div
            key={card.id}
            className="flex items-start gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-sm"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-semibold text-gray-800 text-base">{card.word}</span>
                {card.part_of_speech && (
                  <span className="text-xs text-yellow-500 font-medium uppercase tracking-wide">
                    {card.part_of_speech}
                  </span>
                )}
              </div>
              {card.pronunciation && (
                <p className="text-xs text-gray-400 mt-0.5">{card.pronunciation}</p>
              )}
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{card.definition}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl animate-fade-in whitespace-nowrap">
          <span>✓ <strong>{toast}</strong> added!</span>
          <button
            onClick={() => { setToast(null); router.push("/decks") }}
            className="text-yellow-400 hover:text-yellow-300 font-bold transition-colors"
          >
            Go to My Decks →
          </button>
        </div>
      )}

      {/* Duplicate name modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-gray-800 mb-1">Name already taken</h3>
            <p className="text-sm text-gray-500 mb-4">
              You already have a deck called <strong>{modal.defaultName}</strong>. Choose a different name.
            </p>
            <input
              type="text"
              value={modalName}
              onChange={(e) => { setModalName(e.target.value); setModalError("") }}
              onKeyDown={(e) => e.key === "Enter" && handleModalAdd()}
              autoFocus
              maxLength={80}
              className="w-full px-4 py-3 text-sm bg-white border-2 border-gray-200 focus:border-yellow-400 focus:outline-none rounded-2xl mb-2 transition-colors"
            />
            {modalError && (
              <p className="text-xs text-red-500 mb-3">{modalError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-3 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-2xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleModalAdd}
                disabled={modalLoading || !modalName.trim()}
                className="flex-1 py-3 text-sm font-bold bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-2xl transition-all disabled:opacity-60"
              >
                {modalLoading ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
