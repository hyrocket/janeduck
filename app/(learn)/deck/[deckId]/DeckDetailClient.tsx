"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MasteryBar } from "@/components/ui/MasteryBar"
import { CardEditSheet, type CardFormValues } from "@/components/cards/CardEditSheet"
import { DeckInfoEditSheet } from "@/components/cards/DeckInfoEditSheet"
import { DeckIconPicker } from "@/components/cards/DeckIconPicker"
import { BulkImportSheet } from "@/components/cards/BulkImportSheet"
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

interface DeckInfo {
  id: string
  name: string
  description: string | null
  level: number
  card_count: number
  icon: string | null
}

const LEVEL_GRADIENT = [
  "from-sky-400 to-blue-500",
  "from-violet-400 to-purple-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-red-500",
]
const LEVEL_EMOJI = ["📗", "📘", "📙", "📕"]

const RATING_META: Record<SelfEvalRating, { emoji: string; label: string }> = {
  dont_know: { emoji: "😵", label: "Don't know" },
  unsure:    { emoji: "🤔", label: "Unsure" },
  know:      { emoji: "😊", label: "Know it" },
  know_well: { emoji: "🤩", label: "Know well" },
}

type Filter = SelfEvalRating | "starred" | "all"
type CardSheetState = { mode: "add" } | { mode: "edit"; card: DeckCard } | null

export function DeckDetailClient({
  deck,
  cards,
  isOwner,
}: {
  deck: DeckInfo
  cards: DeckCard[]
  isOwner: boolean
}) {
  const router = useRouter()
  const [filter, setFilter]         = useState<Filter>("all")
  const [editMode, setEditMode]     = useState(false)
  const [cardSheet, setCardSheet]   = useState<CardSheetState>(null)
  const [infoSheet, setInfoSheet]   = useState(false)
  const [iconPicker, setIconPicker]   = useState(false)
  const [currentIcon, setCurrentIcon] = useState<string | null>(deck.icon)
  const [bulkSheet, setBulkSheet]     = useState(false)

  // Progress computed from cards already fetched
  const studied  = cards.filter(c => c.mastery_level !== null).length
  const mastered = cards.filter(c => (c.mastery_level ?? 0) >= 5).length
  const pct      = deck.card_count > 0 ? Math.round((studied / deck.card_count) * 100) : 0

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

  function handleCardSaved() {
    setCardSheet(null)
    router.refresh()
  }

  function handleInfoSaved() {
    setInfoSheet(false)
    router.refresh()
  }

  const cardSheetInitial: CardFormValues | null =
    cardSheet?.mode === "edit"
      ? {
          id: cardSheet.card.id,
          word: cardSheet.card.word,
          definition: cardSheet.card.definition,
          part_of_speech: cardSheet.card.part_of_speech,
          pronunciation: cardSheet.card.pronunciation,
          example_sentences: null,
          collocations: null,
          starter_templates: null,
          topic_hints: null,
        }
      : null

  return (
    <>
      {/* ── Back nav + Deck header ── */}
      <div className="mb-5">
        {/* Row: ← | [icon + text block] | [+][✏] */}
        <div className="flex items-start gap-2">
          {/* Back arrow — aligned to top of icon */}
          <Link
            href="/decks"
            className="mt-2 text-gray-400 hover:text-gray-600 active:scale-90 transition-transform p-1 -ml-1 shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>

          {/* Icon */}
          <button
            onClick={isOwner ? () => setIconPicker(true) : undefined}
            disabled={!isOwner}
            className={`relative shrink-0 w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center shadow-sm ${isOwner ? "active:scale-90 transition-transform" : ""}`}
            aria-label={isOwner ? "Change deck icon" : undefined}
          >
            {currentIcon?.startsWith("data:") ? (
              <img src={currentIcon} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full flex items-center justify-center text-2xl bg-gradient-to-br ${LEVEL_GRADIENT[deck.level % LEVEL_GRADIENT.length]}`}>
                {currentIcon ?? LEVEL_EMOJI[deck.level % LEVEL_EMOJI.length]}
              </div>
            )}
          </button>

          {/* Text block: title + description + progress — all aligned to icon right edge */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold text-gray-800 leading-tight truncate">{deck.name}</h2>
              {editMode && (
                <button onClick={() => setInfoSheet(true)} className="shrink-0 p-0.5 text-gray-400 hover:text-yellow-500 transition-colors" aria-label="Edit deck info">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Description */}
            <div className="flex items-center gap-1 mt-0.5">
              {deck.description ? (
                <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{deck.description}</p>
              ) : editMode ? (
                <button onClick={() => setInfoSheet(true)} className="text-xs text-gray-300 hover:text-yellow-500 transition-colors">
                  + Add description
                </button>
              ) : null}
              {editMode && deck.description && (
                <button onClick={() => setInfoSheet(true)} className="shrink-0 p-0.5 text-gray-300 hover:text-yellow-500 transition-colors">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Progress */}
            {studied > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{studied} / {deck.card_count}</span>
                </div>
                {mastered > 0 && <p className="text-xs text-yellow-500">🎖️ {mastered} mastered</p>}
              </div>
            )}
          </div>

          {/* Owner actions */}
          {isOwner && (
            <div className="flex items-center gap-1 shrink-0 mt-1">
              <button
                onClick={() => setCardSheet({ mode: "add" })}
                className="p-2 rounded-xl text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 transition-all"
                aria-label="Add word"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="18" rx="2" ry="2" />
                  <path d="M12 8v8M8 12h8" strokeWidth="2.5" />
                </svg>
              </button>
              <button
                onClick={() => setEditMode(v => !v)}
                className={`p-2 rounded-xl transition-all ${
                  editMode ? "bg-yellow-400 text-yellow-900" : "text-gray-400 hover:text-yellow-600 hover:bg-yellow-50"
                }`}
                aria-label="Toggle edit mode"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Mode buttons ── */}
      <div className="flex gap-3 mb-5">
        <a
          href={`/quick-review?deckId=${deck.id}`}
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

      {/* ── Filter chips ── */}
      {(ratingsPresent.size > 0 || hasStarred) && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
          <FilterChip label="All" active={filter === "all"} count={cards.length} onClick={() => setFilter("all")} />
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

      {/* ── Card list ── */}
      <div className="space-y-2">
        {filtered.map(card => (
          <div key={card.id} className="flex items-stretch gap-2">
            {/* Main card button */}
            <button
              onClick={() => router.push(`/quick-review?deckId=${deck.id}&startCardId=${card.id}`)}
              className="flex-1 flex items-center gap-4 bg-white rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md active:shadow-sm transition-shadow text-left min-w-0"
            >
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
              <div className="flex flex-col items-end justify-between self-stretch shrink-0 py-0.5">
                <span className={`text-base leading-none ${card.is_starred ? "text-yellow-400" : "invisible"}`}>★</span>
                <MasteryBar level={card.mastery_level ?? 0} />
              </div>
            </button>

            {/* Edit button — visible only in editMode */}
            {isOwner && editMode && (
              <button
                onClick={() => setCardSheet({ mode: "edit", card })}
                className="shrink-0 flex items-center justify-center w-12 bg-white rounded-2xl shadow-sm hover:bg-yellow-50 hover:shadow-md active:shadow-sm transition-all text-gray-400 hover:text-yellow-600"
                aria-label="Edit card"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Add Word (bottom) — always visible when owner ── */}
      {isOwner && (
        <div className="mt-6">
          <button
            onClick={() => setCardSheet({ mode: "add" })}
            className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-yellow-300 rounded-2xl text-yellow-600 text-sm font-semibold hover:bg-yellow-50 hover:border-yellow-400 transition-all active:scale-95"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Word
          </button>
        </div>
      )}

      {/* ── Sheets ── */}
      {iconPicker && (
        <DeckIconPicker
          deckId={deck.id}
          currentIcon={currentIcon}
          level={deck.level}
          onClose={() => setIconPicker(false)}
          onSaved={(icon) => { setCurrentIcon(icon); setIconPicker(false) }}
        />
      )}
      {infoSheet && (
        <DeckInfoEditSheet
          deckId={deck.id}
          initial={{ name: deck.name, description: deck.description }}
          onClose={() => setInfoSheet(false)}
          onSaved={handleInfoSaved}
        />
      )}
      {bulkSheet && (
        <BulkImportSheet
          deckId={deck.id}
          onClose={() => setBulkSheet(false)}
          onImported={() => { setBulkSheet(false); router.refresh() }}
        />
      )}
      {cardSheet && (
        <CardEditSheet
          deckId={deck.id}
          initial={cardSheetInitial}
          onClose={() => setCardSheet(null)}
          onSaved={handleCardSaved}
          onSwitchToBulk={cardSheet.mode === "add" ? () => { setCardSheet(null); setBulkSheet(true) } : undefined}
        />
      )}
    </>
  )
}

function FilterChip({ label, active, count, onClick }: { label: string; active: boolean; count: number; onClick: () => void }) {
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
