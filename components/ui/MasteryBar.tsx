const DOTS = [0, 1, 2, 3, 4, 5]

export function MasteryBar({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {DOTS.map(i => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i < level ? "bg-yellow-400" : "bg-gray-200"}`}
        />
      ))}
    </div>
  )
}
