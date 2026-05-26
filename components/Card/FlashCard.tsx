"use client"

import { useState, useRef } from "react"
import CardFront from "./CardFront"
import CardBack from "./CardBack"

interface ExampleSentence { sentence: string; context?: string }

interface FlashCardProps {
  word: string
  definition: string
  part_of_speech: string | null
  pronunciation?: string | null
  example_sentences: ExampleSentence[] | null
  audio_url?: string | null
  isStarred?: boolean
  onStar?: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
}

const SWIPE_THRESHOLD = 60

export default function FlashCard({
  word,
  definition,
  part_of_speech,
  pronunciation,
  example_sentences,
  audio_url,
  isStarred,
  onStar,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
}: FlashCardProps) {
  const [flipped, setFlipped] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const didSwipe = useRef(false)
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string | null>(audio_url ?? null)
  const [audioLoading, setAudioLoading] = useState(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef(false)

  const handlePlayAudio = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (audioLoading || playingRef.current) return

    let url = resolvedAudioUrl
    if (!url) {
      setAudioLoading(true)
      try {
        const res = await fetch("/api/tts/word", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word }),
        })
        const data = await res.json()
        url = data.audio_url as string
        setResolvedAudioUrl(url)
      } catch {
        setAudioLoading(false)
        return
      }
      setAudioLoading(false)
    }

    if (url) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current.currentTime = 0
      }
      const audio = new Audio(url)
      currentAudioRef.current = audio
      playingRef.current = true
      audio.onended = () => { playingRef.current = false }
      audio.onerror = () => { playingRef.current = false }
      audio.play()
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    didSwipe.current = false
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (absDx > SWIPE_THRESHOLD && absDx > absDy) {
      didSwipe.current = true
      if (dx < 0) onSwipeLeft?.()
      else onSwipeRight?.()
    } else if (dy < -SWIPE_THRESHOLD && absDy > absDx) {
      didSwipe.current = true
      onSwipeUp?.()
    }
    touchStart.current = null
  }

  const handleTap = () => {
    if (!didSwipe.current) setFlipped(f => !f)
    didSwipe.current = false
  }

  return (
    <div
      className="w-full max-w-lg mx-auto relative"
      style={{ perspective: "1000px" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleTap}
    >
      {/* Star button */}
      <button
        className="absolute top-3 right-3 z-10 p-2 rounded-full transition-all duration-150 hover:scale-125 hover:bg-yellow-50 active:scale-110"
        onClick={(e) => { e.stopPropagation(); onStar?.() }}
        onTouchEnd={(e) => e.stopPropagation()}
        aria-label={isStarred ? "Unstar card" : "Star card"}
      >
        <span className={`text-2xl leading-none select-none ${isStarred ? "text-yellow-400" : "text-gray-300 hover:text-yellow-300"}`}>
          {isStarred ? "★" : "☆"}
        </span>
      </button>

      {/* Speaker button */}
      <button
        className="absolute top-3 left-3 z-10 p-2 rounded-full transition-all duration-150 hover:scale-125 hover:bg-yellow-50 active:scale-110"
        onClick={handlePlayAudio}
        aria-label="Play pronunciation"
        disabled={audioLoading}
      >
        {audioLoading ? (
          <svg className="w-5 h-5 text-yellow-400 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <svg className={`w-5 h-5 transition-colors ${resolvedAudioUrl ? "text-yellow-400" : "text-gray-300"}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0013 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        )}
      </button>

      {/* Flip card */}
      <div
        className="relative w-full transition-transform duration-500 cursor-pointer"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          height: "clamp(240px, 40vh, 360px)",
        }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 bg-white rounded-3xl shadow-lg"
          style={{ backfaceVisibility: "hidden" }}
        >
          <CardFront word={word} part_of_speech={part_of_speech} pronunciation={pronunciation} />
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 bg-white rounded-3xl shadow-lg"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <CardBack
            word={word}
            definition={definition}
            example_sentences={example_sentences}
          />
        </div>
      </div>
    </div>
  )
}
