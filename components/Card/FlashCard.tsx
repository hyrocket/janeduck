"use client"

import { useState, useRef } from "react"
import CardFront from "./CardFront"
import CardBack from "./CardBack"

interface ExampleSentence { sentence: string; context?: string }

interface FlashCardProps {
  word: string
  definition: string
  part_of_speech: string | null
  example_sentences: ExampleSentence[] | null
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
}

const SWIPE_THRESHOLD = 60

export default function FlashCard({
  word,
  definition,
  part_of_speech,
  example_sentences,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
}: FlashCardProps) {
  const [flipped, setFlipped] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const didSwipe = useRef(false)

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
      className="w-full max-w-lg mx-auto"
      style={{ perspective: "1000px" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleTap}
    >
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
          <CardFront word={word} part_of_speech={part_of_speech} />
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
