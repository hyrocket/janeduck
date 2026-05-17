import type { SelfEvalRating } from "@/lib/types"

interface Props {
  onRate: (rating: SelfEvalRating) => void
  disabled?: boolean
  currentRating?: SelfEvalRating
}

const BUTTONS: {
  rating: SelfEvalRating
  emoji: string
  label: string
  base: string
  hover: string
  selected: string
}[] = [
  {
    rating: "dont_know",
    emoji: "😵",
    label: "Don't know",
    base: "bg-red-100 text-red-600",
    hover: "hover:bg-red-200 hover:text-red-700",
    selected: "bg-red-500 text-white shadow-md",
  },
  {
    rating: "unsure",
    emoji: "🤔",
    label: "Unsure",
    base: "bg-orange-100 text-orange-600",
    hover: "hover:bg-orange-200 hover:text-orange-700",
    selected: "bg-orange-400 text-white shadow-md",
  },
  {
    rating: "know",
    emoji: "😊",
    label: "Know it",
    base: "bg-green-100 text-green-700",
    hover: "hover:bg-green-200 hover:text-green-800",
    selected: "bg-green-500 text-white shadow-md",
  },
  {
    rating: "know_well",
    emoji: "🤩",
    label: "Know well",
    base: "bg-teal-100 text-teal-700",
    hover: "hover:bg-teal-200 hover:text-teal-800",
    selected: "bg-teal-500 text-white shadow-md",
  },
]

export default function SelfEvalButtons({ onRate, disabled, currentRating }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2 w-full px-4">
      {BUTTONS.map(({ rating, emoji, label, base, hover, selected }) => {
        const isSelected = currentRating === rating
        return (
          <button
            key={rating}
            onClick={() => onRate(rating)}
            disabled={disabled}
            className={`
              ${isSelected ? selected : `${base} ${hover}`}
              flex flex-col items-center gap-0.5
              rounded-xl py-2.5 text-xs font-semibold
              transition-all duration-150 active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed
              touch-manipulation
            `}
          >
            <span className="text-base leading-none">{emoji}</span>
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
