"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MasteryBar } from "@/components/ui/MasteryBar"
import type { SelfEvalRating } from "@/lib/types"

export interface DeckCard {
  id: string
  word: string
  definition: string
  part_of_speech: string | null
  pronunciation: string | null
  mastery_level: number | null
  is_starred: boolean | null
  last_self_eval_rating: SelfEvalRating | null
}

const RATING_META: Record<SelfEvalRating, { emoji: string; label: string }> = {
  dont_know: { emoji: "😵", label: "Don't know" },
  unsure:    { emoji: "🤔", label: "Unsure" },
  know:      { emoji: "😊", label: "Know it" },
  know_well: { emoji: "🤩", label: "Know well" },
}

type Filter = SelfEvalRating | "starred" | "all"

export function DeckDetailClient({
  deckId,
  cards,
}: {
  deckId: string
  cards: DeckCard[]
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>("all")

  const ratingsPresent = new Set(
    cards.filter(c => c.last_self_eval_rating).map(c => c.last_self_eval_rating!)
  )
  const hasStarred = cards.some(c => c.is_starred)

  const filtered =
    filter === "all"     ? cards :
    filter === "starred" ? cards.filter(c => c.is_starred) :
                           cards.filter(c => c.last_self_eval_rating === filter)

  function goToWriting() {
    const queue = cards.map(c => ({
      cardId: c.id,
      word: c.word,
      definition: c.definition,
      mastery: c.mastery_level ?? 0,
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

  return (
    <>
      {/* Mode buttons — half width each */}
      <div className="flex gap-3 mb-5">
        <a
          href={`/quick-review?deckId=${deckId}`}
          className="flex-1 flex items-center justify-center gap-2 py-4 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 text-sm font-bold rounded-2xl shadow-sm transition-all active:scale-95"
        >
          ⚡ Quick Review
        </a>
        <button
          onClick={goToWriting}
          disabled={cards.length === 0}
          className="flex-1 flex items-center justify-center gap-2 py-4 bg-white border-2 border-yellow-300 hover:bg-yellow-50 text-yellow-700 text-sm font-bold rounded-2xl shadow-sm transition-all active:scale-95 disabled:opacity-40"
        >
          ✏️ Writing
        </button>
      </div>

      {/* Filter chips */}
      {(ratingsPresent.size > 0 || hasStarred) && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
          <FilterChip
            label="All"
            active={filter === "all"}
            count={cards.length}
            onClick={() => setFilter("all")}
          />
          {(["dont_know", "unsure", "know", "know_well"] as SelfEvalRating[])
            .filter(r => ratingsPresent.has(r))
            .map(r => (
              <FilterChip
                key={r}
                label={`${RATING_META[r].emoji} ${RATING_META[r].label}`}
                active={filter === r}
                count={cards.filter(c => c.last_self_eval_rating === r).length}
                onClick={() => setFilter(r)}
              />
            ))}
          {hasStarred && (
            <FilterChip
              label="★ Starred"
              active={filter === "starred"}
              count={cards.filter(c => c.is_starred).length}
              onClick={() => setFilter("starred")}
            />
          )}
        </div>
      )}

      {/* Word list */}
      <div className="space-y-2">
        {filtered.map(card => (
          <button
            key={card.id}
            onClick={() => router.push(`/quick-review?deckId=${deckId}&startCardId=${card.id}`)}
            className="w-full flex items-center gap-4 bg-white rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md active:shadow-sm transition-shadow text-left"
          >
            {/* Left: word info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-semibold text-gray-800 text-base">{card.word}</span>
                {card.part_of_speech && (
                  <span className="text-xs text-yellow-500 font-medium uppercase tracking-wide">
                    {card.part_of_speech}
                  </span>
                )}
                {card.last_self_eval_rating && (
                  <span className="text-sm leading-none">
                    {RATING_META[card.last_self_eval_rating].emoji}
                  </span>
                )}
              </div>
              {card.pronunciation && (
                <p className="text-xs text-gray-400 mt-0.5">{card.pronunciation}</p>
              )}
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{card.definition}</p>
            </div>

            {/* Right: star (top) + mastery (middle) */}
            <div className="flex flex-col items-end justify-between self-stretch shrink-0 py-0.5">
              <span className={`text-base leading-none ${card.is_starred ? "text-yellow-400" : "invisible"}`}>
                ★
              </span>
              <MasteryBar level={card.mastery_level ?? 0} />
            </div>
          </button>
        ))}
      </div>
    </>
  )
}

function FilterChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string
  active: boolean
  count: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
        active
          ? "bg-yellow-400 text-yellow-900 shadow-sm"
          : "bg-white text-gray-500 border border-gray-200 hover:border-yellow-300"
      }`}
    >
      {label}
      <span className={active ? "text-yellow-800" : "text-gray-400"}>({count})</span>
    </button>
  )
}
