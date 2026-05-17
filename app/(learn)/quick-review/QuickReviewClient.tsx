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
  example_sentences: { sentence: string; context?: string }[] | null
  user_card: null | { srs_state: string; mastery_level: number; is_starred: boolean }
}

interface Props {
  cards: CardData[]
  deckName: string
  isAuthed: boolean
}

export default function QuickReviewClient({ cards, deckName, isAuthed }: Props) {
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [rated, setRated] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)

  const card = cards[index]
  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
        <p className="text-lg font-semibold">No cards available</p>
      </div>
    )
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  const goNext = () => setIndex(i => Math.min(i + 1, cards.length - 1))
  const goPrev = () => setIndex(i => Math.max(i - 1, 0))

  const handleRate = async (rating: SelfEvalRating) => {
    if (!isAuthed) {
      showToast("Sign in to save your progress")
      return
    }
    if (saving) return
    setSaving(true)

    try {
      await fetch(`/api/cards/${card.id}/self-eval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ self_eval_rating: rating }),
      })
      setRated(prev => new Set(prev).add(card.id))
      goNext()
    } catch {
      showToast("Failed to save — check connection")
    } finally {
      setSaving(false)
    }
  }

  const alreadyRated = rated.has(card.id)

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
      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full">
          <FlashCard
            word={card.word}
            definition={card.definition}
            part_of_speech={card.part_of_speech}
            example_sentences={card.example_sentences}
            onSwipeLeft={goPrev}
            onSwipeRight={goNext}
            onSwipeUp={() => showToast("Writing Mode coming soon")}
          />

          {/* Swipe hint */}
          <div className="flex justify-between mt-4 px-2 text-xs text-gray-300 select-none">
            <span>← prev</span>
            <span>swipe up for writing</span>
            <span>next →</span>
          </div>
        </div>
      </div>

      {/* Self-eval buttons */}
      <div className="pb-6 pt-2 space-y-3">
        {!isAuthed && (
          <p className="text-center text-xs text-gray-400">Sign in to save progress</p>
        )}
        {alreadyRated ? (
          <div className="flex justify-center gap-4 px-4">
            <button
              onClick={goPrev}
              disabled={index === 0}
              className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium disabled:opacity-30"
            >
              ← Back
            </button>
            <button
              onClick={goNext}
              disabled={index === cards.length - 1}
              className="flex-1 py-3 rounded-xl bg-yellow-400 text-white text-sm font-medium disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        ) : (
          <SelfEvalButtons onRate={handleRate} disabled={saving} />
        )}
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
