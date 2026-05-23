"use client"

import { useState, useMemo } from "react"

type Sep = "tab" | "comma" | "semicolon"

interface ParsedRow {
  word: string
  definition: string
  valid: boolean
}

function parseInput(text: string, sep: Sep): ParsedRow[] {
  const sepChar = sep === "tab" ? "\t" : sep === "comma" ? "," : ";"
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const idx = line.indexOf(sepChar)
      if (idx === -1) return { word: line, definition: "", valid: false }
      const word = line.slice(0, idx).trim()
      const definition = line.slice(idx + 1).trim()
      return { word, definition, valid: !!(word && definition) }
    })
}

interface Props {
  deckId: string
  onClose: () => void
  onImported: (count: number) => void
}

export function BulkImportSheet({ deckId, onClose, onImported }: Props) {
  const [text, setText]   = useState("")
  const [sep, setSep]     = useState<Sep>("tab")
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = useMemo(() => parseInput(text, sep), [text, sep])
  const validRows  = rows.filter(r => r.valid)
  const invalidCount = rows.length - validRows.length

  async function handleImport() {
    if (validRows.length === 0) return
    setImporting(true)
    setError(null)
    try {
      const res = await fetch(`/api/decks/${deckId}/cards/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: validRows }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Import failed")
      }
      const data = await res.json()
      onImported(data.imported)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed")
      setImporting(false)
    }
  }

  const SEP_OPTIONS: { value: Sep; label: string; hint: string }[] = [
    { value: "tab",       label: "Tab",       hint: "word [TAB] definition" },
    { value: "comma",     label: "Comma",     hint: "word, definition" },
    { value: "semicolon", label: "Semicolon", hint: "word; definition" },
  ]

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[92dvh] flex flex-col">
        <div className="max-w-lg mx-auto w-full px-5 pt-5 pb-2 flex flex-col min-h-0">
          {/* Handle */}
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 shrink-0" />

          {/* Header */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Import Words</h2>
              <p className="text-xs text-gray-400 mt-0.5">Paste from Quizlet, Excel, or any text</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Separator selector */}
          <div className="mb-3 shrink-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Separator between word and definition</p>
            <div className="flex gap-2">
              {SEP_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSep(opt.value)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                    sep === opt.value
                      ? "bg-yellow-400 text-yellow-900"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-300 mt-1.5 text-center">
              {SEP_OPTIONS.find(o => o.value === sep)?.hint} · one card per line
            </p>
          </div>

          {/* Textarea */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={
              sep === "tab"
                ? "reluctant\tunwilling to do something\npersistent\tcontinuing firmly"
                : sep === "comma"
                ? "reluctant, unwilling to do something\npersistent, continuing firmly"
                : "reluctant; unwilling to do something\npersistent; continuing firmly"
            }
            className="w-full flex-1 min-h-[140px] px-4 py-3 rounded-xl border border-gray-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 outline-none text-sm text-gray-700 placeholder-gray-300 resize-none font-mono transition mb-3"
          />

          {/* Preview stats */}
          {rows.length > 0 && (
            <div className="mb-3 shrink-0">
              <div className="flex items-center gap-3 text-xs mb-2">
                <span className="text-green-600 font-semibold">✓ {validRows.length} ready</span>
                {invalidCount > 0 && (
                  <span className="text-orange-400">{invalidCount} skipped (no separator found)</span>
                )}
              </div>

              {/* Preview list — up to 5 rows */}
              <div className="space-y-1 max-h-[100px] overflow-y-auto">
                {rows.slice(0, 8).map((row, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 px-3 py-1.5 rounded-lg text-xs ${
                      row.valid ? "bg-green-50" : "bg-orange-50"
                    }`}
                  >
                    <span className={`shrink-0 font-semibold ${row.valid ? "text-gray-700" : "text-orange-400"}`}>
                      {row.word || "—"}
                    </span>
                    {row.valid ? (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-400 truncate">{row.definition}</span>
                      </>
                    ) : (
                      <span className="text-orange-400 italic">missing separator</span>
                    )}
                  </div>
                ))}
                {rows.length > 8 && (
                  <p className="text-xs text-gray-400 text-center pt-1">+ {rows.length - 8} more</p>
                )}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500 mb-3 text-center shrink-0">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pb-6 shrink-0">
            <button
              onClick={onClose}
              disabled={importing}
              className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 disabled:opacity-40 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={validRows.length === 0 || importing}
              className="flex-1 py-3 rounded-xl bg-yellow-400 text-yellow-900 text-sm font-bold hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {importing ? "Importing..." : `Import ${validRows.length} cards`}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
