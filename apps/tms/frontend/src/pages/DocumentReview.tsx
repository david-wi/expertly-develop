import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { Document } from '../types'
import { DOCUMENT_TYPE_LABELS } from '../types'
import {
  FileText,
  Sparkles,
  CheckCircle,
  Link2,
  Eye,
  Download,
  Trash2,
  Loader2,
  Search,
  X,
} from 'lucide-react'

export default function DocumentReview() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [shipmentSearch, setShipmentSearch] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; shipment_number: string }[]>([])
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    fetchPendingDocuments()
  }, [])

  const fetchPendingDocuments = async () => {
    try {
      const docs = await api.getDocumentsPendingReview()
      setDocuments(docs)
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLinkToShipment = async (docId: string, shipmentId: string) => {
    setLinking(true)
    try {
      await api.linkDocumentToShipment(docId, shipmentId)
      setDocuments(documents.filter(d => d.id !== docId))
      setSelectedDoc(null)
      setShipmentSearch('')
      setSearchResults([])
    } catch (error) {
      console.error('Failed to link document:', error)
    } finally {
      setLinking(false)
    }
  }

  const handleVerify = async (docId: string) => {
    try {
      await api.verifyDocument(docId)
      setDocuments(documents.filter(d => d.id !== docId))
      setSelectedDoc(null)
    } catch (error) {
      console.error('Failed to verify document:', error)
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
      console.error('Failed to delete document:', error)
    }
  }

  const searchShipments = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    try {
      // Search shipments by number
      const shipments = await api.getShipments({ search: query })
      setSearchResults(shipments.slice(0, 5).map(s => ({
        id: s.id,
        shipment_number: s.shipment_number,
      })))
    } catch (error) {
      console.error('Search failed:', error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
        <p className="text-gray-500 mt-2">Loading documents for review...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="h-7 w-7 text-emerald-600" />
          Document Review Queue
        </h1>
        <p className="text-gray-500">
          Review and link documents that couldn't be auto-matched to shipments
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Pending Review</p>
          <p className="text-2xl font-bold text-gray-900">{documents.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">With AI Suggestions</p>
          <p className="text-2xl font-bold text-emerald-600">
            {documents.filter(d => d.suggested_shipment_ids && d.suggested_shipment_ids.length > 0).length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Unlinked</p>
          <p className="text-2xl font-bold text-amber-600">
            {documents.filter(d => !d.shipment_id).length}
          </p>
        </div>
      </div>

      {/* Document List */}
      {documents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">All caught up!</p>
          <p className="text-gray-500 mt-1">No documents need review right now</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {/* Document List */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Documents</h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {documents.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedDoc?.id === doc.id ? 'bg-emerald-50 border-l-2 border-emerald-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900 truncate max-w-[200px]">
                        {doc.original_filename}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {DOCUMENT_TYPE_LABELS[doc.document_type]}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatFileSize(doc.size_bytes)}
                        </span>
                      </div>
                    </div>
                    {doc.suggested_shipment_ids && doc.suggested_shipment_ids.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                        <Sparkles className="h-3 w-3" />
                        AI Match
                      </span>
                    )}
                  </div>

                  {/* AI Suggestions Preview */}
                  {doc.match_confidence && doc.match_confidence > 0.7 && (
                    <div className="mt-2 text-xs text-gray-500">
                      {Math.round(doc.match_confidence * 100)}% match confidence
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Detail Panel */}
          <div className="bg-white rounded-xl border border-gray-200">
            {selectedDoc ? (
              <>
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Document Details</h2>
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-4 space-y-4 max-h-[550px] overflow-y-auto">
                  {/* Document Info */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">File Info</h3>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                      <p><span className="text-gray-500">Name:</span> {selectedDoc.original_filename}</p>
                      <p><span className="text-gray-500">Type:</span> {DOCUMENT_TYPE_LABELS[selectedDoc.document_type]}</p>
                      <p><span className="text-gray-500">Size:</span> {formatFileSize(selectedDoc.size_bytes)}</p>
                      {selectedDoc.ai_classified_type && selectedDoc.ai_classified_type !== selectedDoc.document_type && (
                        <p className="text-amber-600">
                          <span className="text-gray-500">AI suggests:</span> {DOCUMENT_TYPE_LABELS[selectedDoc.ai_classified_type]}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Extracted Fields */}
                  {selectedDoc.extracted_fields && selectedDoc.extracted_fields.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-500" />
                        Extracted Data
                      </h3>
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                        {selectedDoc.extracted_fields.slice(0, 8).map((field, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span className="text-gray-500">{formatFieldName(field.field_name)}:</span>
                            <span className="font-medium text-gray-900 truncate max-w-[150px]">
                              {field.value || '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Suggested Shipments */}
                  {selectedDoc.suggested_shipment_ids && selectedDoc.suggested_shipment_ids.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        AI Suggested Matches
                      </h3>
                      <div className="space-y-2">
                        {selectedDoc.suggested_shipment_ids.map(shipmentId => (
                          <button
                            key={shipmentId}
                            onClick={() => handleLinkToShipment(selectedDoc.id, shipmentId)}
                            disabled={linking}
                            className="w-full flex items-center justify-between px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <span className="flex items-center gap-2">
                              <Link2 className="h-4 w-4" />
                              Link to Shipment
                            </span>
                            <span className="text-xs">{shipmentId.slice(-8)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual Search */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      Search Shipment
                    </h3>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={shipmentSearch}
                        onChange={(e) => {
                          setShipmentSearch(e.target.value)
                          searchShipments(e.target.value)
                        }}
                        placeholder="Search by shipment number..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    {searchResults.length > 0 && (
                      <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
                        {searchResults.map(result => (
                          <button
                            key={result.id}
                            onClick={() => handleLinkToShipment(selectedDoc.id, result.id)}
                            disabled={linking}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                          >
                            <span>{result.shipment_number}</span>
                            <Link2 className="h-4 w-4 text-gray-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* OCR Preview */}
                  {selectedDoc.ocr_text && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Text Preview
                      </h3>
                      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                        {selectedDoc.ocr_text.slice(0, 400)}
                        {selectedDoc.ocr_text.length > 400 && '...'}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                    <a
                      href={api.getDocumentDownloadUrl(selectedDoc.id)}
                      className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                    <button
                      onClick={() => handleVerify(selectedDoc.id)}
                      className="flex items-center gap-1 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 rounded"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Mark Reviewed
                    </button>
                    <button
                      onClick={() => handleDelete(selectedDoc.id)}
                      className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded ml-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
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
    </div>
  )
}

function formatFieldName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}
