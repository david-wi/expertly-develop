import { useState, useEffect, useRef } from 'react'
import { api } from '../services/api'
import type { Document, DocumentType } from '../types'
import { DOCUMENT_TYPE_LABELS } from '../types'
import {
  Upload,
  FileText,
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface ShipmentDocumentsProps {
  shipmentId: string
}

const DOCUMENT_TYPES: DocumentType[] = [
  'bol',
  'pod',
  'rate_confirmation',
  'lumper_receipt',
  'scale_ticket',
  'carrier_invoice',
  'commercial_invoice',
  'other',
]

export default function ShipmentDocuments({ shipmentId }: ShipmentDocumentsProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadType, setUploadType] = useState<DocumentType>('bol')
  const [uploadDescription, setUploadDescription] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchDocuments()
  }, [shipmentId])

  const fetchDocuments = async () => {
    try {
      const docs = await api.getDocuments({ shipment_id: shipmentId })
      setDocuments(docs)
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const doc = await api.uploadDocument(file, {
        document_type: uploadType,
        shipment_id: shipmentId,
        description: uploadDescription || undefined,
        auto_process: true,
        source: 'upload',
      })
      setDocuments([doc, ...documents])
      setShowUploadForm(false)
      setUploadDescription('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      await api.deleteDocument(docId)
      setDocuments(documents.filter(d => d.id !== docId))
      if (selectedDoc?.id === docId) {
        setSelectedDoc(null)
      }
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const handleVerify = async (docId: string) => {
    try {
      const updated = await api.verifyDocument(docId)
      setDocuments(documents.map(d => d.id === docId ? updated : d))
      if (selectedDoc?.id === docId) {
        setSelectedDoc(updated)
      }
    } catch (error) {
      console.error('Verify failed:', error)
    }
  }

  const handleReprocess = async (docId: string) => {
    try {
      const updated = await api.processDocument(docId)
      setDocuments(documents.map(d => d.id === docId ? updated : d))
    } catch (error) {
      console.error('Reprocess failed:', error)
    }
  }

  const getStatusIcon = (doc: Document) => {
    switch (doc.extraction_status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />
      case 'processing':
      case 'pending':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <FileText className="h-4 w-4 text-gray-400" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
        <p className="text-sm text-gray-500 mt-2">Loading documents...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Upload Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
        >
          <Upload className="h-4 w-4" />
          Upload Document
        </button>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Type
              </label>
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value as DocumentType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {DOCUMENT_TYPES.map(type => (
                  <option key={type} value={type}>
                    {DOCUMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Add a note..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept="image/*,.pdf"
              className="hidden"
              id="document-upload"
            />
            <label
              htmlFor="document-upload"
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                  <span className="text-sm text-gray-600">Uploading & processing...</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Click to select file or drag and drop
                  </span>
                </>
              )}
            </label>
            <button
              onClick={() => setShowUploadForm(false)}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Document List */}
      {documents.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No documents uploaded yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Upload BOLs, PODs, rate confirmations and more
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {documents.map(doc => (
            <div
              key={doc.id}
              className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${selectedDoc?.id === doc.id ? 'bg-emerald-50' : ''}`}
              onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getStatusIcon(doc)}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{doc.original_filename}</p>
                      {doc.is_verified && (
                        <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                          Verified
                        </span>
                      )}
                      {doc.auto_matched && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          AI Matched
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      <span>{DOCUMENT_TYPE_LABELS[doc.document_type]}</span>
                      <span>{formatFileSize(doc.size_bytes)}</span>
                      {doc.created_at && (
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={api.getDocumentDownloadUrl(doc.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    title="View details"
                  >
                    {selectedDoc?.id === doc.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded View */}
              {selectedDoc?.id === doc.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  {/* Extraction Status */}
                  {doc.extraction_status === 'processing' && (
                    <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      AI is analyzing this document...
                    </div>
                  )}

                  {doc.extraction_status === 'failed' && (
                    <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center justify-between">
                      <span>Extraction failed</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleReprocess(doc.id)
                        }}
                        className="text-sm underline hover:no-underline"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Extracted Fields */}
                  {doc.extracted_fields && doc.extracted_fields.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-500" />
                        AI Extracted Fields
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {doc.extracted_fields.map((field, idx) => (
                          <div
                            key={idx}
                            className="bg-gray-50 px-3 py-2 rounded text-sm"
                            title={field.evidence_text || undefined}
                          >
                            <span className="text-gray-500">{formatFieldName(field.field_name)}:</span>{' '}
                            <span className="font-medium text-gray-900">
                              {field.value || '-'}
                            </span>
                            {field.confidence >= 0.9 && (
                              <CheckCircle className="h-3 w-3 text-emerald-500 inline ml-1" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* OCR Text Preview */}
                  {doc.ocr_text && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Extracted Text Preview
                      </h4>
                      <div className="bg-gray-50 p-3 rounded text-xs text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                        {doc.ocr_text.slice(0, 500)}
                        {doc.ocr_text.length > 500 && '...'}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!doc.is_verified && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleVerify(doc.id)
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Mark Verified
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(doc.id)
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatFieldName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}
