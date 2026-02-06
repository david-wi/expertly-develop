import { useState } from 'react'
import { Send, X, ExternalLink, Copy, Check, MessageSquare, Mail } from 'lucide-react'
import { api, TaskSuggestion } from '../services/api'

interface TaskSuggestionsProps {
  suggestions: TaskSuggestion[]
  onUpdate: () => void
}

const PROVIDER_ICON: Record<string, typeof MessageSquare> = {
  slack_reply: MessageSquare,
  gmail_reply: Mail,
}

const PROVIDER_LABEL: Record<string, string> = {
  slack_reply: 'Slack',
  gmail_reply: 'Gmail',
}

export default function TaskSuggestions({ suggestions, onUpdate }: TaskSuggestionsProps) {
  const pendingSuggestions = suggestions.filter(s => s.status === 'pending')

  if (pendingSuggestions.length === 0) return null

  return (
    <div className="border-t border-theme-border pt-4">
      <label className="text-xs font-medium text-theme-text-secondary flex items-center gap-1.5 mb-2">
        <Send className="w-3.5 h-3.5" />
        AI Suggestions ({pendingSuggestions.length})
      </label>
      <div className="space-y-2">
        {pendingSuggestions.map(suggestion => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  )
}

function SuggestionCard({ suggestion, onUpdate }: { suggestion: TaskSuggestion; onUpdate: () => void }) {
  const [editedContent, setEditedContent] = useState(suggestion.content)
  const [executing, setExecuting] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const Icon = PROVIDER_ICON[suggestion.suggestion_type] || MessageSquare
  const providerLabel = PROVIDER_LABEL[suggestion.suggestion_type] || suggestion.suggestion_type

  const handleExecute = async () => {
    setExecuting(true)
    setError(null)
    try {
      // Save any edits first
      if (editedContent !== suggestion.content) {
        await api.updateTaskSuggestion(suggestion.id, { content: editedContent })
      }

      const result = await api.executeTaskSuggestion(suggestion.id)

      if (result.action === 'sent') {
        setSent(true)
        setTimeout(() => onUpdate(), 1500)
      } else if (result.action === 'open_url') {
        // Gmail flow: copy to clipboard and open URL
        if (result.copy_content) {
          await navigator.clipboard.writeText(result.copy_content)
        }
        if (result.url) {
          window.open(result.url, '_blank')
        }
        // Mark as accepted client-side
        await api.updateTaskSuggestion(suggestion.id, { status: 'accepted' })
        setSent(true)
        setTimeout(() => onUpdate(), 1500)
      }
    } catch (err) {
      console.error('Failed to execute suggestion:', err)
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setExecuting(false)
    }
  }

  const handleDismiss = async () => {
    setDismissing(true)
    try {
      await api.updateTaskSuggestion(suggestion.id, { status: 'dismissed' })
      onUpdate()
    } catch (err) {
      console.error('Failed to dismiss suggestion:', err)
    } finally {
      setDismissing(false)
    }
  }

  const permalink = suggestion.provider_data?.permalink as string | undefined

  return (
    <div className="border border-theme-border rounded-lg overflow-hidden bg-theme-bg-elevated">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-theme-bg-surface border-b border-theme-border">
        <Icon className="w-3.5 h-3.5 text-theme-text-secondary flex-shrink-0" />
        <span className="text-xs font-medium text-theme-text-primary flex-1 truncate">
          {suggestion.title}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 text-primary-700 font-medium">
          {providerLabel}
        </span>
        {permalink && (
          <a
            href={permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="p-0.5 rounded hover:bg-theme-bg-elevated transition-colors"
            title="View original message"
          >
            <ExternalLink className="w-3 h-3 text-theme-text-secondary" />
          </a>
        )}
      </div>

      {/* Editable draft */}
      <div className="p-3">
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          rows={3}
          className="w-full px-2 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-sm"
          disabled={sent}
        />

        {error && (
          <p className="text-xs text-red-600 mt-1">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 mt-2">
          {sent ? (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <Check className="w-3.5 h-3.5" />
              {suggestion.suggestion_type === 'gmail_reply' ? 'Copied & opened' : 'Sent'}
            </span>
          ) : (
            <>
              <button
                onClick={handleDismiss}
                disabled={dismissing}
                className="flex items-center gap-1 px-2 py-1 text-xs text-theme-text-secondary hover:bg-theme-bg-surface rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-3 h-3" />
                Dismiss
              </button>
              <button
                onClick={handleExecute}
                disabled={executing || !editedContent.trim()}
                className="flex items-center gap-1 px-3 py-1 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
              >
                {suggestion.suggestion_type === 'gmail_reply' ? (
                  <>
                    <Copy className="w-3 h-3" />
                    {executing ? 'Opening...' : 'Copy & Open Gmail'}
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    {executing ? 'Sending...' : 'Send'}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
