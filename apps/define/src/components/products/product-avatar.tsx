'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { Loader2 } from 'lucide-react';

interface ProductAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-lg',
};

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function getColorFromName(name: string): string {
  // Generate a consistent color based on the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use a set of pleasant colors
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
  ];

  return colors[Math.abs(hash) % colors.length];
}

export function ProductAvatar({
  name,
  avatarUrl,
  size = 'md',
  loading = false,
  onClick,
  className,
}: ProductAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const showInitials = !avatarUrl || imageError;

  return (
    <div
      className={cn(
        'relative rounded-lg overflow-hidden flex items-center justify-center font-semibold text-white select-none',
        sizeClasses[size],
        showInitials && getColorFromName(name),
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
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      )}
    </div>
  );
}
