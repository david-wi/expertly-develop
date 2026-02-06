import { useState, useEffect } from 'react'
import { Undo2 } from 'lucide-react'

interface UndoToastProps {
  message: string
  onUndo: () => void
  onDismiss: () => void
  duration?: number
}

export default function UndoToast({ message, onUndo, onDismiss, duration = 5000 }: UndoToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true))

    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 200) // Wait for fade-out animation
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onDismiss])

  const handleUndo = () => {
    onUndo()
    setVisible(false)
    setTimeout(onDismiss, 200)
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div
        className={`flex items-center gap-3 bg-gray-900 text-white rounded-lg shadow-lg px-4 py-3 transition-all duration-200 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <span className="text-sm">{message}</span>
        <button
          onClick={handleUndo}
          className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Undo
        </button>
      </div>
    </div>
  )
}
