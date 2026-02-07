import { useEffect, useState } from 'react'
import { api } from '../services/api'
import {
  Inbox,
  FileText,
  Sparkles,
  Link2,
  Archive,
  Mail,
  Upload,
  Phone,
  Zap,
  Loader2,
  CheckCircle,
  Eye,
  X,
  Image,
  ScanLine,
} from 'lucide-react'

// ============================================================================
// Types (local to this page, to be moved to types/index.ts)
// ============================================================================

type InboxStatus = 'new' | 'classified' | 'linked' | 'archived'
type InboxClassification = 'bol' | 'pod' | 'rate_confirmation' | 'invoice' | 'insurance_cert' | 'customs_doc' | 'unknown'
type InboxSource = 'email' | 'upload' | 'fax' | 'edi'

interface DocumentInboxItem {
  id: string
  source: InboxSource
  source_email?: string
  filename: string
  file_type: string
  file_size: number
  classification?: InboxClassification
  classification_confidence?: number
  linked_entity_type?: string
  linked_entity_id?: string
  status: InboxStatus
  metadata: Record<string, unknown>
  processed_at?: string
  processed_by?: string
  created_at: string
  updated_at: string
}

interface InboxStats {
  total: number
  by_status: Record<string, number>
  by_classification: Record<string, number>
}

// ============================================================================
// Constants
// ============================================================================

const CLASSIFICATION_LABELS: Record<string, string> = {
  bol: 'Bill of Lading',
  pod: 'Proof of Delivery',
  rate_confirmation: 'Rate Confirmation',
  invoice: 'Invoice',
  insurance_cert: 'Insurance Certificate',
  customs_doc: 'Customs Document',
  unknown: 'Unknown',
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  bol: 'bg-blue-100 text-blue-700',
  pod: 'bg-green-100 text-green-700',
  rate_confirmation: 'bg-purple-100 text-purple-700',
  invoice: 'bg-amber-100 text-amber-700',
  insurance_cert: 'bg-teal-100 text-teal-700',
  customs_doc: 'bg-rose-100 text-rose-700',
  unknown: 'bg-gray-100 text-gray-600',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-yellow-100 text-yellow-700',
  classified: 'bg-blue-100 text-blue-700',
  linked: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-600',
}

const SOURCE_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  upload: Upload,
  fax: Phone,
  edi: Zap,
}

// ============================================================================
// Component
// ============================================================================

export default function DocumentInbox() {
  const [items, setItems] = useState<DocumentInboxItem[]>([])
  const [stats, setStats] = useState<InboxStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<DocumentInboxItem | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [classificationFilter, setClassificationFilter] = useState<string>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Link modal state
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkEntityType, setLinkEntityType] = useState('shipment')
  const [linkEntityId, setLinkEntityId] = useState('')

  // Batch upload state
  const [showBatchUpload, setShowBatchUpload] = useState(false)
  const [batchUploading, setBatchUploading] = useState(false)
  const [batchAutoClassify, setBatchAutoClassify] = useState(true)

  // Image enhancement state
  const [enhancingDoc, setEnhancingDoc] = useState<string | null>(null)
  const [ocrLoading, setOcrLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [statusFilter, classificationFilter])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (classificationFilter !== 'all') params.classification = classificationFilter

      const [itemsData, statsData] = await Promise.all([
        api.getDocumentInboxItems(params),
        api.getDocumentInboxStats(),
      ])
      setItems(itemsData)
      setStats(statsData)
    } catch (error) {
      console.error('Failed to fetch document inbox:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClassify = async (itemId: string) => {
    setActionLoading(itemId)
    try {
      const updated = await api.classifyDocumentInboxItem(itemId)
      setItems(items.map(i => i.id === updated.id ? updated : i))
      if (selectedItem?.id === updated.id) setSelectedItem(updated)
      // Refresh stats
      const statsData = await api.getDocumentInboxStats()
      setStats(statsData)
    } catch (error) {
      console.error('Failed to classify:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleLink = async (itemId: string) => {
    if (!linkEntityId.trim()) return
    setActionLoading(itemId)
    try {
      const updated = await api.linkDocumentInboxItem(itemId, {
        entity_type: linkEntityType,
        entity_id: linkEntityId,
      })
      setItems(items.map(i => i.id === updated.id ? updated : i))
      if (selectedItem?.id === updated.id) setSelectedItem(updated)
      setShowLinkModal(false)
      setLinkEntityId('')
      const statsData = await api.getDocumentInboxStats()
      setStats(statsData)
    } catch (error) {
      console.error('Failed to link:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleArchive = async (itemId: string) => {
    setActionLoading(itemId)
    try {
      const updated = await api.archiveDocumentInboxItem(itemId)
      setItems(items.map(i => i.id === updated.id ? updated : i))
      if (selectedItem?.id === updated.id) setSelectedItem(updated)
      const statsData = await api.getDocumentInboxStats()
      setStats(statsData)
    } catch (error) {
      console.error('Failed to archive:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    setBatchUploading(true)
    try {
      const files = Array.from(e.target.files)
      await api.batchUploadDocuments(files, { auto_classify: batchAutoClassify })
      setShowBatchUpload(false)
      await fetchData()
    } catch (error) {
      console.error('Batch upload failed:', error)
    } finally {
      setBatchUploading(false)
    }
  }

  const handleEnhanceImage = async (documentId: string) => {
    setEnhancingDoc(documentId)
    try {
      await api.enhanceDocumentImage(documentId, { auto_deskew: true, brightness: 1.1, contrast: 1.2 })
    } catch (error) {
      console.error('Image enhancement failed:', error)
    } finally {
      setEnhancingDoc(null)
    }
  }

  const handleOCR = async (documentId: string) => {
    setOcrLoading(documentId)
    try {
      await api.extractOCR(documentId)
    } catch (error) {
      console.error('OCR extraction failed:', error)
    } finally {
      setOcrLoading(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Inbox className="h-7 w-7 text-emerald-600" />
            Document Inbox
          </h1>
          <p className="text-gray-500">
            Incoming documents with AI classification and entity linking
          </p>
        </div>
        <button
          onClick={() => setShowBatchUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          <Upload className="h-4 w-4" />
          Batch Upload
        </button>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">New Documents</p>
            <p className="text-2xl font-bold text-yellow-600">
              {stats.by_status?.new || 0}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Classified</p>
            <p className="text-2xl font-bold text-blue-600">
              {stats.by_status?.classified || 0}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Linked</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.by_status?.linked || 0}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-2">
          <span className="text-sm text-gray-500 self-center">Status:</span>
          {[
            { value: 'all', label: 'All' },
            { value: 'new', label: 'New' },
            { value: 'classified', label: 'Classified' },
            { value: 'linked', label: 'Linked' },
            { value: 'archived', label: 'Archived' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <span className="text-sm text-gray-500 self-center">Type:</span>
          {[
            { value: 'all', label: 'All Types' },
            { value: 'bol', label: 'BOL' },
            { value: 'pod', label: 'POD' },
            { value: 'rate_confirmation', label: 'Rate Con' },
            { value: 'invoice', label: 'Invoice' },
            { value: 'insurance_cert', label: 'Insurance' },
            { value: 'unknown', label: 'Unknown' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setClassificationFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                classificationFilter === f.value
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">Loading document inbox...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">Inbox is clear</p>
          <p className="text-gray-500 mt-1">No documents match the current filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-6">
          {/* Document List (3 cols) */}
          <div className="col-span-3 bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">
                {items.length} Document{items.length !== 1 ? 's' : ''}
              </h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-[650px] overflow-y-auto">
              {items.map((item) => {
                const SourceIcon = SOURCE_ICONS[item.source] || FileText
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedItem?.id === item.id ? 'bg-emerald-50 border-l-2 border-emerald-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                          <SourceIcon className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {item.filename}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[item.status]}`}>
                              {item.status}
                            </span>
                            {item.classification && (
                              <span className={`text-xs px-2 py-0.5 rounded font-medium ${CLASSIFICATION_COLORS[item.classification]}`}>
                                {CLASSIFICATION_LABELS[item.classification] || item.classification}
                              </span>
                            )}
                            {item.classification_confidence != null && item.classification_confidence > 0 && (
                              <span className="text-xs text-gray-400">
                                {Math.round(item.classification_confidence * 100)}%
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {item.source} - {formatFileSize(item.file_size)} - {formatDate(item.created_at)}
                          </p>
                        </div>
                      </div>
                      {item.linked_entity_type && (
                        <span className="flex-shrink-0 flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          <Link2 className="h-3 w-3" />
                          {item.linked_entity_type}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Detail Panel (2 cols) */}
          <div className="col-span-2 bg-white rounded-xl border border-gray-200">
            {selectedItem ? (
              <>
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Document Details</h2>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                  {/* File Info */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">File Info</h3>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                      <p><span className="text-gray-500">Filename:</span> {selectedItem.filename}</p>
                      <p><span className="text-gray-500">Type:</span> {selectedItem.file_type}</p>
                      <p><span className="text-gray-500">Size:</span> {formatFileSize(selectedItem.file_size)}</p>
                      <p><span className="text-gray-500">Source:</span> {selectedItem.source}</p>
                      {selectedItem.source_email && (
                        <p><span className="text-gray-500">From:</span> {selectedItem.source_email}</p>
                      )}
                    </div>
                  </div>

                  {/* Classification */}
                  {selectedItem.classification && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-500" />
                        AI Classification
                      </h3>
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-1 rounded font-medium ${CLASSIFICATION_COLORS[selectedItem.classification]}`}>
                            {CLASSIFICATION_LABELS[selectedItem.classification] || selectedItem.classification}
                          </span>
                          {selectedItem.classification_confidence != null && (
                            <span className="text-gray-500">
                              {Math.round(selectedItem.classification_confidence * 100)}% confidence
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Extracted Metadata */}
                  {selectedItem.metadata && Object.keys(selectedItem.metadata).length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Extracted Data
                      </h3>
                      <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                        {Object.entries(selectedItem.metadata).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}:</span>
                            <span className="font-medium text-gray-900">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Linked Entity */}
                  {selectedItem.linked_entity_type && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Linked Entity
                      </h3>
                      <div className="bg-green-50 rounded-lg p-3 text-sm">
                        <p className="text-green-700 font-medium flex items-center gap-2">
                          <Link2 className="h-4 w-4" />
                          {selectedItem.linked_entity_type}: {selectedItem.linked_entity_id?.slice(-8)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-2 pt-4 border-t border-gray-200">
                    {selectedItem.status === 'new' && (
                      <button
                        onClick={() => handleClassify(selectedItem.id)}
                        disabled={actionLoading === selectedItem.id}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {actionLoading === selectedItem.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        Classify with AI
                      </button>
                    )}
                    {selectedItem.status !== 'archived' && selectedItem.status !== 'linked' && (
                      <button
                        onClick={() => setShowLinkModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Link2 className="h-4 w-4" />
                        Link to Entity
                      </button>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEnhanceImage(selectedItem.id)}
                        disabled={enhancingDoc === selectedItem.id}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
                      >
                        {enhancingDoc === selectedItem.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Image className="h-4 w-4" />
                        )}
                        Enhance
                      </button>
                      <button
                        onClick={() => handleOCR(selectedItem.id)}
                        disabled={ocrLoading === selectedItem.id}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
                      >
                        {ocrLoading === selectedItem.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ScanLine className="h-4 w-4" />
                        )}
                        Run OCR
                      </button>
                    </div>
                    {selectedItem.status !== 'archived' && (
                      <button
                        onClick={() => handleArchive(selectedItem.id)}
                        disabled={actionLoading === selectedItem.id}
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        <Archive className="h-4 w-4" />
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <Eye className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p>Select a document to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Link Document to Entity</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
                <select
                  value={linkEntityType}
                  onChange={(e) => setLinkEntityType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="shipment">Shipment</option>
                  <option value="carrier">Carrier</option>
                  <option value="customer">Customer</option>
                  <option value="invoice">Invoice</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entity ID</label>
                <input
                  type="text"
                  value={linkEntityId}
                  onChange={(e) => setLinkEntityId(e.target.value)}
                  placeholder="Enter entity ID..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowLinkModal(false); setLinkEntityId('') }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleLink(selectedItem.id)}
                  disabled={!linkEntityId.trim() || actionLoading === selectedItem.id}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actionLoading === selectedItem.id ? 'Linking...' : 'Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Upload Modal */}
      {showBatchUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Batch Document Upload</h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Upload multiple documents at once. AI classification will automatically identify document types
                and extract relevant data.
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={batchAutoClassify}
                  onChange={(e) => setBatchAutoClassify(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">Auto-classify with AI</span>
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <label className="cursor-pointer">
                  <span className="text-emerald-600 font-medium hover:text-emerald-700">Choose files</span>
                  <span className="text-gray-500 text-sm"> or drag and drop</span>
                  <input
                    type="file"
                    multiple
                    onChange={handleBatchUpload}
                    className="hidden"
                    disabled={batchUploading}
                  />
                </label>
                <p className="text-xs text-gray-400 mt-2">PDF, images, and document files accepted</p>
              </div>
              {batchUploading && (
                <div className="flex items-center justify-center gap-2 text-emerald-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Uploading and processing...</span>
                </div>
              )}
              <button
                onClick={() => setShowBatchUpload(false)}
                disabled={batchUploading}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
