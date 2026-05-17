import type { SelfEvalRating } from "@/lib/types"

interface Props {
  onRate: (rating: SelfEvalRating) => void
  disabled?: boolean
  currentRating?: SelfEvalRating
}

const BUTTONS: {
  rating: SelfEvalRating
  label: string
  base: string
  selected: string
}[] = [
  {
    rating: "dont_know",
    label: "Don't know",
    base: "bg-red-100 text-red-700 active:bg-red-200",
    selected: "bg-red-200 text-red-800 ring-2 ring-red-400 ring-offset-1",
  },
  {
    rating: "unsure",
    label: "Unsure",
    base: "bg-orange-100 text-orange-700 active:bg-orange-200",
    selected: "bg-orange-200 text-orange-800 ring-2 ring-orange-400 ring-offset-1",
  },
  {
    rating: "know",
    label: "Know it",
    base: "bg-green-100 text-green-700 active:bg-green-200",
    selected: "bg-green-200 text-green-800 ring-2 ring-green-400 ring-offset-1",
  },
  {
    rating: "know_well",
    label: "Know well",
    base: "bg-teal-100 text-teal-700 active:bg-teal-200",
    selected: "bg-teal-200 text-teal-800 ring-2 ring-teal-400 ring-offset-1",
  },
]

export default function SelfEvalButtons({ onRate, disabled, currentRating }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2 w-full px-4">
      {BUTTONS.map(({ rating, label, base, selected }) => {
        const isSelected = currentRating === rating
        return (
          <button
            key={rating}
            onClick={() => onRate(rating)}
            disabled={disabled}
            className={`
              ${isSelected ? selected : base}
              rounded-xl py-3 text-xs font-semibold
              transition-all duration-100
              disabled:opacity-40 disabled:cursor-not-allowed
              touch-manipulation
            `}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
