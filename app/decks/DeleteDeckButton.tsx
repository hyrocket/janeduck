"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function DeleteDeckButton({ deckId, deckName }: { deckId: string; deckName: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/decks/${deckId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      router.refresh()
    } catch {
      alert("Something went wrong.")
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); setConfirm(true) }}
        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Delete deck"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
      </button>

      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-gray-800 mb-2">Delete deck?</h3>
            <p className="text-sm text-gray-500 mb-1">
              <strong>{deckName}</strong>
            </p>
            <p className="text-xs text-red-500 mb-5">
              This will permanently delete the deck, all its cards, and your learning progress. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirm(false)}
                className="flex-1 py-3 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-2xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 text-sm font-bold bg-red-500 hover:bg-red-600 text-white rounded-2xl transition-all disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
