"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingInner />
    </Suspense>
  )
}

function OnboardingInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep]     = useState<1 | 2 | 3>(1)
  const [name, setName]     = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.get("reset") === "1") {
      localStorage.removeItem("jd_onboarding_done")
      localStorage.removeItem("jd_display_name")
      setStep(1)
      return
    }

    if (localStorage.getItem("jd_onboarding_done") === "true") {
      if (params.get("step") === "2") { setStep(2); return }
      router.replace("/decks")
      return
    }

    if (params.get("step") === "2") setStep(2)
  }, [router, searchParams])

  async function handleNameSubmit() {
    if (saving) return
    setSaving(true)

    const trimmed = name.trim()

    try {
      await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed }),
      })
    } catch {
      // localStorage fallback
    }

    localStorage.setItem("jd_onboarding_done", "true")
    if (trimmed) localStorage.setItem("jd_display_name", trimmed)

    setSaving(false)
    setStep(3)
  }

  return (
    <main className="min-h-screen bg-yellow-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="JaneDuck" width={96} height={96} className="rounded-3xl shadow-md" priority />
        </div>

        {step === 1 && <Step1 onNext={() => setStep(2)} />}
        {step === 2 && (
          <Step2
            name={name}
            onChange={setName}
            onSubmit={handleNameSubmit}
            saving={saving}
          />
        )}
        {step === 3 && (
          <Step3
            name={name.trim()}
            onStart={() => router.replace("/decks")}
          />
        )}
      </div>
    </main>
  )
}

function Step1({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-gray-800">{"Hey, I'm JaneDuck! 🦆"}</h1>
        <p className="text-gray-500 text-base leading-relaxed">
          {"I'm here to help you actually "}<em>use</em>{" the words you're learning — not just memorise them. We'll do it one sentence at a time."}
        </p>
      </div>
      <button
        onClick={onNext}
        className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold text-base rounded-2xl shadow-sm transition-all active:scale-95"
      >
        {"Let's go →"}
      </button>
    </div>
  )
}

function Step2({
  name,
  onChange,
  onSubmit,
  saving,
}: {
  name: string
  onChange: (v: string) => void
  onSubmit: () => void
  saving: boolean
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">{"What should I call you?"}</h2>
        <p className="text-gray-400 text-sm">Just your first name is fine.</p>
      </div>

      <input
        type="text"
        value={name}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onSubmit()}
        placeholder="Your name"
        maxLength={50}
        autoFocus
        className="w-full px-4 py-4 text-base bg-white border-2 border-gray-200 focus:border-yellow-400 focus:outline-none rounded-2xl transition-colors placeholder:text-gray-300"
      />

      <button
        onClick={onSubmit}
        disabled={saving}
        className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold text-base rounded-2xl shadow-sm transition-all active:scale-95 disabled:opacity-60"
      >
        {saving ? "Saving…" : "OK →"}
      </button>

      <button
        onClick={onSubmit}
        disabled={saving}
        className="w-full text-xs text-gray-400 hover:text-gray-500 py-1 transition-colors"
      >
        Skip for now
      </button>
    </div>
  )
}

const HOW_IT_WORKS = [
  { icon: "⚡", text: "Quick Review — flip through words and self-rate." },
  { icon: "✍️", text: "Write a sentence using the word. Get instant feedback." },
  { icon: "📈", text: "Mastery builds up word by word as you go." },
]

function Step3({ name, onStart }: { name: string; onStart: () => void }) {
  const greeting = name ? `Nice to meet you, ${name}!` : "You're all set!"

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">{greeting} 🦆</h2>
        <p className="text-gray-400 text-sm">{"Here's how JaneDuck works."}</p>
      </div>

      <div className="space-y-3">
        {HOW_IT_WORKS.map(({ icon, text }) => (
          <div key={icon} className="flex items-start gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-sm">
            <span className="text-xl shrink-0">{icon}</span>
            <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onStart}
        className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold text-base rounded-2xl shadow-sm transition-all active:scale-95"
      >
        Start learning 🚀
      </button>
    </div>
  )
}
