"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signOut } from "next-auth/react"
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
    mastery_level: number
    is_starred: boolean
    last_self_eval_rating: string | null
  }
}

interface Props {
  cards: CardData[]
  deckName: string
  isAuthed: boolean
  backHref?: string
}

function MasteryDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className={`text-base ${i < level ? "opacity-100" : "opacity-20"}`}>🎖️</span>
      ))}
    </div>
  )
}

export default function QuickReviewClient({ cards, deckName, isAuthed, backHref = "/decks" }: Props) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false)

  // Writing 완료 후 돌아올 때 stale 캐시 제거 → 서버에서 최신 mastery 재로드
  useEffect(() => {
    if (sessionStorage.getItem("writing_completed")) {
      sessionStorage.removeItem("writing_completed")
      router.refresh()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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

  const goToWriting = (fromIndex: number) => {
    const queue = cards.slice(fromIndex).map(c => ({
      cardId: c.id,
      word: c.word,
      definition: c.definition,
      mastery: c.user_card?.mastery_level ?? 0,
    }))
    sessionStorage.setItem("writingQueue", JSON.stringify(queue))
    const first = queue[0]
    const params = new URLSearchParams({
      cardId: first.cardId,
      word: first.word,
      definition: first.definition,
      mastery: String(first.mastery),
    })
    router.push(`/writing?${params}`)
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
    if (!isAuthed) { showToast("Guest mode: sign in to save progress"); return }
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
    if (!isAuthed) { showToast("Guest mode: sign in to save progress"); return }
    // optimistic update
    const willStar = !starredIds.has(card.id)
    setStarredIds(prev => {
      const next = new Set(prev)
      if (willStar) { next.add(card.id) } else { next.delete(card.id) }
      return next
    })
    try {
      await fetch(`/api/cards/${card.id}/star`, { method: "POST" })
    } catch {
      // revert
      setStarredIds(prev => {
        const next = new Set(prev)
        if (willStar) { next.delete(card.id) } else { next.add(card.id) }
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
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => router.push(backHref)}
          className="text-gray-400 hover:text-gray-600 active:scale-90 transition-transform p-1 -ml-1"
          aria-label="Back to decks"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-base leading-tight truncate">{deckName}</p>
          <p className="text-xs text-gray-400">{index + 1} / {cards.length}</p>
        </div>

        <div className="shrink-0">
          {isAuthed ? (
            <button
              onClick={() => signOut({ redirectTo: "/login" })}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className="text-xs font-medium text-yellow-600 hover:text-yellow-700 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mx-4 mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-yellow-400 rounded-full transition-all duration-300"
          style={{ width: `${((index + 1) / cards.length) * 100}%` }}
        />
      </div>

      {/* Card area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-3 min-h-0">
        {/* Card + side arrows */}
        <div className="w-full relative">
          {/* Left arrow */}
          <button
            onClick={goPrev}
            disabled={index === 0}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10
                       w-10 h-10 flex items-center justify-center
                       bg-white hover:bg-yellow-50 rounded-full shadow-md
                       text-gray-400 hover:text-yellow-500
                       disabled:opacity-20 disabled:cursor-not-allowed
                       transition-all duration-150 hover:scale-110 active:scale-95"
            aria-label="Previous card"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {/* Card */}
          <div key={card.id} className={`${animClass} px-12`}>
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
              onSwipeUp={() => goToWriting(index)}
            />
          </div>

          {/* Right arrow */}
          <button
            onClick={goNext}
            disabled={index === cards.length - 1}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10
                       w-10 h-10 flex items-center justify-center
                       bg-white hover:bg-yellow-50 rounded-full shadow-md
                       text-gray-400 hover:text-yellow-500
                       disabled:opacity-20 disabled:cursor-not-allowed
                       transition-all duration-150 hover:scale-110 active:scale-95"
            aria-label="Next card"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Mastery dots */}
        {isAuthed && (
          <div className="mt-4 mb-1">
            <MasteryDots level={card.user_card?.mastery_level ?? 0} />
          </div>
        )}

        {/* Write button */}
        <button
          onClick={() => goToWriting(index)}
          className="mt-5 flex items-center gap-2 px-6 py-2.5
                     bg-yellow-400 hover:bg-yellow-500
                     text-yellow-900 text-sm font-semibold
                     rounded-full shadow-sm animate-pulse-glow
                     transition-all duration-150 hover:scale-105 hover:shadow-md active:scale-95"
        >
          ✏️ Write it!
        </button>
      </div>

      {/* Self-eval buttons — always visible, highlights current rating */}
      <div className="pb-5 pt-1">
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
