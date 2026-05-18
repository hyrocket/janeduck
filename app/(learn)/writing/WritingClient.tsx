"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

// ── Types ─────────────────────────────────────────────────────

type ScaffoldLevel = "high" | "medium" | "low"
type WritingRating = "again" | "hard" | "good" | "easy"
type UserAction = "try_again" | "master_challenge" | "next_word"
type Phase =
  | "loading"
  | "awaiting_input"
  | "submitting"
  | "awaiting_action"
  | "action_pending"
  | "done"
  | "all_done"

interface CardData {
  cardId: string
  word: string
  definition: string
  mastery: number
}

interface PromptCtx {
  scaffold: ScaffoldLevel
  is_master_challenge: boolean
  starter_used: string | null
  topic_hint: string | null
  topic_used: string | null
  structure_guide_used: string | null
}

interface FeedbackData {
  overall_score: number
  writing_rating: WritingRating
  target_word_used: boolean
  target_word_used_correctly: boolean
  chat_message: string
  strengths: string[]
  weakness_signals: string[]
  suggested_actions: UserAction[]
  // populated when update_srs_mastery is real:
  mastery_level_before?: number
  mastery_level_after?: number
}

type ChatMsg =
  | { id: string; kind: "intro"; text: string }
  | { id: string; kind: "prompt"; ctx: PromptCtx; word: string }
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "feedback"; data: FeedbackData }

interface Props {
  cardId: string
  word: string
  definition: string
  mastery: number
  userId: string | null
  sessionId: string | null
}

// ── Sub-components ────────────────────────────────────────────

const SCAFFOLD_LABEL: Record<ScaffoldLevel, string> = {
  high:   "Guided Writing",
  medium: "Practice Writing",
  low:    "Extended Writing",
}

const SCAFFOLD_COLOR: Record<ScaffoldLevel, string> = {
  high:   "bg-yellow-100 text-yellow-700",
  medium: "bg-blue-100 text-blue-700",
  low:    "bg-purple-100 text-purple-700",
}

const RATING_STYLE: Record<WritingRating, { bg: string; label: string }> = {
  again: { bg: "bg-red-100 text-red-600",       label: "Keep practicing" },
  hard:  { bg: "bg-orange-100 text-orange-600",  label: "Getting there" },
  good:  { bg: "bg-green-100 text-green-700",    label: "Well done" },
  easy:  { bg: "bg-emerald-100 text-emerald-700", label: "Excellent" },
}

function DuckAvatar() {
  return (
    <div className="w-11 h-11 rounded-full shrink-0 shadow-sm overflow-hidden">
      <Image src="/duck-avatar.png" alt="JaneDuck" width={44} height={44} className="w-full h-full object-cover" />
    </div>
  )
}

function IntroBubble({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[85%]">
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  )
}

function MasteryDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`text-xs leading-none transition-opacity duration-300 ${
            i < level ? "opacity-100" : "opacity-20"
          }`}
        >
          🎖️
        </span>
      ))}
    </div>
  )
}

function PromptBubble({ ctx, word }: { ctx: PromptCtx; word: string }) {
  return (
    <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[85%] space-y-2">
      {ctx.is_master_challenge && (
        <div className="flex items-center gap-1.5 text-purple-600 text-xs font-semibold">
          <span>🚀</span> {SCAFFOLD_LABEL[ctx.scaffold]}
        </div>
      )}

      {ctx.scaffold === "high" && ctx.starter_used && (
        <>
          <p className="text-xs text-gray-400 font-medium">Complete this sentence:</p>
          <p className="text-sm text-gray-800 font-medium leading-relaxed bg-yellow-50 rounded-lg px-3 py-2 border border-yellow-100">
            {ctx.starter_used}
          </p>
          <p className="text-xs text-gray-400">Fill in the blank with a phrase or clause.</p>
        </>
      )}

      {ctx.scaffold === "medium" && (
        <>
          <p className="text-sm text-gray-700 leading-relaxed">
            Write a sentence using{" "}
            <span className="font-semibold text-yellow-600">&ldquo;{word}&rdquo;</span>.
          </p>
          {ctx.topic_hint && (
            <p className="text-xs text-gray-400">
              Topic: <span className="text-gray-600 font-medium">{ctx.topic_hint}</span>
            </p>
          )}
        </>
      )}

      {ctx.scaffold === "low" && (
        <>
          <p className="text-sm text-gray-700 leading-relaxed">
            Write <span className="font-semibold">exactly 2 connected sentences</span> using{" "}
            <span className="font-semibold text-yellow-600">&ldquo;{word}&rdquo;</span>.
          </p>
          {ctx.topic_used && (
            <p className="text-xs text-gray-400">
              Topic: <span className="text-gray-600 font-medium">{ctx.topic_used}</span>
            </p>
          )}
          {ctx.structure_guide_used && (
            <p className="text-xs text-gray-400">
              2nd sentence should:{" "}
              <span className="text-gray-600 font-medium">{ctx.structure_guide_used}</span>
            </p>
          )}
        </>
      )}
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="bg-yellow-400 rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm max-w-[85%]">
      <p className="text-sm text-yellow-900 leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  )
}

const NEXT_MODE_LABEL: Record<ScaffoldLevel, string | null> = {
  high:   "Next Challenge →",
  medium: "Next Challenge →",
  low:    null,
}

function FeedbackBubble({
  data,
  isActive,
  onAction,
  scaffold,
}: {
  data: FeedbackData
  isActive: boolean
  onAction: (a: UserAction) => void
  scaffold: ScaffoldLevel
}) {
  const rStyle = RATING_STYLE[data.writing_rating]

  return (
    <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[85%] space-y-3">
      {/* Score row */}
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${rStyle.bg}`}>
          {rStyle.label}
        </span>
        <span className="text-xs text-gray-400">{data.overall_score}/10</span>
        {!data.target_word_used && (
          <span className="text-xs text-red-400 font-medium">Word not used</span>
        )}
      </div>

      {/* Chat message */}
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{data.chat_message}</p>

      {/* Strengths */}
      {data.strengths.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.strengths.map((s, i) => (
            <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">
              ✓ {s}
            </span>
          ))}
        </div>
      )}

      {/* Weakness signals */}
      {data.weakness_signals.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.weakness_signals.map((w, i) => (
            <span key={i} className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-100">
              → {w}
            </span>
          ))}
        </div>
      )}

      {/* Mastery up (placeholder — fires when update_srs_mastery is real) */}
      {data.mastery_level_after != null &&
        data.mastery_level_before != null &&
        data.mastery_level_after > data.mastery_level_before && (
          <MasteryBadge from={data.mastery_level_before} to={data.mastery_level_after} />
        )}

      {/* Action buttons */}
      {isActive && (
        <div className="flex flex-wrap gap-2 pt-1">
          {data.suggested_actions.map(action => {
            if (action === "master_challenge") {
              const label = NEXT_MODE_LABEL[scaffold]
              if (!label) return null
              return <ActionButton key={action} action={action} onAction={onAction} label={label} />
            }
            return <ActionButton key={action} action={action} onAction={onAction} />
          })}
        </div>
      )}
    </div>
  )
}

function MasteryBadge({ from, to }: { from: number; to: number }) {
  return (
    <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
      <span className="text-lg">🎖️</span>
      <div>
        <p className="text-xs font-semibold text-yellow-700">Mastery up!</p>
        <p className="text-xs text-yellow-600">
          Level {from} → {to}
        </p>
      </div>
    </div>
  )
}

function ActionButton({ action, onAction, label }: { action: UserAction; onAction: (a: UserAction) => void; label?: string }) {
  const styles: Record<UserAction, string> = {
    try_again:        "bg-yellow-400 hover:bg-yellow-500 text-yellow-900 active:scale-95",
    master_challenge: "bg-purple-500 hover:bg-purple-600 text-white active:scale-95",
    next_word:        "bg-gray-100 hover:bg-gray-200 text-gray-600 active:scale-95",
  }
  const defaultLabels: Record<UserAction, string> = {
    try_again:        "↩ Try Again",
    master_challenge: "Next Challenge →",
    next_word:        "Next Word →",
  }

  return (
    <button
      onClick={() => onAction(action)}
      className={`text-sm font-medium px-4 py-2 rounded-xl transition-all duration-100 ${styles[action]}`}
    >
      {label ?? defaultLabels[action]}
    </button>
  )
}

function ThinkingBubble() {
  return (
    <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[85%]">
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function WritingClient({ cardId, word, definition, mastery, userId, sessionId }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("loading")
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [draft, setDraft] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const [currentScaffold, setCurrentScaffold] = useState<ScaffoldLevel>("high")
  const [error, setError] = useState<string | null>(null)
  const [card, setCard] = useState<CardData>({ cardId, word, definition, mastery })
  const [toast, setToast] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const startedRef = useRef(false)

  const isGuest = !userId

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    startSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, phase])

  useEffect(() => {
    if (phase === "awaiting_input") {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [phase])

  // Pre-fill textarea with starter prefix when a high scaffold prompt arrives
  useEffect(() => {
    if (messages.length === 0) return
    const last = messages[messages.length - 1]
    if (
      last.kind === "prompt" &&
      last.ctx.scaffold === "high" &&
      last.ctx.starter_used?.includes("___")
    ) {
      const prefix = last.ctx.starter_used.split("___")[0].trimEnd()
      setDraft(prefix + " ")
    }
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync textarea height when draft is set programmatically
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }, [draft])

  function addMessage(msg: ChatMsg) {
    setMessages(prev => [...prev, msg])
  }

  async function startSession(c?: CardData) {
    const active = c ?? card
    setPhase("loading")
    setError(null)
    try {
      const res = await fetch("/api/writing/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_id: active.cardId,
          word:    active.word,
          definition: active.definition,
          user_id: userId,
          session_id: sessionId,
          mastery_level: active.mastery,
        }),
      })
      if (!res.ok) throw new Error("Failed to start writing session")
      const data = await res.json()

      // First-encounter intro (introduce_word node, only when writing_attempts_count == 0)
      if (data.introduce_message) {
        addMessage({ id: `intro-${Date.now()}`, kind: "intro", text: data.introduce_message })
      }

      const ctx: PromptCtx = {
        scaffold:             data.scaffold,
        is_master_challenge:  data.is_master_challenge ?? false,
        starter_used:         data.starter_used ?? null,
        topic_hint:           data.topic_hint ?? null,
        topic_used:           data.topic_used ?? null,
        structure_guide_used: data.structure_guide_used ?? null,
      }
      setThreadId(data.thread_id)
      setCurrentScaffold(data.scaffold ?? "high")
      addMessage({ id: `prompt-${Date.now()}`, kind: "prompt", ctx, word: active.word })
      setPhase("awaiting_input")
    } catch {
      setError("Couldn't connect to JaneDuck. Is the Python server running?")
      setPhase("loading")
    }
  }

  function startNextCard() {
    try {
      const raw = sessionStorage.getItem("writingQueue")
      if (!raw) { setPhase("all_done"); return }
      const queue: CardData[] = JSON.parse(raw)
      const remaining = queue.slice(1)
      if (remaining.length === 0) {
        sessionStorage.removeItem("writingQueue")
        setPhase("all_done")
        return
      }
      const next = remaining[0]
      sessionStorage.setItem("writingQueue", JSON.stringify(remaining))
      setMessages([])
      setDraft("")
      setValidationError(null)
      setError(null)
      setCard(next)
      startSession(next)
    } catch {
      setPhase("all_done")
    }
  }

  async function handleSubmit() {
    if (!draft.trim() || !threadId || phase !== "awaiting_input") return
    const userText = draft.trim()
    setDraft("")
    setValidationError(null)
    addMessage({ id: `user-${Date.now()}`, kind: "user", text: userText })
    setPhase("submitting")

    try {
      const res = await fetch("/api/writing/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, user_text: userText }),
      })
      const data = await res.json()
      if (!res.ok) {
        const detail = data?.detail?.error ?? data?.error ?? JSON.stringify(data)
        throw new Error(`Submit failed (${res.status}): ${detail}`)
      }

      if (data.status === "awaiting_user_text") {
        // validation rejected — show error and re-open input
        setValidationError(data.validation_error ?? "Please try again.")
        setDraft(userText)
        setPhase("awaiting_input")
        return
      }

      const feedbackData: FeedbackData = {
        overall_score:             data.overall_score,
        writing_rating:            data.writing_rating,
        target_word_used:          data.target_word_used,
        target_word_used_correctly: data.target_word_used_correctly,
        chat_message:              data.chat_message,
        strengths:                 data.strengths ?? [],
        weakness_signals:          data.weakness_signals ?? [],
        suggested_actions:         data.suggested_actions ?? ["next_word"],
        mastery_level_before:      data.mastery_level_before,
        mastery_level_after:       data.mastery_level_after,
      }
      addMessage({ id: `feedback-${Date.now()}`, kind: "feedback", data: feedbackData })
      if (data.mastery_level_after != null) {
        setCard(prev => ({ ...prev, mastery: data.mastery_level_after as number }))
      }
      if (isGuest) showToast("Guest mode — sign in to save your progress")
      setPhase("awaiting_action")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong."
      setError(msg)
      setDraft(userText)
      setPhase("awaiting_input")
    }
  }

  async function handleAction(action: UserAction) {
    if (!threadId) return
    setPhase("action_pending")

    try {
      const res = await fetch("/api/writing/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, action }),
      })
      if (!res.ok) throw new Error("Action failed")
      const data = await res.json()

      if (data.status === "done") {
        startNextCard()
        return
      }

      // try_again or master_challenge — new prompt
      const ctx: PromptCtx = {
        scaffold:             data.scaffold,
        is_master_challenge:  data.is_master_challenge ?? false,
        starter_used:         data.starter_used ?? null,
        topic_hint:           data.topic_hint ?? null,
        topic_used:           data.topic_used ?? null,
        structure_guide_used: data.structure_guide_used ?? null,
      }
      setCurrentScaffold(data.scaffold ?? currentScaffold)
      addMessage({ id: `prompt-${Date.now()}`, kind: "prompt", ctx, word: card.word })
      setPhase("awaiting_input")
    } catch {
      setError("Something went wrong.")
      setPhase("awaiting_action")
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const isLastMsg = (i: number) => i === messages.length - 1

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 active:scale-90 transition-transform p-1 -ml-1"
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-base leading-tight truncate">{card.word}</p>
          <p className="text-xs text-gray-400 truncate">{card.definition}</p>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${SCAFFOLD_COLOR[currentScaffold]}`}>
            {SCAFFOLD_LABEL[currentScaffold]}
          </span>
          {isGuest
            ? <span className="text-xs text-gray-400">Guest</span>
            : <MasteryDots level={card.mastery} />}
        </div>
      </div>

      {/* ── Chat window ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Loading state */}
        {phase === "loading" && !error && (
          <div className="flex items-start gap-2">
            <DuckAvatar />
            <ThinkingBubble />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-red-500 text-center">{error}</p>
            <button
              onClick={() => startSession()}
              className="text-sm font-medium text-yellow-600 bg-yellow-50 px-4 py-2 rounded-xl hover:bg-yellow-100 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={msg.id}>
            {msg.kind === "intro" && (
              <div className="flex items-start gap-2">
                <DuckAvatar />
                <IntroBubble text={msg.text} />
              </div>
            )}

            {msg.kind === "prompt" && (
              <div className="flex items-start gap-2">
                <DuckAvatar />
                <PromptBubble ctx={msg.ctx} word={msg.word} />
              </div>
            )}

            {msg.kind === "user" && (
              <div className="flex justify-end">
                <UserBubble text={msg.text} />
              </div>
            )}

            {msg.kind === "feedback" && (
              <div className="flex items-start gap-2">
                <DuckAvatar />
                <FeedbackBubble
                  data={msg.data}
                  isActive={phase === "awaiting_action" && isLastMsg(i)}
                  onAction={handleAction}
                  scaffold={currentScaffold}
                />
              </div>
            )}
          </div>
        ))}

        {/* Thinking indicator while submitting */}
        {phase === "submitting" && (
          <div className="flex items-start gap-2">
            <DuckAvatar />
            <ThinkingBubble />
          </div>
        )}

        {/* Action pending indicator */}
        {phase === "action_pending" && (
          <div className="flex items-start gap-2">
            <DuckAvatar />
            <ThinkingBubble />
          </div>
        )}

        {/* All done — queue exhausted */}
        {phase === "all_done" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex items-start gap-2 w-full">
              <DuckAvatar />
              <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <p className="text-sm text-gray-700">
                  Amazing work today! You&apos;ve written all your words. See you next time. 🦆
                </p>
              </div>
            </div>
            <button
              onClick={() => router.back()}
              className="mt-2 text-sm font-medium text-yellow-600 bg-yellow-50 px-5 py-2.5 rounded-xl hover:bg-yellow-100 active:scale-95 transition-all"
            >
              ← Back to cards
            </button>
          </div>
        )}

        <div ref={bottomRef} className="h-2" />
      </div>

      {/* ── Input area ──────────────────────────────────────── */}
      {phase === "awaiting_input" && (
        <div className="bg-white border-t border-gray-100 px-4 py-3 shadow-[0_-1px_3px_rgba(0,0,0,0.04)]">
          {validationError && (
            <p className="text-xs text-red-500 mb-2 px-1">{validationError}</p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => {
                setDraft(e.target.value)
                e.target.style.height = "auto"
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
              }}
              onKeyDown={handleKeyDown}
              placeholder={`Write your sentence using "${card.word}"…`}
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 transition-colors leading-relaxed overflow-hidden"
              style={{ minHeight: "44px", maxHeight: "120px" }}
            />
            <button
              onClick={handleSubmit}
              disabled={!draft.trim()}
              className="shrink-0 w-11 h-11 rounded-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-100 disabled:text-gray-300 text-yellow-900 flex items-center justify-center active:scale-90 transition-all duration-100 shadow-sm"
              aria-label="Send"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-300 mt-1.5 px-1">Enter to send · Shift+Enter for new line</p>
        </div>
      )}

      {/* Guest toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-5 py-2.5 rounded-full shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
