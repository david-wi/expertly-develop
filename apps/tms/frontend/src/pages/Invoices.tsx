import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { Invoice } from '../types'
import { FileText, Send, Check, DollarSign } from 'lucide-react'

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  void: 'bg-red-100 text-red-700',
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchInvoices()
  }, [statusFilter])

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (statusFilter !== 'all') params.status = statusFilter
      const data = await api.getInvoices(params)
      setInvoices(data)
    } catch (error) {
      console.error('Failed to fetch invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async (invoice: Invoice) => {
    try {
      const updated = await api.sendInvoice(invoice.id)
      setInvoices(invoices.map(i => i.id === updated.id ? updated : i))
    } catch (error) {
      console.error('Failed to send invoice:', error)
    }
  }

  const handleMarkPaid = async (invoice: Invoice) => {
    try {
      const updated = await api.markInvoicePaid(invoice.id)
      setInvoices(invoices.map(i => i.id === updated.id ? updated : i))
    } catch (error) {
      console.error('Failed to mark invoice paid:', error)
    }
  }

  const totalOutstanding = invoices
    .filter(i => i.status === 'sent')
    .reduce((sum, i) => sum + (i.total || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500">
            {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <FileText className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Draft</p>
              <p className="text-xl font-bold">{invoices.filter(i => i.status === 'draft').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Send className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Outstanding</p>
              <p className="text-xl font-bold">${(totalOutstanding / 100).toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Paid (30d)</p>
              <p className="text-xl font-bold">
                ${(invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0) / 100).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: 'All' },
          { value: 'draft', label: 'Draft' },
          { value: 'sent', label: 'Sent' },
          { value: 'paid', label: 'Paid' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No invoices found
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Invoice #</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Customer</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Shipment</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Amount</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{invoice.invoice_number}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {invoice.customer_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {invoice.shipment_number || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {invoice.invoice_date
                      ? new Date(invoice.invoice_date).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                    ${((invoice.total || 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColors[invoice.status]}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {invoice.status === 'draft' && (
                        <button
                          onClick={() => handleSend(invoice)}
                          className="flex items-center gap-1 px-2 py-1 text-sm text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          <Send className="h-4 w-4" />
                          Send
                        </button>
                      )}
                      {invoice.status === 'sent' && (
                        <button
                          onClick={() => handleMarkPaid(invoice)}
                          className="flex items-center gap-1 px-2 py-1 text-sm text-green-600 hover:bg-green-50 rounded"
                        >
                          <Check className="h-4 w-4" />
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
