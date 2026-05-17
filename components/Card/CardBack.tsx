interface ExampleSentence {
  sentence: string
  context?: string
}

interface CardBackProps {
  word: string
  definition: string
  example_sentences: ExampleSentence[] | null
}

export default function CardBack({ word, definition, example_sentences }: CardBackProps) {
  const example = example_sentences?.[0] ?? null

  return (
    <div className="flex flex-col justify-center h-full px-6 py-4 select-none overflow-y-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-3">{word}</h2>

      <p className="text-base text-gray-600 leading-relaxed">{definition}</p>

      {example && (
        <div className="mt-5 border-l-2 border-yellow-300 pl-4">
          <p className="text-sm text-gray-500 italic leading-relaxed">
            &ldquo;{example.sentence}&rdquo;
          </p>
        </div>
      )}
    </div>
  )
}
