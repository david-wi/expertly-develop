import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { api } from '../services/api'
import type { WorkItem, EmailMessage, EmailCategory } from '../types'
import { EMAIL_CATEGORY_LABELS } from '../types'
import {
  Clock,
  FileText,
  Truck,
  AlertTriangle,
  Check,
  BellOff,
  Mail,
  Star,
  Archive,
  RefreshCw,
  Sparkles,
  Link2,
  Eye,
  EyeOff,
  Loader2,
  Inbox as InboxIcon,
} from 'lucide-react'
import PageHelp from '../components/PageHelp'

const typeIcons: Record<string, typeof FileText> = {
  quote_request: FileText,
  quote_followup: FileText,
  shipment_needs_carrier: Truck,
  tender_pending: Truck,
  check_call_due: Clock,
  exception: AlertTriangle,
}

const typeLabels: Record<string, string> = {
  quote_request: 'Quote Request',
  quote_followup: 'Quote Follow-up',
  shipment_needs_carrier: 'Needs Carrier',
  tender_pending: 'Tender Pending',
  check_call_due: 'Check Call Due',
  document_needed: 'Document Needed',
  invoice_ready: 'Invoice Ready',
  exception: 'Exception',
  email_action: 'Email Action',
}

const emailCategoryIcons: Record<EmailCategory, typeof Mail> = {
  quote_request: FileText,
  quote_response: FileText,
  shipment_update: Truck,
  carrier_communication: Truck,
  customer_communication: Mail,
  invoice_related: FileText,
  document_attached: FileText,
  booking_confirmation: Check,
  tracking_update: Clock,
  claim_related: AlertTriangle,
  uncategorized: Mail,
}

type TabType = 'work' | 'emails'

export default function Inbox() {
  const { workItems, loading, fetchWorkItems, removeWorkItem } = useAppStore()
  const [activeTab, setActiveTab] = useState<TabType>('work')
  const [workFilter, setWorkFilter] = useState<string>('all')
  const [emailFilter, setEmailFilter] = useState<string>('all')
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [loadingEmails, setLoadingEmails] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null)
  const [emailStats, setEmailStats] = useState<{ unread_count: number; needs_review_count: number }>({ unread_count: 0, needs_review_count: 0 })

  useEffect(() => {
    fetchWorkItems()
    fetchEmails()
    fetchEmailStats()
  }, [fetchWorkItems])

  const fetchEmails = async () => {
    setLoadingEmails(true)
    try {
      const inbox = await api.getEmailInbox({ limit: 100 })
      setEmails(inbox)
    } catch (error) {
      console.error('Failed to fetch emails:', error)
    } finally {
      setLoadingEmails(false)
    }
  }

  const fetchEmailStats = async () => {
    try {
      const stats = await api.getEmailStats()
      setEmailStats(stats)
    } catch (error) {
      console.error('Failed to fetch email stats:', error)
    }
  }

  const filteredWorkItems = workItems.filter((item) => {
    if (workFilter === 'all') return true
    if (workFilter === 'overdue') return item.is_overdue
    return item.work_type === workFilter
  })

  const filteredEmails = emails.filter((email) => {
    if (emailFilter === 'all') return true
    if (emailFilter === 'unread') return !email.is_read
    if (emailFilter === 'starred') return email.is_starred
    if (emailFilter === 'needs_review') return email.needs_review
    return email.category === emailFilter
  })

  const handleComplete = async (item: WorkItem) => {
    try {
      await api.completeWorkItem(item.id)
      removeWorkItem(item.id)
    } catch (error) {
      console.error('Failed to complete work item:', error)
    }
  }

  const handleSnooze = async (item: WorkItem) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)

    try {
      await api.snoozeWorkItem(item.id, tomorrow.toISOString())
      fetchWorkItems()
    } catch (error) {
      console.error('Failed to snooze work item:', error)
    }
  }

  const handleMarkRead = async (email: EmailMessage) => {
    try {
      await api.markEmailRead(email.id)
      setEmails(emails.map(e => e.id === email.id ? { ...e, is_read: true } : e))
      if (selectedEmail?.id === email.id) {
        setSelectedEmail({ ...selectedEmail, is_read: true })
      }
      fetchEmailStats()
    } catch (error) {
      console.error('Failed to mark email read:', error)
    }
  }

  const handleMarkUnread = async (email: EmailMessage) => {
    try {
      await api.markEmailUnread(email.id)
      setEmails(emails.map(e => e.id === email.id ? { ...e, is_read: false } : e))
      if (selectedEmail?.id === email.id) {
        setSelectedEmail({ ...selectedEmail, is_read: false })
      }
      fetchEmailStats()
    } catch (error) {
      console.error('Failed to mark email unread:', error)
    }
  }

  const handleStarEmail = async (email: EmailMessage) => {
    try {
      const result = await api.starEmail(email.id)
      setEmails(emails.map(e => e.id === email.id ? { ...e, is_starred: result.is_starred } : e))
      if (selectedEmail?.id === email.id) {
        setSelectedEmail({ ...selectedEmail, is_starred: result.is_starred })
      }
    } catch (error) {
      console.error('Failed to star email:', error)
    }
  }

  const handleArchiveEmail = async (email: EmailMessage) => {
    try {
      await api.archiveEmail(email.id)
      setEmails(emails.filter(e => e.id !== email.id))
      if (selectedEmail?.id === email.id) {
        setSelectedEmail(null)
      }
    } catch (error) {
      console.error('Failed to archive email:', error)
    }
  }

  const handleSelectEmail = async (email: EmailMessage) => {
    setSelectedEmail(email)
    if (!email.is_read) {
      handleMarkRead(email)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
            <PageHelp pageId="inbox" />
          </div>
          <p className="text-gray-500">
            {activeTab === 'work'
              ? `${filteredWorkItems.length} work item${filteredWorkItems.length !== 1 ? 's' : ''} to action`
              : `${filteredEmails.length} email${filteredEmails.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {activeTab === 'emails' && (
          <button
            onClick={fetchEmails}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('work')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'work'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <InboxIcon className="h-4 w-4" />
            Work Items
            {workItems.length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                {workItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('emails')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'emails'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Mail className="h-4 w-4" />
            Emails
            {emailStats.unread_count > 0 && (
              <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full">
                {emailStats.unread_count}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Work Items Tab */}
      {activeTab === 'work' && (
        <>
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'all', label: 'All' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'quote_request', label: 'Quotes' },
              { value: 'shipment_needs_carrier', label: 'Dispatch' },
              { value: 'check_call_due', label: 'Check Calls' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setWorkFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  workFilter === f.value
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Work Items List */}
          <div className="bg-white rounded-lg border border-gray-200">
            {loading.workItems ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : filteredWorkItems.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Check className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-sm">No pending work items</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {filteredWorkItems.map((item) => {
                  const Icon = typeIcons[item.work_type] || FileText
                  return (
                    <li key={item.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${
                          item.is_overdue ? 'bg-red-100' : 'bg-gray-100'
                        }`}>
                          <Icon className={`h-5 w-5 ${
                            item.is_overdue ? 'text-red-600' : 'text-gray-600'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900 truncate">
                              {item.title}
                            </h3>
                            {item.is_overdue && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                                Overdue
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {typeLabels[item.work_type] || item.work_type}
                            {item.due_at && (
                              <> · Due {new Date(item.due_at).toLocaleDateString()}</>
                            )}
                          </p>
                          {item.description && (
                            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSnooze(item)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="Snooze until tomorrow"
                          >
                            <BellOff className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleComplete(item)}
                            className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg"
                            title="Mark complete"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Emails Tab */}
      {activeTab === 'emails' && (
        <>
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'all', label: 'All' },
              { value: 'unread', label: 'Unread' },
              { value: 'starred', label: 'Starred' },
              { value: 'needs_review', label: 'Needs Review' },
              { value: 'quote_request', label: 'Quotes' },
              { value: 'shipment_update', label: 'Shipments' },
              { value: 'carrier_communication', label: 'Carriers' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setEmailFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  emailFilter === f.value
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
                {f.value === 'needs_review' && emailStats.needs_review_count > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                    {emailStats.needs_review_count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Email List + Detail */}
          <div className="grid grid-cols-2 gap-6">
            {/* Email List */}
            <div className="bg-white rounded-lg border border-gray-200">
              {loadingEmails ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                  <p className="text-gray-500 mt-2">Loading emails...</p>
                </div>
              ) : filteredEmails.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No emails</p>
                  <p className="text-sm">Your inbox is empty</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                  {filteredEmails.map((email) => {
                    const Icon = emailCategoryIcons[email.category] || Mail
                    return (
                      <li
                        key={email.id}
                        onClick={() => handleSelectEmail(email)}
                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedEmail?.id === email.id ? 'bg-emerald-50 border-l-2 border-emerald-500' : ''
                        } ${!email.is_read ? 'bg-blue-50/50' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${
                            email.auto_matched ? 'bg-emerald-100' : 'bg-gray-100'
                          }`}>
                            <Icon className={`h-4 w-4 ${
                              email.auto_matched ? 'text-emerald-600' : 'text-gray-500'
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm truncate ${!email.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                                {email.from_name || email.from_email}
                              </p>
                              {email.is_starred && (
                                <Star className="h-3 w-3 text-yellow-500 fill-current" />
                              )}
                              {email.needs_review && (
                                <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                                  Review
                                </span>
                              )}
                            </div>
                            <p className={`text-sm truncate ${!email.is_read ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                              {email.subject}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">
                                {EMAIL_CATEGORY_LABELS[email.category]}
                              </span>
                              {email.auto_matched && (
                                <span className="flex items-center gap-1 text-xs text-emerald-600">
                                  <Sparkles className="h-3 w-3" />
                                  Matched
                                </span>
                              )}
                              {email.received_at && (
                                <span className="text-xs text-gray-400">
                                  {new Date(email.received_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Email Detail */}
            <div className="bg-white rounded-lg border border-gray-200">
              {selectedEmail ? (
                <>
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStarEmail(selectedEmail)}
                        className={`p-1.5 rounded hover:bg-gray-100 ${selectedEmail.is_starred ? 'text-yellow-500' : 'text-gray-400'}`}
                        title={selectedEmail.is_starred ? 'Unstar' : 'Star'}
                      >
                        <Star className={`h-4 w-4 ${selectedEmail.is_starred ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => selectedEmail.is_read ? handleMarkUnread(selectedEmail) : handleMarkRead(selectedEmail)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                        title={selectedEmail.is_read ? 'Mark unread' : 'Mark read'}
                      >
                        {selectedEmail.is_read ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleArchiveEmail(selectedEmail)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                        title="Archive"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    </div>
                    {selectedEmail.auto_matched && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                        <Sparkles className="h-3 w-3" />
                        AI Matched
                      </span>
                    )}
                  </div>

                  <div className="p-4 space-y-4 max-h-[550px] overflow-y-auto">
                    {/* Header */}
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{selectedEmail.subject}</h2>
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-700">
                          {selectedEmail.from_name || selectedEmail.from_email}
                        </span>
                        {selectedEmail.from_name && (
                          <span className="text-gray-500">&lt;{selectedEmail.from_email}&gt;</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        To: {selectedEmail.to_emails.join(', ')}
                        {selectedEmail.cc_emails.length > 0 && (
                          <> · CC: {selectedEmail.cc_emails.join(', ')}</>
                        )}
                      </p>
                      {selectedEmail.received_at && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(selectedEmail.received_at).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {/* AI Summary */}
                    {selectedEmail.ai_summary && (
                      <div className="bg-emerald-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 mb-1">
                          <Sparkles className="h-4 w-4" />
                          AI Summary
                        </div>
                        <p className="text-sm text-emerald-800">{selectedEmail.ai_summary}</p>
                      </div>
                    )}

                    {/* Action Items */}
                    {selectedEmail.extracted_action_items && selectedEmail.extracted_action_items.length > 0 && (
                      <div className="bg-amber-50 rounded-lg p-3">
                        <div className="text-sm font-medium text-amber-700 mb-1">
                          Action Needed
                        </div>
                        <ul className="text-sm text-amber-800 space-y-1">
                          {selectedEmail.extracted_action_items.map((item, idx) => (
                            <li key={idx}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Classification */}
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                        {EMAIL_CATEGORY_LABELS[selectedEmail.category]}
                      </span>
                      {selectedEmail.classification_confidence && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">
                          {Math.round(selectedEmail.classification_confidence * 100)}% confidence
                        </span>
                      )}
                      {selectedEmail.shipment_id && (
                        <a
                          href={`/shipments/${selectedEmail.shipment_id}`}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"
                        >
                          <Link2 className="h-3 w-3" />
                          View Shipment
                        </a>
                      )}
                    </div>

                    {/* Body */}
                    <div className="border-t border-gray-200 pt-4">
                      {selectedEmail.body_html ? (
                        <div
                          className="prose prose-sm max-w-none text-gray-700"
                          dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap text-sm text-gray-700">
                          {selectedEmail.body_text}
                        </div>
                      )}
                    </div>

                    {/* Attachments */}
                    {selectedEmail.has_attachments && selectedEmail.attachments.length > 0 && (
                      <div className="border-t border-gray-200 pt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Attachments</h4>
                        <div className="space-y-2">
                          {selectedEmail.attachments.map((att, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                              <FileText className="h-4 w-4 text-gray-400" />
                              {att.filename}
                              <span className="text-xs text-gray-400">
                                ({Math.round(att.size_bytes / 1024)} KB)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-12 text-center text-gray-500">
                  <Mail className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p>Select an email to view details</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
