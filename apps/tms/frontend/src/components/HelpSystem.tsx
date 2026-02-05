import { useState, useEffect, useCallback } from 'react'

interface HelpTopic {
  id: string
  title: string
  content: string
  category: string
  keywords: string[]
}

interface TooltipConfig {
  id: string
  targetSelector: string
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

// Help topics database
const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'dashboard-overview',
    title: 'Dashboard Overview',
    content: 'The dashboard provides a quick view of your work items, at-risk shipments, and daily metrics. Use the cards to navigate to different sections.',
    category: 'Getting Started',
    keywords: ['dashboard', 'overview', 'home'],
  },
  {
    id: 'quote-requests',
    title: 'Processing Quote Requests',
    content: 'Quote requests come from customer emails and are automatically parsed by AI. Review the extracted fields, adjust as needed, and create a quote to send back.',
    category: 'Quotes',
    keywords: ['quote', 'request', 'email', 'ai'],
  },
  {
    id: 'quote-builder',
    title: 'Creating Quotes',
    content: 'Use the quote builder to set pricing, add line items (like accessorials), and send quotes to customers. The margin calculator helps ensure profitability.',
    category: 'Quotes',
    keywords: ['quote', 'pricing', 'margin'],
  },
  {
    id: 'dispatch-board',
    title: 'Dispatch Board',
    content: 'The dispatch board shows shipments in columns by status. Drag shipments to update status. Click on a shipment to assign carriers or view details.',
    category: 'Dispatch',
    keywords: ['dispatch', 'board', 'kanban', 'status'],
  },
  {
    id: 'carrier-assignment',
    title: 'Assigning Carriers',
    content: 'Click "Suggest Carriers" to get AI-powered recommendations based on lane history and performance. Create tenders to send rate offers to carriers.',
    category: 'Dispatch',
    keywords: ['carrier', 'assign', 'tender', 'suggest'],
  },
  {
    id: 'tracking-updates',
    title: 'Tracking Shipments',
    content: 'Add check calls and tracking events to keep customers informed. The tracking timeline shows all events chronologically.',
    category: 'Tracking',
    keywords: ['tracking', 'check call', 'status', 'timeline'],
  },
  {
    id: 'document-upload',
    title: 'Document Management',
    content: 'Upload BOLs, PODs, and other documents. AI will automatically classify and extract relevant data. Documents are linked to shipments for easy access.',
    category: 'Documents',
    keywords: ['document', 'upload', 'bol', 'pod', 'ai'],
  },
  {
    id: 'invoice-creation',
    title: 'Creating Invoices',
    content: 'Generate invoices from delivered shipments. You can create individual invoices or batch them together for the same customer.',
    category: 'Billing',
    keywords: ['invoice', 'billing', 'payment'],
  },
  {
    id: 'carrier-performance',
    title: 'Carrier Performance',
    content: 'Track carrier on-time rates, tender acceptance, and cost per mile. Use this data to make better carrier selection decisions.',
    category: 'Analytics',
    keywords: ['performance', 'analytics', 'on-time', 'carrier'],
  },
  {
    id: 'margin-analysis',
    title: 'Margin Analysis',
    content: 'View margins by customer, carrier, and lane. Identify high and low margin shipments to optimize pricing strategies.',
    category: 'Analytics',
    keywords: ['margin', 'profit', 'analytics'],
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    content: 'Press "?" anywhere to see available shortcuts. Common: "g d" for Dashboard, "g i" for Inbox, "g s" for Shipments.',
    category: 'Tips',
    keywords: ['keyboard', 'shortcut', 'quick'],
  },
]

// Feature tooltips for onboarding
const ONBOARDING_TOOLTIPS: TooltipConfig[] = [
  {
    id: 'sidebar-inbox',
    targetSelector: '[data-help="inbox"]',
    content: 'Your unified inbox shows all work items that need attention - quote requests, check calls due, exceptions, and more.',
    position: 'right',
  },
  {
    id: 'sidebar-dispatch',
    targetSelector: '[data-help="dispatch"]',
    content: 'The dispatch board gives you a visual overview of all shipments and their current status.',
    position: 'right',
  },
  {
    id: 'quick-actions',
    targetSelector: '[data-help="quick-actions"]',
    content: 'Use quick actions to perform common tasks like creating quotes, adding shipments, or recording check calls.',
    position: 'bottom',
  },
]

// Help context for contextual help
export const HelpContext = {
  getHelpForPage: (page: string): HelpTopic[] => {
    const pageKeywords: Record<string, string[]> = {
      dashboard: ['dashboard', 'overview'],
      inbox: ['inbox', 'work item'],
      'quote-requests': ['quote', 'request'],
      shipments: ['shipment', 'tracking'],
      dispatch: ['dispatch', 'board', 'carrier'],
      carriers: ['carrier', 'performance'],
      invoices: ['invoice', 'billing'],
    }

    const keywords = pageKeywords[page] || []
    return HELP_TOPICS.filter(topic =>
      topic.keywords.some(k => keywords.includes(k))
    )
  },

  searchHelp: (query: string): HelpTopic[] => {
    const q = query.toLowerCase()
    return HELP_TOPICS.filter(topic =>
      topic.title.toLowerCase().includes(q) ||
      topic.content.toLowerCase().includes(q) ||
      topic.keywords.some(k => k.includes(q))
    )
  },
}

// Help Panel Component
interface HelpPanelProps {
  isOpen: boolean
  onClose: () => void
  currentPage?: string
}

export function HelpPanel({ isOpen, onClose, currentPage }: HelpPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const categories = [...new Set(HELP_TOPICS.map(t => t.category))]

  const filteredTopics = searchQuery
    ? HelpContext.searchHelp(searchQuery)
    : activeCategory
      ? HELP_TOPICS.filter(t => t.category === activeCategory)
      : currentPage
        ? HelpContext.getHelpForPage(currentPage)
        : HELP_TOPICS

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-blue-600 text-white">
        <h2 className="text-lg font-semibold">Help & Support</h2>
        <button onClick={onClose} className="p-1 hover:bg-blue-700 rounded">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b">
        <input
          type="text"
          placeholder="Search help topics..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Categories */}
      <div className="p-4 border-b flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1 rounded-full text-sm ${
            !activeCategory ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-sm ${
              activeCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Topics */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredTopics.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No help topics found</p>
        ) : (
          <div className="space-y-4">
            {filteredTopics.map(topic => (
              <div key={topic.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <h3 className="font-medium text-gray-900">{topic.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{topic.category}</p>
                <p className="text-sm text-gray-700 mt-2">{topic.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-gray-50">
        <p className="text-sm text-gray-500 text-center">
          Press <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">?</kbd> anywhere for quick help
        </p>
      </div>
    </div>
  )
}

// Tooltip Component
interface TooltipProps {
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  children: React.ReactNode
}

export function Tooltip({ content, position = 'top', children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={`absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap ${positionClasses[position]}`}
        >
          {content}
          <div
            className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${
              position === 'top' ? 'top-full left-1/2 -translate-x-1/2 -mt-1' :
              position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 -mb-1' :
              position === 'left' ? 'left-full top-1/2 -translate-y-1/2 -ml-1' :
              'right-full top-1/2 -translate-y-1/2 -mr-1'
            }`}
          />
        </div>
      )}
    </div>
  )
}

// Help Button Component (fixed position)
interface HelpButtonProps {
  onClick: () => void
}

export function HelpButton({ onClick }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 z-40 flex items-center justify-center"
      aria-label="Help"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  )
}

// Onboarding Tour Hook
export function useOnboardingTour() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [hasCompleted, setHasCompleted] = useState(false)

  useEffect(() => {
    const completed = localStorage.getItem('tms_onboarding_completed')
    setHasCompleted(completed === 'true')
  }, [])

  const startTour = useCallback(() => {
    setCurrentStep(0)
    setIsActive(true)
  }, [])

  const nextStep = useCallback(() => {
    if (currentStep < ONBOARDING_TOOLTIPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      completeTour()
    }
  }, [currentStep])

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const completeTour = useCallback(() => {
    setIsActive(false)
    setHasCompleted(true)
    localStorage.setItem('tms_onboarding_completed', 'true')
  }, [])

  const skipTour = useCallback(() => {
    setIsActive(false)
  }, [])

  return {
    currentStep,
    isActive,
    hasCompleted,
    totalSteps: ONBOARDING_TOOLTIPS.length,
    currentTooltip: isActive ? ONBOARDING_TOOLTIPS[currentStep] : null,
    startTour,
    nextStep,
    prevStep,
    completeTour,
    skipTour,
  }
}

// Main Help System Hook
export function useHelpSystem() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const onboarding = useOnboardingTour()

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          setIsPanelOpen(prev => !prev)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    isPanelOpen,
    openPanel: () => setIsPanelOpen(true),
    closePanel: () => setIsPanelOpen(false),
    togglePanel: () => setIsPanelOpen(prev => !prev),
    ...onboarding,
  }
}

export default HelpPanel
