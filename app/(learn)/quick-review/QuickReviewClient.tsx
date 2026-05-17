"use client"

import { useState } from "react"
import FlashCard from "@/components/Card/FlashCard"
import SelfEvalButtons from "@/components/Card/SelfEvalButtons"
import type { SelfEvalRating } from "@/lib/types"

interface CardData {
  id: string
  word: string
  definition: string
  part_of_speech: string | null
  pronunciation: string | null
  example_sentences: { sentence: string; context?: string }[] | null
  user_card: null | {
    srs_state: string
    mastery_level: number
    is_starred: boolean
    last_self_eval_rating: string | null
  }
}

interface Props {
  cards: CardData[]
  deckName: string
  isAuthed: boolean
}

export default function QuickReviewClient({ cards, deckName, isAuthed }: Props) {
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [animDir, setAnimDir] = useState<"left" | "right" | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // per-card self-eval ratings (pre-seeded from server data)
  const [ratings, setRatings] = useState<Record<string, SelfEvalRating>>(() => {
    const map: Record<string, SelfEvalRating> = {}
    for (const c of cards) {
      if (c.user_card?.last_self_eval_rating) {
        map[c.id] = c.user_card.last_self_eval_rating as SelfEvalRating
      }
    }
    return map
  })

  // per-card starred state (pre-seeded from server data)
  const [starredIds, setStarredIds] = useState<Set<string>>(
    () => new Set(cards.filter(c => c.user_card?.is_starred).map(c => c.id))
  )

  const card = cards[index]
  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
        <p className="text-lg font-semibold">No cards available</p>
      </div>
    )
  }

  const currentRating = ratings[card.id] as SelfEvalRating | undefined
  const isStarred = starredIds.has(card.id)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  const goNext = () => {
    if (index >= cards.length - 1) return
    setAnimDir("right")
    setIndex(i => i + 1)
  }

  const goPrev = () => {
    if (index <= 0) return
    setAnimDir("left")
    setIndex(i => i - 1)
  }

  const handleRate = async (rating: SelfEvalRating) => {
    if (!isAuthed) { showToast("Sign in to save your progress"); return }
    if (saving) return
    setSaving(true)
    try {
      await fetch(`/api/cards/${card.id}/self-eval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ self_eval_rating: rating }),
      })
      setRatings(prev => ({ ...prev, [card.id]: rating }))
      goNext()
    } catch {
      showToast("Failed to save — check connection")
    } finally {
      setSaving(false)
    }
  }

  const handleStar = async () => {
    if (!isAuthed) { showToast("Sign in to star cards"); return }
    // optimistic update
    const willStar = !starredIds.has(card.id)
    setStarredIds(prev => {
      const next = new Set(prev)
      willStar ? next.add(card.id) : next.delete(card.id)
      return next
    })
    try {
      await fetch(`/api/cards/${card.id}/star`, { method: "POST" })
    } catch {
      // revert
      setStarredIds(prev => {
        const next = new Set(prev)
        willStar ? next.delete(card.id) : next.add(card.id)
        return next
      })
      showToast("Failed to save — check connection")
    }
  }

  const animClass =
    animDir === "right" ? "animate-slide-from-right" :
    animDir === "left"  ? "animate-slide-from-left"  : ""

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-sm font-medium text-gray-500 truncate max-w-[60%]">{deckName}</span>
        <span className="text-sm text-gray-400">
          {index + 1} / {cards.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mx-4 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-yellow-400 rounded-full transition-all duration-300"
          style={{ width: `${((index + 1) / cards.length) * 100}%` }}
        />
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-4 py-3 min-h-0">
        <div className="w-full">
          <div key={card.id} className={animClass}>
            <FlashCard
              word={card.word}
              definition={card.definition}
              part_of_speech={card.part_of_speech}
              pronunciation={card.pronunciation}
              example_sentences={card.example_sentences}
              isStarred={isStarred}
              onStar={handleStar}
              onSwipeLeft={goPrev}
              onSwipeRight={goNext}
              onSwipeUp={() => showToast("Writing Mode coming soon")}
            />
          </div>

          {/* Navigation row */}
          <div className="flex justify-between items-center mt-3 px-1">
            <button
              onClick={goPrev}
              disabled={index === 0}
              className="flex items-center gap-1 text-sm text-gray-400 disabled:opacity-20 active:text-gray-600 px-2 py-1"
            >
              ← prev
            </button>
            <span className="text-xs text-gray-300">swipe up for writing</span>
            <button
              onClick={goNext}
              disabled={index === cards.length - 1}
              className="flex items-center gap-1 text-sm text-gray-400 disabled:opacity-20 active:text-gray-600 px-2 py-1"
            >
              next →
            </button>
          </div>
        </div>
      </div>

      {/* Self-eval buttons — always visible, highlights current rating */}
      <div className="pb-5 pt-1 space-y-2">
        {!isAuthed && (
          <p className="text-center text-xs text-gray-400">Sign in to save progress</p>
        )}
        <SelfEvalButtons onRate={handleRate} disabled={saving} currentRating={currentRating} />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
