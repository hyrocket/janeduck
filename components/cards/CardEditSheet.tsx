"use client"

import { useState, useEffect, useRef } from "react"

export interface CardFormValues {
  id?: string
  word: string
  definition: string
  part_of_speech: string | null
  pronunciation: string | null
  example_sentences: { sentence: string; context: string }[] | null
  collocations: string[] | null
  starter_templates: string[] | null
  topic_hints: string[] | null
}

const POS_OPTIONS = ["adj", "noun", "verb", "adv", "phrase"] as const

interface Props {
  deckId: string
  initial?: CardFormValues | null
  onClose: () => void
  onSaved: (historyReset?: boolean) => void
}

export function CardEditSheet({ deckId, initial, onClose, onSaved }: Props) {
  const isEdit = !!initial?.id
  const wordRef = useRef<HTMLInputElement>(null)

  const [word, setWord]       = useState(initial?.word ?? "")
  const [definition, setDef]  = useState(initial?.definition ?? "")
  const [pos, setPos]         = useState<string | null>(initial?.part_of_speech ?? null)
  const [pronunciation, setPronunciation] = useState(initial?.pronunciation ?? "")

  // AI-generated hidden fields (not shown directly, sent on save)
  const [aiMeta, setAiMeta] = useState<{
    example_sentences?: { sentence: string; context: string }[]
    collocations?: string[]
    starter_templates?: string[]
    topic_hints?: string[]
  } | null>(initial ? {
    example_sentences: initial.example_sentences ?? undefined,
    collocations: initial.collocations ?? undefined,
    starter_templates: initial.starter_templates ?? undefined,
    topic_hints: initial.topic_hints ?? undefined,
  } : null)

  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    wordRef.current?.focus()
  }, [])

  async function handleGenerate() {
    const w = word.trim()
    const d = definition.trim()
    if (!w || !d) { setError("Enter word and definition first."); return }
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/card-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: w, definition: d }),
      })
      if (!res.ok) throw new Error("AI generation failed")
      const meta = await res.json()
      if (meta.pronunciation && !pronunciation) setPronunciation(meta.pronunciation)
      setAiMeta({
        example_sentences: meta.example_sentences,
        collocations: meta.collocations,
        starter_templates: meta.starter_templates,
        topic_hints: meta.topic_hints,
      })
    } catch {
      setError("AI generation failed. Try again.")
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    const w = word.trim()
    const d = definition.trim()
    if (!w || !d) { setError("Word and definition are required."); return }
    setSaving(true)
    setError(null)

    const payload = {
      word: w,
      definition: d,
      part_of_speech: pos,
      pronunciation: pronunciation.trim() || null,
      example_sentences: aiMeta?.example_sentences ?? null,
      collocations: aiMeta?.collocations ?? null,
      starter_templates: aiMeta?.starter_templates ?? null,
      topic_hints: aiMeta?.topic_hints ?? null,
    }

    try {
      if (isEdit && initial?.id) {
        const res = await fetch(`/api/cards/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        onSaved(data.history_reset)
      } else {
        const res = await fetch(`/api/decks/${deckId}/cards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error()
        onSaved(false)
      }
    } catch {
      setError("Failed to save. Please try again.")
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initial?.id) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/cards/${initial.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      onSaved(false)
    } catch {
      setError("Failed to delete. Please try again.")
      setDeleting(false)
    }
  }

  const canSave = word.trim() && definition.trim() && !saving && !deleting

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="max-w-lg mx-auto px-5 pt-5 pb-8">
          {/* Handle */}
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

          {/* Title */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-800">
              {isEdit ? "Edit Word" : "Add Word"}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Required fields */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Word <span className="text-yellow-500">*</span>
              </label>
              <input
                ref={wordRef}
                type="text"
                value={word}
                onChange={e => setWord(e.target.value)}
                placeholder="e.g. reluctant"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 outline-none text-base font-medium text-gray-800 placeholder-gray-300 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Definition <span className="text-yellow-500">*</span>
              </label>
              <textarea
                value={definition}
                onChange={e => setDef(e.target.value)}
                placeholder="e.g. unwilling to do something"
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 outline-none text-sm text-gray-800 placeholder-gray-300 resize-none transition"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">Optional</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Optional fields */}
          <div className="space-y-4 mb-6">
            {/* Part of speech */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Part of Speech
              </label>
              <div className="flex flex-wrap gap-2">
                {POS_OPTIONS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPos(pos === p ? null : p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      pos === p
                        ? "bg-yellow-400 text-yellow-900 shadow-sm"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Pronunciation */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Pronunciation
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pronunciation}
                  onChange={e => setPronunciation(e.target.value)}
                  placeholder="/rɪˈlʌktənt/"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 outline-none text-sm text-gray-700 placeholder-gray-300 transition font-mono"
                />
              </div>
            </div>
          </div>

          {/* AI Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !word.trim() || !definition.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-yellow-300 text-yellow-600 text-sm font-semibold hover:bg-yellow-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all mb-6"
          >
            {generating ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                ✨ {aiMeta ? "Regenerate AI fields" : "Generate AI fields"}
              </>
            )}
          </button>

          {/* AI meta preview */}
          {aiMeta && (
            <div className="bg-yellow-50 rounded-2xl px-4 py-3 mb-6 space-y-2">
              <p className="text-xs font-semibold text-yellow-700 mb-2">AI-generated fields</p>
              {aiMeta.example_sentences?.slice(0, 2).map((ex, i) => (
                <p key={i} className="text-xs text-gray-600 italic">&ldquo;{ex.sentence}&rdquo;</p>
              ))}
              {aiMeta.collocations && (
                <p className="text-xs text-gray-500">Collocations: {aiMeta.collocations.join(" · ")}</p>
              )}
              {aiMeta.topic_hints && (
                <p className="text-xs text-gray-500">Topics: {aiMeta.topic_hints.join(", ")}</p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 mb-4 text-center">{error}</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="px-4 py-3 rounded-xl border border-red-200 text-red-400 text-sm font-semibold hover:bg-red-50 disabled:opacity-40 transition-all"
              >
                {deleting ? "..." : "Delete"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 disabled:opacity-40 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 py-3 rounded-xl bg-yellow-400 text-yellow-900 text-sm font-bold hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
