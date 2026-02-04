import { create } from 'zustand'
import { api } from '../services/api'
import type { Customer, Carrier, Shipment, WorkItem, DashboardStats } from '../types'

interface AppState {
  // Data
  customers: Customer[]
  carriers: Carrier[]
  shipments: Shipment[]
  workItems: WorkItem[]
  dashboardStats: DashboardStats | null

  // Loading states
  loading: {
    customers: boolean
    carriers: boolean
    shipments: boolean
    workItems: boolean
    dashboard: boolean
  }

  // Actions
  fetchCustomers: () => Promise<void>
  fetchCarriers: () => Promise<void>
  fetchShipments: (params?: { status?: string }) => Promise<void>
  fetchWorkItems: () => Promise<void>
  fetchDashboardStats: () => Promise<void>

  // Mutations
  addShipment: (shipment: Shipment) => void
  updateShipment: (shipment: Shipment) => void
  removeWorkItem: (id: string) => void
}

export const useAppStore = create<AppState>((set, _get) => ({
  customers: [],
  carriers: [],
  shipments: [],
  workItems: [],
  dashboardStats: null,
  loading: {
    customers: false,
    carriers: false,
    shipments: false,
    workItems: false,
    dashboard: false,
  },

  fetchCustomers: async () => {
    set((state) => ({ loading: { ...state.loading, customers: true } }))
    try {
      const customers = await api.getCustomers()
      set({ customers })
    } catch (error) {
      console.error('Failed to fetch customers:', error)
    } finally {
      set((state) => ({ loading: { ...state.loading, customers: false } }))
    }
  },

  fetchCarriers: async () => {
    set((state) => ({ loading: { ...state.loading, carriers: true } }))
    try {
      const carriers = await api.getCarriers()
      set({ carriers })
    } catch (error) {
      console.error('Failed to fetch carriers:', error)
    } finally {
      set((state) => ({ loading: { ...state.loading, carriers: false } }))
    }
  },

  fetchShipments: async (params?: { status?: string }) => {
    set((state) => ({ loading: { ...state.loading, shipments: true } }))
    try {
      const shipments = await api.getShipments(params)
      set({ shipments })
    } catch (error) {
      console.error('Failed to fetch shipments:', error)
    } finally {
      set((state) => ({ loading: { ...state.loading, shipments: false } }))
    }
  },

  fetchWorkItems: async () => {
    set((state) => ({ loading: { ...state.loading, workItems: true } }))
    try {
      const workItems = await api.getWorkItems()
      set({ workItems })
    } catch (error) {
      console.error('Failed to fetch work items:', error)
    } finally {
      set((state) => ({ loading: { ...state.loading, workItems: false } }))
    }
  },

  fetchDashboardStats: async () => {
    set((state) => ({ loading: { ...state.loading, dashboard: true } }))
    try {
      const dashboardStats = await api.getDashboardStats()
      set({ dashboardStats })
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      set((state) => ({ loading: { ...state.loading, dashboard: false } }))
    }
  },

  addShipment: (shipment) => {
    set((state) => ({ shipments: [shipment, ...state.shipments] }))
  },

  updateShipment: (shipment) => {
    set((state) => ({
      shipments: state.shipments.map((s) => (s.id === shipment.id ? shipment : s)),
    }))
  },

  removeWorkItem: (id) => {
    set((state) => ({
      workItems: state.workItems.filter((w) => w.id !== id),
    }))
  },
}))
