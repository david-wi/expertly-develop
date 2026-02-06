import type { SignalRating } from '../types'

const signalConfig: Record<SignalRating, { label: string; bg: string; text: string }> = {
  strong_sell: { label: 'Strong Sell', bg: 'bg-red-100', text: 'text-red-800' },
  sell: { label: 'Sell', bg: 'bg-orange-100', text: 'text-orange-800' },
  hold: { label: 'Hold', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  buy: { label: 'Buy', bg: 'bg-green-100', text: 'text-green-800' },
  strong_buy: { label: 'Strong Buy', bg: 'bg-emerald-100', text: 'text-emerald-800' },
}

export function SignalBadge({ signal, size = 'sm' }: { signal: SignalRating | null; size?: 'sm' | 'lg' }) {
  if (!signal) return <span className="text-xs text-gray-400">No signal</span>
  const config = signalConfig[signal]
  const sizeClass = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-xs'
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.text} ${sizeClass}`}>
      {config.label}
    </span>
  )
}
