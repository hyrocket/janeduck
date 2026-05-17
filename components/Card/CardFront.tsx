interface CardFrontProps {
  word: string
  part_of_speech: string | null
  pronunciation?: string | null
}

export default function CardFront({ word, part_of_speech, pronunciation }: CardFrontProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 select-none">
      {part_of_speech && (
        <span className="text-xs font-medium text-yellow-500 uppercase tracking-widest mb-3">
          {part_of_speech}
        </span>
      )}
      <h2 className="text-3xl md:text-4xl font-bold text-gray-800 text-center leading-tight">
        {word}
      </h2>
      {pronunciation && (
        <p className="mt-2 text-sm text-gray-400 tracking-wide">{pronunciation}</p>
      )}
      <p className="mt-6 text-sm text-gray-400">Tap to see definition</p>
    </div>
  )
}
