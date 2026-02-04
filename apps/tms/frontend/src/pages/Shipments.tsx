import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../services/api'
import type { Shipment } from '../types'
import { ArrowRight, AlertTriangle, Truck, Package, CheckCircle } from 'lucide-react'

const statusColors: Record<string, string> = {
  booked: 'bg-gray-100 text-gray-700',
  pending_pickup: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-yellow-100 text-yellow-700',
  out_for_delivery: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const statusIcons: Record<string, typeof Truck> = {
  booked: Package,
  pending_pickup: Package,
  in_transit: Truck,
  out_for_delivery: Truck,
  delivered: CheckCircle,
  completed: CheckCircle,
}

export default function Shipments() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all')
  const [atRiskOnly, setAtRiskOnly] = useState(searchParams.get('at_risk') === 'true')

  useEffect(() => {
    const fetchShipments = async () => {
      setLoading(true)
      try {
        const params: Record<string, string> = {}
        if (statusFilter !== 'all') params.status = statusFilter
        if (atRiskOnly) params.at_risk = 'true'
        const data = await api.getShipments(params)
        setShipments(data)
      } catch (error) {
        console.error('Failed to fetch shipments:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchShipments()
  }, [statusFilter, atRiskOnly])

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status)
    const params = new URLSearchParams(searchParams)
    if (status === 'all') {
      params.delete('status')
    } else {
      params.set('status', status)
    }
    setSearchParams(params)
  }

  const handleAtRiskToggle = () => {
    const newValue = !atRiskOnly
    setAtRiskOnly(newValue)
    const params = new URLSearchParams(searchParams)
    if (newValue) {
      params.set('at_risk', 'true')
    } else {
      params.delete('at_risk')
    }
    setSearchParams(params)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
          <p className="text-gray-500">
            {shipments.length} shipment{shipments.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'booked', label: 'Booked' },
            { value: 'pending_pickup', label: 'Pending Pickup' },
            { value: 'in_transit', label: 'In Transit' },
            { value: 'delivered', label: 'Delivered' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => handleStatusFilter(f.value)}
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
        <button
          onClick={handleAtRiskToggle}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            atRiskOnly
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          At Risk Only
        </button>
      </div>

      {/* Shipments List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : shipments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No shipments found
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {shipments.map((shipment) => {
              const Icon = statusIcons[shipment.status] || Truck
              return (
                <li key={shipment.id}>
                  <Link
                    to={`/shipments/${shipment.id}`}
                    className="block p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${
                          shipment.at_risk ? 'bg-red-100' : 'bg-gray-100'
                        }`}>
                          <Icon className={`h-5 w-5 ${
                            shipment.at_risk ? 'text-red-600' : 'text-gray-600'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900">
                              {shipment.shipment_number}
                            </h3>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColors[shipment.status]}`}>
                              {shipment.status.replace(/_/g, ' ')}
                            </span>
                            {shipment.at_risk && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                At Risk
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                            <span>{shipment.origin_city}, {shipment.origin_state}</span>
                            <ArrowRight className="h-4 w-4" />
                            <span>{shipment.destination_city}, {shipment.destination_state}</span>
                          </div>
                          {shipment.carrier_name && (
                            <p className="mt-1 text-sm text-gray-500">
                              Carrier: {shipment.carrier_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          ${((shipment.customer_price || 0) / 100).toFixed(2)}
                        </p>
                        {shipment.pickup_date && (
                          <p className="text-xs text-gray-500">
                            Pickup: {new Date(shipment.pickup_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
