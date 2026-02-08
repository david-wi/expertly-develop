import { useState, useEffect, useCallback } from 'react'
import { HelpCircle, X, Lightbulb, List, BookOpen } from 'lucide-react'
import { pageHelpContent } from './pageHelpContent'

interface PageHelpProps {
  pageId: string
}

export default function PageHelp({ pageId }: PageHelpProps) {
  const [isOpen, setIsOpen] = useState(false)
  const content = pageHelpContent[pageId]

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  if (!content) return null

  return (
    <>
      {/* Help icon button */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
        aria-label={`Help for ${content.title}`}
        title={`About ${content.title}`}
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {/* Modal overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose()
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-emerald-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  About {content.title}
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Description */}
              <div>
                <p className="text-gray-700 leading-relaxed">
                  {content.description}
                </p>
              </div>

              {/* Key Features */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <List className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    Key Features
                  </h3>
                </div>
                <ul className="space-y-2">
                  {content.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* How to Use */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    How to Use
                  </h3>
                </div>
                <ol className="space-y-2">
                  {content.howToUse.map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Tips */}
              {content.tips && content.tips.length > 0 && (
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-amber-600" />
                    <h3 className="text-sm font-semibold text-amber-900 uppercase tracking-wide">
                      Tips
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {content.tips.map((tip, i) => (
                      <li key={i} className="text-sm text-amber-800 leading-relaxed">
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">Esc</kbd> to close
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
