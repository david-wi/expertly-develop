import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Mail,
  Send,
  X,
  Copy,
  Check,
  CheckCircle,
  Wand2,
  Hash,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { api, Task, TaskSuggestion } from '../services/api'

interface MessageReviewTabProps {
  task: Task
  suggestions: TaskSuggestion[]
  onUpdate: () => void
  onRegenerateDescription: () => void
  regenerating: boolean
}

// Convert Slack markup to markdown-friendly text
function formatSlackText(text: string): string {
  return text
    // User mentions: <@U123|name> or <@U123>
    .replace(/<@([A-Z0-9]+)\|([^>]+)>/g, '**@$2**')
    .replace(/<@([A-Z0-9]+)>/g, '**@$1**')
    // Channel mentions: <#C123|channel> or <#C123>
    .replace(/<#([A-Z0-9]+)\|([^>]+)>/g, '**#$2**')
    .replace(/<#([A-Z0-9]+)>/g, '**#$1**')
    // URLs: <url|text> or <url>
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '[$2]($1)')
    .replace(/<(https?:\/\/[^>]+)>/g, '[$1]($1)')
    // Bold: *text* -> **text**
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '**$1**')
    // Italic: _text_ -> *text*
    .replace(/(?<!_)_([^_]+)_(?!_)/g, '*$1*')
    // Strikethrough: ~text~ -> ~~text~~
    .replace(/~([^~]+)~/g, '~~$1~~')
    // Code blocks: ```text``` (already markdown compatible)
    // Inline code: `text` (already markdown compatible)
}

function formatTimestamp(ts: string | undefined): string {
  if (!ts) return ''
  const date = new Date(ts)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function detectProvider(task: Task): 'slack' | 'gmail' | 'outlook' | 'unknown' {
  const eventType = task.input_data?._monitor_event?.event_type || ''
  if (eventType.startsWith('slack') || eventType.includes('slack')) return 'slack'
  if (eventType.startsWith('gmail') || eventType.includes('gmail')) return 'gmail'
  if (eventType.startsWith('outlook') || eventType.includes('outlook')) return 'outlook'
  // Fallback: check source_url
  if (task.source_url?.includes('slack.com')) return 'slack'
  if (task.source_url?.includes('mail.google.com')) return 'gmail'
  if (task.source_url?.includes('outlook')) return 'outlook'
  return 'unknown'
}

const PROVIDER_CONFIG = {
  slack: { icon: MessageSquare, label: 'Slack', color: 'bg-purple-100 text-purple-700' },
  gmail: { icon: Mail, label: 'Gmail', color: 'bg-red-100 text-red-700' },
  outlook: { icon: Mail, label: 'Outlook', color: 'bg-blue-100 text-blue-700' },
  unknown: { icon: MessageSquare, label: 'Message', color: 'bg-gray-100 text-gray-700' },
}

// --- Sub-components ---

function ThreadContext({ thread }: { thread: Array<Record<string, unknown>> }) {
  const [expanded, setExpanded] = useState(false)

  if (!thread || thread.length === 0) return null

  return (
    <div className="rounded-xl border border-theme-border/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-theme-bg-elevated/50 hover:bg-theme-bg-elevated transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-theme-text-secondary flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-theme-text-secondary flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-theme-text-secondary">
          {thread.length} message{thread.length !== 1 ? 's' : ''} in thread
        </span>
      </button>
      {expanded && (
        <div className="border-t border-theme-border/30 max-h-[300px] overflow-y-auto">
          {thread.map((msg, i) => (
            <div
              key={i}
              className="px-3 py-2 border-b border-theme-border/20 last:border-b-0"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-5 h-5 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-medium text-white">
                    {((msg.user_name || msg.sender || msg.from || 'U') as string).charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs font-medium text-theme-text-primary truncate">
                  {String(msg.user_name || msg.sender || msg.from || 'Unknown')}
                </span>
                {typeof msg.timestamp === 'string' && (
                  <span className="text-[10px] text-theme-text-secondary ml-auto flex-shrink-0">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                )}
              </div>
              <p className="text-xs text-theme-text-secondary leading-relaxed pl-6">
                {(msg.text || msg.body || msg.snippet || '') as string}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OriginalMessage({ task, provider }: { task: Task; provider: 'slack' | 'gmail' | 'outlook' | 'unknown' }) {
  const event = task.input_data?._monitor_event
  const eventData = event?.event_data || {}
  const config = PROVIDER_CONFIG[provider]
  const ProviderIcon = config.icon

  const senderName = (eventData.user_name || eventData.sender || eventData.from || 'Unknown sender') as string
  const messageText = (eventData.text || eventData.body || eventData.snippet || '') as string
  const channel = (eventData.channel_name || eventData.channel) as string | undefined
  const subject = (eventData.subject) as string | undefined
  const timestamp = event?.provider_timestamp

  return (
    <div className="rounded-xl border border-theme-border/50 bg-theme-bg-surface overflow-hidden">
      {/* Message header */}
      <div className="px-3 py-2.5 border-b border-theme-border/30 bg-theme-bg-elevated/30">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-white">
              {senderName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-theme-text-primary truncate">
                {senderName}
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${config.color}`}>
                <ProviderIcon className="w-2.5 h-2.5" />
                {config.label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {provider === 'slack' && channel && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-theme-text-secondary bg-theme-bg-elevated rounded px-1.5 py-0.5">
                  <Hash className="w-2.5 h-2.5" />
                  {channel}
                </span>
              )}
              {(provider === 'gmail' || provider === 'outlook') && subject && (
                <span className="text-xs text-theme-text-secondary truncate">
                  {subject}
                </span>
              )}
              {timestamp && (
                <span className="text-[10px] text-theme-text-secondary">
                  {formatTimestamp(timestamp)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Message body */}
      <div className="px-3 py-3">
        <div className="text-sm text-theme-text-primary leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
          {provider === 'slack' ? (
            <ReactMarkdown>{formatSlackText(messageText)}</ReactMarkdown>
          ) : (
            <ReactMarkdown>{messageText}</ReactMarkdown>
          )}
        </div>
      </div>

      {/* Source link */}
      {task.source_url && (
        <div className="px-3 py-2 border-t border-theme-border/30">
          <a
            href={task.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            View original
          </a>
        </div>
      )}
    </div>
  )
}

function AIAnalysis({ task, onRegenerate, regenerating }: { task: Task; onRegenerate: () => void; regenerating: boolean }) {
  return (
    <div className="rounded-xl border border-theme-border/50 bg-theme-bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-theme-border/30 bg-theme-bg-elevated/30">
        <span className="text-xs font-medium text-theme-text-secondary flex items-center gap-1.5">
          <Wand2 className="w-3.5 h-3.5" />
          AI Analysis
        </span>
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <Wand2 className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
          {regenerating ? 'Regenerating...' : 'Regenerate'}
        </button>
      </div>
      <div className="px-3 py-3">
        {task.description ? (
          <div className="prose prose-sm max-w-none text-sm text-theme-text-primary leading-relaxed prose-p:my-1 prose-headings:my-2">
            <ReactMarkdown>{task.description}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-xs text-theme-text-secondary italic">No description yet</p>
        )}
      </div>
    </div>
  )
}

function DraftReplySection({ suggestions, onUpdate }: { suggestions: TaskSuggestion[]; onUpdate: () => void }) {
  const pendingSuggestions = suggestions.filter(s => s.status === 'pending')

  if (pendingSuggestions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-theme-border/50 bg-theme-bg-surface/50 px-4 py-6 text-center">
        <Send className="w-5 h-5 text-theme-text-secondary/40 mx-auto mb-2" />
        <p className="text-xs text-theme-text-secondary">No draft replies available</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {pendingSuggestions.map(suggestion => (
        <DraftReplyCard
          key={suggestion.id}
          suggestion={suggestion}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  )
}

function DraftReplyCard({ suggestion, onUpdate }: { suggestion: TaskSuggestion; onUpdate: () => void }) {
  const [editedContent, setEditedContent] = useState(suggestion.content)
  const [executing, setExecuting] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const isSlack = suggestion.suggestion_type === 'slack_reply'
  const isGmail = suggestion.suggestion_type === 'gmail_reply'
  const providerLabel = isSlack ? 'Slack' : isGmail ? 'Gmail' : suggestion.suggestion_type
  const ProviderIcon = isSlack ? MessageSquare : Mail

  const handleExecute = async () => {
    setExecuting(true)
    setError(null)
    try {
      if (editedContent !== suggestion.content) {
        await api.updateTaskSuggestion(suggestion.id, { content: editedContent })
      }
      const result = await api.executeTaskSuggestion(suggestion.id)

      if (result.action === 'sent') {
        setSent(true)
        setTimeout(() => onUpdate(), 1500)
      } else if (result.action === 'open_url') {
        if (result.copy_content) {
          await navigator.clipboard.writeText(result.copy_content)
        }
        if (result.url) {
          window.open(result.url, '_blank')
        }
        await api.updateTaskSuggestion(suggestion.id, { status: 'accepted' })
        setSent(true)
        setTimeout(() => onUpdate(), 1500)
      }
    } catch (err) {
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

  return (
    <div className="rounded-xl border border-theme-border/50 bg-theme-bg-surface overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-theme-border/30 bg-theme-bg-elevated/30">
        <ProviderIcon className="w-3.5 h-3.5 text-theme-text-secondary" />
        <span className="text-xs font-medium text-theme-text-primary flex-1 truncate">
          {suggestion.title}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium">
          {providerLabel}
        </span>
      </div>
      <div className="p-3">
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          rows={6}
          className="w-full px-3 py-2.5 border border-theme-border/50 rounded-xl bg-theme-bg-elevated/50 text-theme-text-primary text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 resize-y transition-all"
          disabled={sent}
          placeholder="Edit your reply..."
        />

        {error && (
          <p className="text-xs text-red-600 mt-1.5">{error}</p>
        )}

        <div className="flex items-center justify-end gap-2 mt-3">
          {sent ? (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <Check className="w-4 h-4" />
              {isGmail ? 'Copied & opened' : 'Sent'}
            </span>
          ) : (
            <>
              <button
                onClick={handleDismiss}
                disabled={dismissing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-theme-text-secondary hover:bg-theme-bg-elevated rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                {dismissing ? 'Dismissing...' : 'Dismiss'}
              </button>
              <button
                onClick={handleExecute}
                disabled={executing || !editedContent.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium transition-colors"
              >
                {isGmail ? (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    {executing ? 'Opening...' : 'Copy & Open Gmail'}
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    {executing ? 'Sending...' : 'Send Reply'}
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

function QuickActions({ task, onUpdate }: { task: Task; onUpdate: () => void }) {
  const [completing, setCompleting] = useState(false)

  const handleComplete = async () => {
    setCompleting(true)
    try {
      await api.approveTask(task.id)
      onUpdate()
    } catch (err) {
      console.error('Failed to complete task:', err)
    } finally {
      setCompleting(false)
    }
  }

  const isCompleted = task.status === 'completed'

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {!isCompleted && (
        <button
          onClick={handleComplete}
          disabled={completing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          {completing ? 'Completing...' : 'Complete Task'}
        </button>
      )}
      {task.source_url && (
        <a
          href={task.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-theme-text-secondary hover:bg-theme-bg-elevated border border-theme-border/50 rounded-lg transition-colors font-medium"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open Source
        </a>
      )}
    </div>
  )
}

// --- Main component ---

export default function MessageReviewTab({
  task,
  suggestions,
  onUpdate,
  onRegenerateDescription,
  regenerating,
}: MessageReviewTabProps) {
  const provider = detectProvider(task)
  const thread = task.input_data?._monitor_event?.context_data?.thread

  return (
    <div className="p-5">
      <div className="grid grid-cols-5 gap-5">
        {/* Left column (40%) — Original message context */}
        <div className="col-span-2 space-y-3">
          {thread && thread.length > 0 && (
            <ThreadContext thread={thread} />
          )}
          <OriginalMessage task={task} provider={provider} />
        </div>

        {/* Right column (60%) — AI analysis + draft reply + actions */}
        <div className="col-span-3 space-y-3">
          <AIAnalysis
            task={task}
            onRegenerate={onRegenerateDescription}
            regenerating={regenerating}
          />
          <DraftReplySection
            suggestions={suggestions}
            onUpdate={onUpdate}
          />
          <QuickActions task={task} onUpdate={onUpdate} />
        </div>
      </div>
    </div>
  )
}
