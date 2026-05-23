"use client"

import { useRef, useState } from "react"

const EMOJI_OPTIONS = [
  "📚", "📖", "📝", "✏️",
  "🌟", "🎯", "🏆", "💡",
  "🦆", "🎓", "🧠", "🔥",
  "💎", "🌈", "📕", "📗",
]

interface Props {
  deckId: string
  currentIcon: string | null
  level: number
  onClose: () => void
  onSaved: (icon: string | null) => void
}

function resizeImageToDataUrl(file: File, size = 80): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")!
        // Center-crop to square
        const minSide = Math.min(img.width, img.height)
        const sx = (img.width - minSide) / 2
        const sy = (img.height - minSide) / 2
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size)
        resolve(canvas.toDataURL("image/jpeg", 0.75))
      }
      img.onerror = reject
      img.src = e.target!.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function DeckIconPicker({ deckId, currentIcon, onClose, onSaved }: Props) {
  const [selected, setSelected] = useState<string | null>(currentIcon)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await resizeImageToDataUrl(file, 80)
      setSelected(dataUrl)
    } catch {
      // ignore
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icon: selected }),
      })
      if (!res.ok) throw new Error()
      onSaved(selected)
    } catch {
      setSaving(false)
    }
  }

  const isImage = selected?.startsWith("data:")

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl">
        <div className="max-w-lg mx-auto px-5 pt-5 pb-8">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-800">Deck Icon</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Preview */}
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md flex items-center justify-center bg-gradient-to-br from-yellow-300 to-yellow-500">
              {isImage ? (
                <img src={selected!} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl">{selected ?? "📚"}</span>
              )}
            </div>
          </div>

          {/* Emoji grid */}
          <div className="grid grid-cols-8 gap-2 mb-5">
            {EMOJI_OPTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => setSelected(emoji)}
                className={`aspect-square text-2xl rounded-xl flex items-center justify-center transition-all ${
                  selected === emoji
                    ? "bg-yellow-100 ring-2 ring-yellow-400 scale-110"
                    : "hover:bg-gray-100 active:scale-95"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Upload image */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-medium hover:border-yellow-300 hover:text-yellow-600 disabled:opacity-40 transition-all"
          >
            {uploading ? (
              "Resizing..."
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                Upload image
              </>
            )}
          </button>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => { setSelected(null); }}
              className="px-4 py-3 rounded-xl border border-gray-200 text-gray-400 text-sm font-medium hover:bg-gray-50 transition-all"
            >
              Reset
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 disabled:opacity-40 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-yellow-400 text-yellow-900 text-sm font-bold hover:bg-yellow-500 disabled:opacity-40 transition-all active:scale-95"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
