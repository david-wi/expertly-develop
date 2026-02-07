import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ProductAvatarProps {
  name: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  onClick?: () => void
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-lg',
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase()
  }
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function getGradientFromName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  const gradients = [
    'bg-gradient-to-br from-blue-500 to-purple-600',
    'bg-gradient-to-br from-green-500 to-teal-600',
    'bg-gradient-to-br from-purple-500 to-pink-600',
    'bg-gradient-to-br from-pink-500 to-rose-600',
    'bg-gradient-to-br from-indigo-500 to-blue-600',
    'bg-gradient-to-br from-teal-500 to-cyan-600',
    'bg-gradient-to-br from-orange-500 to-amber-600',
    'bg-gradient-to-br from-cyan-500 to-blue-600',
  ]

  return gradients[Math.abs(hash) % gradients.length]
}

export function ProductAvatar({
  name,
  avatarUrl,
  size = 'md',
  loading = false,
  onClick,
  className,
}: ProductAvatarProps) {
  const [imageError, setImageError] = useState(false)
  const showInitials = !avatarUrl || imageError

  return (
    <div
      className={cn(
        'relative rounded-lg overflow-hidden flex items-center justify-center font-semibold text-white select-none',
        sizeClasses[size],
        getGradientFromName(name),
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={onClick}
    >
      {loading ? (
        <Loader2 className="animate-spin h-1/2 w-1/2" />
      ) : showInitials ? (
        <span>{getInitials(name)}</span>
      ) : (
        <img
          src={avatarUrl!}
          alt={`${name} avatar`}
          className="w-full h-full object-cover mix-blend-screen"
          onError={() => setImageError(true)}
        />
      )}
    </div>
  )
}
