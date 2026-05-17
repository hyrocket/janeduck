import type { SelfEvalRating } from "@/lib/types"

interface Props {
  onRate: (rating: SelfEvalRating) => void
  disabled?: boolean
}

const BUTTONS: { rating: SelfEvalRating; label: string; style: string }[] = [
  { rating: "dont_know", label: "Don't know", style: "bg-red-100 text-red-700 active:bg-red-200" },
  { rating: "unsure",    label: "Unsure",      style: "bg-orange-100 text-orange-700 active:bg-orange-200" },
  { rating: "know",      label: "Know it",     style: "bg-green-100 text-green-700 active:bg-green-200" },
  { rating: "know_well", label: "Know well",   style: "bg-teal-100 text-teal-700 active:bg-teal-200" },
]

export default function SelfEvalButtons({ onRate, disabled }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2 w-full px-4">
      {BUTTONS.map(({ rating, label, style }) => (
        <button
          key={rating}
          onClick={() => onRate(rating)}
          disabled={disabled}
          className={`
            ${style}
            rounded-xl py-3 text-xs font-semibold
            transition-all duration-100
            disabled:opacity-40 disabled:cursor-not-allowed
            touch-manipulation
          `}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
