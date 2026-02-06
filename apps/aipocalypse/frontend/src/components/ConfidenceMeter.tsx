export function ConfidenceMeter({ value, label }: { value: number; label?: string }) {
  const getColor = (v: number) => {
    if (v >= 80) return 'bg-emerald-500'
    if (v >= 60) return 'bg-green-500'
    if (v >= 40) return 'bg-yellow-500'
    if (v >= 20) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{label}</span>
          <span>{value}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${getColor(value)}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}
