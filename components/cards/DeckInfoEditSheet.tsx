"use client"

import { useState, useRef, useEffect } from "react"

interface Props {
  deckId: string
  initial: { name: string; description: string | null }
  onClose: () => void
  onSaved: () => void
}

export function DeckInfoEditSheet({ deckId, initial, onClose, onSaved }: Props) {
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  async function handleSave() {
    const trimmedName = name.trim()
    if (!trimmedName) { setError("Deck name is required."); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, description: description.trim() || null }),
      })
      if (res.status === 409) { setError("A deck with this name already exists."); setSaving(false); return }
      if (!res.ok) throw new Error()
      onSaved()
    } catch {
      setError("Failed to save. Please try again.")
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl">
        <div className="max-w-lg mx-auto px-5 pt-5 pb-8">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-800">Edit Deck Info</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Deck Name <span className="text-yellow-500">*</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 outline-none text-base font-medium text-gray-800 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="A short description of this deck"
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 outline-none text-sm text-gray-700 placeholder-gray-300 resize-none transition"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500 mb-4 text-center">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 disabled:opacity-40 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
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
