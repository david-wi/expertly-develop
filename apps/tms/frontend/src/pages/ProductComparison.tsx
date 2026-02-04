import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  X,
  Clock,
  CircleDot,
  Truck,
  Brain,
  Zap,
  FileText,
  Mail,
  DollarSign,
  BarChart3,
  Settings,
  Smartphone,
  Network,
  Package,
  MapPin,
  ClipboardList,
  Send,
  Eye,
  FolderOpen,
  PieChart,
  Scale,
  Sparkles,
  Server,
  HelpCircle,
  ChevronUp,
} from 'lucide-react'
import { useState, useEffect } from 'react'

// ========================================
// Types
// ========================================

type FeatureStatus = boolean | 'partial' | 'addon' | 'planned'

interface Feature {
  id: string
  name: string
  description?: string
  mcleod: FeatureStatus
  trimble: FeatureStatus
  mercurygate: FeatureStatus
  descartes: FeatureStatus
  dat: FeatureStatus
  expertly: FeatureStatus
  notes?: {
    mcleod?: string
    trimble?: string
    mercurygate?: string
    descartes?: string
    dat?: string
    expertly?: string
  }
}

interface Category {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  features: Feature[]
}

// ========================================
// Logo Component (reused from LandingPage)
// ========================================

function ExpertlyLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.8379 24.9606C16.6714 22.9391 17.9566 20.4822 18.571 17.8238L24.2667 20.4657C24.3728 20.4481 24.4733 20.4064 24.5606 20.3436C24.6478 20.2809 24.7194 20.1989 24.7698 20.104C24.8201 20.0091 24.8479 19.9039 24.8509 19.7965C24.8539 19.6892 24.832 19.5826 24.7871 19.485L19.4266 8.14301C19.3632 8.00575 19.2699 7.88442 19.1535 7.78793C19.037 7.69144 18.9004 7.62224 18.7537 7.58542C18.607 7.5486 18.4539 7.54509 18.3057 7.57515C18.1574 7.60521 18.0178 7.66808 17.897 7.75913L7.63363 15.6497C7.10981 16.0196 7.36125 16.9409 7.98285 16.92L14.0452 16.6931C14.0452 16.6931 13.2106 20.2912 8.35301 22.0047L8.27269 22.0326C2.61541 23.4285 -0.000202179 18.7452 -0.000202179 15.7509C-0.00718689 7.22169 7.2006 0.699166 15.1173 0.0570345C17.8181 -0.167956 20.5328 0.274916 23.0218 1.34656C25.5108 2.41821 27.6976 4.08568 29.3891 6.2018C31.0806 8.31791 32.2249 10.8176 32.7209 13.4803C33.2169 16.1429 33.0494 18.8867 32.2332 21.4693C31.4169 24.0519 29.9771 26.3941 28.0407 28.289C26.1043 30.184 23.7309 31.5734 21.13 32.3347C18.5291 33.096 15.7807 33.2058 13.1273 32.6544C10.4738 32.103 7.99705 30.9073 5.91549 29.1728C9.17716 28.7959 12.4772 27.6408 14.8379 24.9606Z" fill="url(#paint0_linear_compare)" />
      <defs>
        <linearGradient id="paint0_linear_compare" x1="32.9998" y1="33" x2="-6.71734" y2="18.8377" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ========================================
// Status Display Components
// ========================================

function StatusIcon({ status }: { status: FeatureStatus }) {
  if (status === true) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
        <Check className="w-4 h-4 text-green-600" />
      </span>
    )
  }
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100">
        <CircleDot className="w-4 h-4 text-yellow-600" />
      </span>
    )
  }
  if (status === 'addon') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100">
        <span className="text-blue-600 text-xs font-bold">+</span>
      </span>
    )
  }
  if (status === 'planned') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100">
        <Clock className="w-4 h-4 text-purple-600" />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
      <X className="w-4 h-4 text-gray-400" />
    </span>
  )
}

// ========================================
// Feature Data
// ========================================

const categories: Category[] = [
  {
    id: 'quote-management',
    name: 'Quote Management',
    icon: FileText,
    features: [
      { id: 'manual-quote', name: 'Manual quote creation', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'email-quote', name: 'Email-to-quote extraction', description: 'Parse incoming emails to auto-fill quote fields', mcleod: false, trimble: false, mercurygate: 'partial', descartes: false, dat: false, expertly: true },
      { id: 'ai-extraction', name: 'AI-powered field extraction with evidence', description: 'AI extracts fields and shows source text as proof', mcleod: false, trimble: false, mercurygate: false, descartes: false, dat: false, expertly: true },
      { id: 'quote-templates', name: 'Quote templates', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'multi-stop-quote', name: 'Multi-stop quote support', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: true },
      { id: 'quote-expiration', name: 'Quote expiration tracking', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'quote-versioning', name: 'Quote versioning/revisions', mcleod: true, trimble: true, mercurygate: true, descartes: 'partial', dat: false, expertly: 'planned' },
      { id: 'customer-pricing', name: 'Customer-specific pricing rules', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'planned' },
      { id: 'margin-calc', name: 'Margin calculation & display', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'quote-pdf', name: 'Quote PDF generation', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'email-quote-direct', name: 'Email quote directly from system', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'quote-approval', name: 'Quote approval workflows', mcleod: 'addon', trimble: true, mercurygate: true, descartes: false, dat: false, expertly: 'planned' },
      { id: 'quote-to-shipment', name: 'Quote-to-shipment conversion', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
    ],
  },
  {
    id: 'order-load-management',
    name: 'Order/Load Management',
    icon: Package,
    features: [
      { id: 'load-entry', name: 'Load entry from scratch', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'edi-204-accept', name: 'EDI 204 load tender acceptance', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: false, expertly: 'planned' },
      { id: 'recurring-templates', name: 'Recurring load templates', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'planned' },
      { id: 'multi-stop-loads', name: 'Multi-stop/multi-pickup loads', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'ltl-consolidation', name: 'LTL consolidation', mcleod: true, trimble: true, mercurygate: true, descartes: 'partial', dat: false, expertly: 'planned' },
      { id: 'split-shipments', name: 'Split shipments', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: false, expertly: 'planned' },
      { id: 'cross-docking', name: 'Cross-docking support', mcleod: true, trimble: true, mercurygate: true, descartes: 'partial', dat: false, expertly: false },
      { id: 'order-status', name: 'Order status tracking', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'customer-portal-orders', name: 'Customer portal for orders', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned' },
      { id: 'bulk-import', name: 'Bulk load import (CSV/Excel)', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'planned' },
    ],
  },
  {
    id: 'dispatch-planning',
    name: 'Dispatch & Load Planning',
    icon: MapPin,
    features: [
      { id: 'dispatch-board', name: 'Dispatch board/calendar view', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'drag-drop', name: 'Drag-and-drop dispatching', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: true },
      { id: 'driver-assignment', name: 'Driver assignment', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'equipment-assignment', name: 'Equipment assignment', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'partial' },
      { id: 'route-optimization', name: 'Route optimization', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'partial', dat: false, expertly: 'planned' },
      { id: 'mileage-calc', name: 'Mileage calculation', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'fuel-surcharge', name: 'Fuel surcharge auto-calculation', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'planned' },
      { id: 'appointment-scheduling', name: 'Appointment scheduling', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: true },
      { id: 'driver-availability', name: 'Driver availability tracking', mcleod: true, trimble: true, mercurygate: true, descartes: 'partial', dat: false, expertly: 'partial' },
      { id: 'realtime-location', name: 'Real-time driver location', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned' },
    ],
  },
  {
    id: 'carrier-management',
    name: 'Carrier Management',
    icon: Truck,
    features: [
      { id: 'carrier-db', name: 'Carrier database', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'mc-dot-tracking', name: 'MC/DOT number tracking', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'insurance-cert', name: 'Insurance certificate tracking', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'insurance-alerts', name: 'Insurance expiration alerts', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'carrier-scoring', name: 'Carrier scoring/rating', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'lane-history', name: 'Lane history by carrier', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'ontime-tracking', name: 'On-time percentage tracking', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'carrier-onboarding', name: 'Carrier onboarding workflow', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'partial' },
      { id: 'compliance-dashboard', name: 'Carrier compliance dashboard', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: true },
      { id: 'preferred-carriers', name: 'Preferred carrier lists', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'carrier-blacklist', name: 'Carrier blacklisting', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'capacity-tracking', name: 'Carrier capacity tracking', mcleod: 'partial', trimble: true, mercurygate: true, descartes: 'partial', dat: true, expertly: 'planned' },
    ],
  },
  {
    id: 'tendering-procurement',
    name: 'Tendering & Procurement',
    icon: Send,
    features: [
      { id: 'manual-tender', name: 'Manual tender creation', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'auto-waterfall', name: 'Automated tender waterfall', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'planned' },
      { id: 'spot-market', name: 'Spot market integration (DAT, Truckstop)', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: true, expertly: 'planned' },
      { id: 'rate-confirmation', name: 'Rate confirmation generation', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'rate-negotiation', name: 'Carrier rate negotiation tracking', mcleod: 'partial', trimble: 'partial', mercurygate: true, descartes: 'partial', dat: 'partial', expertly: 'planned' },
      { id: 'tender-tracking', name: 'Tender acceptance/rejection tracking', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'counter-offer', name: 'Counter-offer workflows', mcleod: 'partial', trimble: 'partial', mercurygate: true, descartes: false, dat: 'partial', expertly: 'planned' },
      { id: 'carrier-portal-tender', name: 'Carrier portal for tenders', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned' },
    ],
  },
  {
    id: 'tracking-visibility',
    name: 'Tracking & Visibility',
    icon: Eye,
    features: [
      { id: 'gps-tracking', name: 'Real-time GPS tracking', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned' },
      { id: 'check-calls', name: 'Check call scheduling', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'auto-tracking', name: 'Automated tracking updates', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned' },
      { id: 'eld-integration', name: 'ELD/telematics integration', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned' },
      { id: 'geofence-alerts', name: 'Geofence alerts (arrival/departure)', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned' },
      { id: 'exception-alerting', name: 'Exception alerting (late, at-risk)', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: true },
      { id: 'customer-tracking', name: 'Customer tracking portal', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned' },
      { id: 'tracking-timeline', name: 'Tracking history/timeline', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'pod-capture', name: 'Proof of delivery capture', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'partial' },
      { id: 'photo-capture', name: 'Photo/document capture on delivery', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned' },
    ],
  },
  {
    id: 'edi-integrations',
    name: 'EDI & Integrations',
    icon: Network,
    features: [
      { id: 'edi-204', name: 'EDI 204 (Load Tender)', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: false, expertly: 'planned' },
      { id: 'edi-990', name: 'EDI 990 (Tender Response)', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: false, expertly: 'planned' },
      { id: 'edi-214', name: 'EDI 214 (Status Update)', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: false, expertly: 'planned' },
      { id: 'edi-210', name: 'EDI 210 (Invoice)', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: false, expertly: 'planned' },
      { id: 'api-access', name: 'API access', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'quickbooks', name: 'QuickBooks integration', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: true, dat: 'addon', expertly: 'planned' },
      { id: 'sage', name: 'Sage integration', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: false },
      { id: 'netsuite', name: 'NetSuite integration', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: false },
      { id: 'salesforce', name: 'Salesforce CRM integration', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned' },
      { id: 'macropoint', name: 'MacroPoint/FourKites integration', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned' },
      { id: 'dat-loadboard', name: 'DAT load board integration', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: true, expertly: 'planned' },
      { id: 'truckstop', name: 'Truckstop load board integration', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned' },
      { id: 'trucker-tools', name: 'Trucker Tools integration', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned' },
    ],
  },
  {
    id: 'billing-invoicing',
    name: 'Billing & Invoicing',
    icon: DollarSign,
    features: [
      { id: 'invoice-gen', name: 'Invoice generation', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'invoice-pdf', name: 'Invoice PDF export', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'email-invoices', name: 'Email invoices directly', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'batch-invoicing', name: 'Batch invoicing', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'planned' },
      { id: 'invoice-status', name: 'Invoice status tracking', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'payment-recording', name: 'Payment recording', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'aging-reports', name: 'Aging reports', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: 'partial' },
      { id: 'credit-hold', name: 'Credit hold management', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: true },
      { id: 'line-items', name: 'Invoice line item customization', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'accessorials', name: 'Accessorial billing (detention, layover)', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'auto-invoice-pod', name: 'Automatic invoice from POD', mcleod: true, trimble: true, mercurygate: true, descartes: 'partial', dat: false, expertly: 'planned' },
      { id: 'payment-terms', name: 'Customer payment terms', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
    ],
  },
  {
    id: 'carrier-payables',
    name: 'Carrier Payables',
    icon: ClipboardList,
    features: [
      { id: 'carrier-settlement', name: 'Carrier settlement/payment', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: 'partial' },
      { id: 'rate-matching', name: 'Rate confirmation matching', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'planned' },
      { id: 'carrier-invoice', name: 'Carrier invoice processing', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: 'partial' },
      { id: 'factoring', name: 'Factoring integration', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned' },
      { id: 'quick-pay', name: 'Quick pay options', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: false, expertly: 'planned' },
      { id: 'carrier-payment-status', name: 'Carrier payment status', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: 'partial' },
      { id: 'payables-aging', name: 'Payables aging reports', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'planned' },
    ],
  },
  {
    id: 'document-management',
    name: 'Document Management',
    icon: FolderOpen,
    features: [
      { id: 'doc-upload', name: 'Document upload/storage', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'bol-gen', name: 'BOL generation', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: 'planned' },
      { id: 'ratecon-storage', name: 'Rate confirmation storage', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'pod-storage', name: 'POD storage', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'doc-imaging', name: 'Document imaging/scanning', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'partial' },
      { id: 'doc-search', name: 'Document search', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: true },
      { id: 'auto-classification', name: 'Automatic document classification', mcleod: false, trimble: 'partial', mercurygate: true, descartes: false, dat: false, expertly: 'planned' },
      { id: 'email-doc-capture', name: 'Email document capture', mcleod: 'partial', trimble: 'partial', mercurygate: true, descartes: 'partial', dat: false, expertly: true },
    ],
  },
  {
    id: 'reporting-analytics',
    name: 'Reporting & Analytics',
    icon: PieChart,
    features: [
      { id: 'prebuilt-reports', name: 'Pre-built reports', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'custom-reports', name: 'Custom report builder', mcleod: true, trimble: true, mercurygate: true, descartes: 'partial', dat: 'partial', expertly: 'planned' },
      { id: 'dashboard-kpi', name: 'Dashboard with KPIs', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'revenue-reports', name: 'Revenue reports', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'margin-analysis', name: 'Margin analysis', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'lane-analysis', name: 'Lane analysis', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'carrier-performance', name: 'Carrier performance reports', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'customer-profitability', name: 'Customer profitability reports', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'partial' },
      { id: 'export-excel', name: 'Export to Excel/CSV', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'scheduled-reports', name: 'Scheduled report delivery', mcleod: true, trimble: true, mercurygate: true, descartes: 'partial', dat: false, expertly: 'planned' },
      { id: 'realtime-analytics', name: 'Real-time analytics', mcleod: 'partial', trimble: true, mercurygate: true, descartes: 'partial', dat: 'partial', expertly: true },
    ],
  },
  {
    id: 'compliance-safety',
    name: 'Compliance & Safety',
    icon: Scale,
    features: [
      { id: 'fmcsa-data', name: 'FMCSA data integration', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'dot-compliance', name: 'DOT compliance tracking', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'partial' },
      { id: 'hos-visibility', name: 'HOS (Hours of Service) visibility', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: false },
      { id: 'insurance-compliance', name: 'Insurance compliance', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'carrier-safety', name: 'Carrier safety scores', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'drug-test', name: 'Drug test tracking', mcleod: true, trimble: true, mercurygate: 'partial', descartes: 'partial', dat: false, expertly: false },
      { id: 'audit-trail', name: 'Audit trail/history logging', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'ifta', name: 'IFTA reporting', mcleod: true, trimble: true, mercurygate: 'partial', descartes: 'partial', dat: false, expertly: false },
    ],
  },
  {
    id: 'mobile-accessibility',
    name: 'Mobile & Accessibility',
    icon: Smartphone,
    features: [
      { id: 'mobile-driver', name: 'Mobile driver app', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned' },
      { id: 'mobile-broker', name: 'Mobile broker app', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: true, expertly: 'planned' },
      { id: 'responsive-web', name: 'Responsive web design', mcleod: 'partial', trimble: 'partial', mercurygate: true, descartes: 'partial', dat: true, expertly: true },
      { id: 'ios-app', name: 'iOS app', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: true, expertly: 'planned' },
      { id: 'android-app', name: 'Android app', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: true, expertly: 'planned' },
      { id: 'offline', name: 'Offline capability', mcleod: false, trimble: 'partial', mercurygate: 'partial', descartes: false, dat: false, expertly: false },
      { id: 'push-notifications', name: 'Push notifications', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: true, expertly: 'planned' },
    ],
  },
  {
    id: 'ai-automation',
    name: 'AI & Automation',
    icon: Sparkles,
    features: [
      { id: 'ai-email-parsing', name: 'AI email parsing', mcleod: false, trimble: false, mercurygate: 'partial', descartes: false, dat: false, expertly: true },
      { id: 'ai-carrier-suggestions', name: 'AI carrier suggestions', mcleod: false, trimble: false, mercurygate: 'partial', descartes: false, dat: 'partial', expertly: true },
      { id: 'ai-communications', name: 'AI-drafted communications', mcleod: false, trimble: false, mercurygate: false, descartes: false, dat: false, expertly: true },
      { id: 'predictive-analytics', name: 'Predictive analytics', mcleod: false, trimble: 'partial', mercurygate: 'partial', descartes: false, dat: 'partial', expertly: 'planned' },
      { id: 'ml-optimization', name: 'Machine learning optimization', mcleod: false, trimble: 'partial', mercurygate: 'partial', descartes: false, dat: false, expertly: 'planned' },
      { id: 'nlp', name: 'Natural language processing', mcleod: false, trimble: false, mercurygate: false, descartes: false, dat: false, expertly: true },
      { id: 'chatbot', name: 'Chatbot/virtual assistant', mcleod: false, trimble: false, mercurygate: false, descartes: false, dat: false, expertly: 'planned' },
      { id: 'auto-assign', name: 'Auto-assign loads', mcleod: 'partial', trimble: 'partial', mercurygate: true, descartes: 'partial', dat: false, expertly: 'planned' },
      { id: 'smart-exception', name: 'Smart exception detection', mcleod: 'partial', trimble: 'partial', mercurygate: true, descartes: 'partial', dat: false, expertly: true },
    ],
  },
  {
    id: 'platform-support',
    name: 'Platform & Support',
    icon: Server,
    features: [
      { id: 'cloud-saas', name: 'Cloud-based (SaaS)', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'on-premise', name: 'On-premise option', mcleod: true, trimble: true, mercurygate: false, descartes: true, dat: false, expertly: false },
      { id: 'multi-tenant', name: 'Multi-tenant', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'white-label', name: 'White-label option', mcleod: 'addon', trimble: 'addon', mercurygate: 'addon', descartes: 'addon', dat: false, expertly: 'planned' },
      { id: '24-7-support', name: '24/7 support', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned' },
      { id: 'phone-support', name: 'Phone support', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'email-support', name: 'Email support', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'chat-support', name: 'Chat support', mcleod: 'partial', trimble: 'partial', mercurygate: true, descartes: 'partial', dat: true, expertly: true },
      { id: 'implementation', name: 'Implementation support', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: 'partial', expertly: true },
      { id: 'training', name: 'Training included', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: 'partial', expertly: true },
      { id: 'knowledge-base', name: 'Knowledge base/documentation', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true },
      { id: 'community', name: 'User community/forum', mcleod: true, trimble: true, mercurygate: 'partial', descartes: 'partial', dat: true, expertly: 'planned' },
    ],
  },
]

// ========================================
// Competitor Info
// ========================================

const competitors = [
  {
    id: 'mcleod',
    name: 'McLeod LoadMaster',
    shortName: 'McLeod',
    founded: '1985',
    focus: 'Mid-to-large carriers & brokers',
    tagline: 'Industry standard for 35+ years',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'trimble',
    name: 'Trimble TMW Suite',
    shortName: 'Trimble TMW',
    founded: '1968',
    focus: 'Enterprise carriers & 3PLs',
    tagline: 'Strong telematics & compliance',
    color: 'bg-orange-100 text-orange-700',
  },
  {
    id: 'mercurygate',
    name: 'MercuryGate TMS',
    shortName: 'MercuryGate',
    founded: '2000',
    focus: 'SMBs to enterprises',
    tagline: 'Cloud-native, 100K+ carriers',
    color: 'bg-purple-100 text-purple-700',
  },
  {
    id: 'descartes',
    name: 'Descartes Aljex',
    shortName: 'Aljex',
    founded: '1995',
    focus: 'Freight brokers & 3PLs',
    tagline: 'User-friendly, NA focus',
    color: 'bg-green-100 text-green-700',
  },
  {
    id: 'dat',
    name: 'DAT Broker TMS',
    shortName: 'DAT',
    founded: '1978',
    focus: 'Freight brokers',
    tagline: 'Load board integration',
    color: 'bg-red-100 text-red-700',
  },
  {
    id: 'expertly',
    name: 'Expertly TMS',
    shortName: 'Expertly',
    founded: '2024',
    focus: '3PL brokers of all sizes',
    tagline: 'AI-first design',
    color: 'bg-emerald-100 text-emerald-700',
    highlight: true,
  },
]

// ========================================
// Pricing Data
// ========================================

const pricingData = [
  { platform: 'McLeod LoadMaster', model: 'Per-user license', starting: '$200-400/user/mo', implementation: '$25K-100K+', notes: 'Enterprise pricing, long contracts' },
  { platform: 'Trimble TMW Suite', model: 'Per-user license', starting: '$250-500/user/mo', implementation: '$50K-200K+', notes: 'Requires professional services' },
  { platform: 'MercuryGate TMS', model: 'Per-user/transaction', starting: '$150-300/user/mo', implementation: '$10K-50K', notes: 'Modular pricing' },
  { platform: 'Descartes Aljex', model: 'Per-user license', starting: '$100-200/user/mo', implementation: '$5K-20K', notes: 'More affordable entry point' },
  { platform: 'DAT Broker TMS', model: 'Per-user license', starting: '$99-199/user/mo', implementation: 'Included', notes: 'Bundled with DAT subscriptions' },
  { platform: 'Expertly TMS', model: 'Per-user, monthly', starting: '$79/user/mo', implementation: 'Free', notes: 'No contracts, cancel anytime', highlight: true },
]

// ========================================
// Main Component
// ========================================

export default function ProductComparison() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 500)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToCategory = (categoryId: string) => {
    const element = document.getElementById(categoryId)
    if (element) {
      const offset = 100
      const top = element.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Count features
  const totalFeatures = categories.reduce((sum, cat) => sum + cat.features.length, 0)

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/landing" className="flex items-center gap-2">
              <ExpertlyLogo className="w-8 h-8" />
              <span className="text-xl font-bold text-gray-900">Expertly TMS</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/landing" className="text-gray-600 hover:text-gray-900 font-medium">
                Home
              </Link>
              <Link
                to="/"
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-gray-50 to-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mb-6">
            <BarChart3 className="w-4 h-4" />
            Honest Feature Comparison
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
            TMS Comparison: How We Stack Up
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            A transparent, feature-by-feature comparison of Expertly TMS against the top 5 TMS platforms
            for freight brokers. {totalFeatures} features across {categories.length} categories.
          </p>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            The Platforms
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {competitors.map((comp) => (
              <div
                key={comp.id}
                className={`p-5 rounded-xl border-2 ${
                  comp.highlight
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${comp.color}`}>
                    Est. {comp.founded}
                  </span>
                  {comp.highlight && (
                    <span className="px-3 py-1 bg-emerald-600 text-white rounded-full text-xs font-bold">
                      US
                    </span>
                  )}
                </div>
                <h3 className={`font-bold text-lg ${comp.highlight ? 'text-emerald-700' : 'text-gray-900'}`}>
                  {comp.name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">{comp.focus}</p>
                <p className="text-sm text-gray-500 mt-2">{comp.tagline}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="py-8 bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <StatusIcon status={true} />
              <span className="text-sm text-gray-600">Full support</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon status="partial" />
              <span className="text-sm text-gray-600">Partial/limited</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon status="addon" />
              <span className="text-sm text-gray-600">Paid add-on</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon status={false} />
              <span className="text-sm text-gray-600">Not available</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon status="planned" />
              <span className="text-sm text-gray-600">Planned (Expertly)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Navigation */}
      <div className="sticky top-16 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto py-3 gap-2 scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  setActiveCategory(category.id)
                  scrollToCategory(category.id)
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeCategory === category.id
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <category.icon className="w-4 h-4" />
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison Tables */}
      <div className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {categories.map((category) => (
            <section key={category.id} id={category.id} className="mb-16 scroll-mt-32">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <category.icon className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{category.name}</h2>
                  <p className="text-sm text-gray-500">{category.features.length} features compared</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left py-4 px-4 font-semibold text-gray-900 w-64">Feature</th>
                      <th className="text-center py-4 px-3 font-semibold text-gray-700 w-24">McLeod</th>
                      <th className="text-center py-4 px-3 font-semibold text-gray-700 w-24">Trimble</th>
                      <th className="text-center py-4 px-3 font-semibold text-gray-700 w-24">MercuryGate</th>
                      <th className="text-center py-4 px-3 font-semibold text-gray-700 w-24">Aljex</th>
                      <th className="text-center py-4 px-3 font-semibold text-gray-700 w-24">DAT</th>
                      <th className="text-center py-4 px-3 font-bold text-emerald-700 bg-emerald-50 w-24">Expertly</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {category.features.map((feature, idx) => (
                      <tr key={feature.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{feature.name}</div>
                          {feature.description && (
                            <div className="text-xs text-gray-500 mt-0.5">{feature.description}</div>
                          )}
                        </td>
                        <td className="text-center py-3 px-3">
                          <div className="flex justify-center">
                            <StatusIcon status={feature.mcleod} />
                          </div>
                        </td>
                        <td className="text-center py-3 px-3">
                          <div className="flex justify-center">
                            <StatusIcon status={feature.trimble} />
                          </div>
                        </td>
                        <td className="text-center py-3 px-3">
                          <div className="flex justify-center">
                            <StatusIcon status={feature.mercurygate} />
                          </div>
                        </td>
                        <td className="text-center py-3 px-3">
                          <div className="flex justify-center">
                            <StatusIcon status={feature.descartes} />
                          </div>
                        </td>
                        <td className="text-center py-3 px-3">
                          <div className="flex justify-center">
                            <StatusIcon status={feature.dat} />
                          </div>
                        </td>
                        <td className="text-center py-3 px-3 bg-emerald-50/50">
                          <div className="flex justify-center">
                            <StatusIcon status={feature.expertly} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Pricing Comparison */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Pricing Comparison</h2>
            <p className="mt-2 text-gray-600">
              Estimated pricing based on publicly available information
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-4 px-4 font-semibold text-gray-900">Platform</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-900">Pricing Model</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-900">Starting Price</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-900">Implementation</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-900">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pricingData.map((row) => (
                  <tr key={row.platform} className={row.highlight ? 'bg-emerald-50' : ''}>
                    <td className={`py-4 px-4 font-medium ${row.highlight ? 'text-emerald-700' : 'text-gray-900'}`}>
                      {row.platform}
                    </td>
                    <td className="py-4 px-4 text-gray-600">{row.model}</td>
                    <td className={`py-4 px-4 font-semibold ${row.highlight ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {row.starting}
                    </td>
                    <td className={`py-4 px-4 ${row.highlight ? 'text-emerald-600 font-semibold' : 'text-gray-600'}`}>
                      {row.implementation}
                    </td>
                    <td className="py-4 px-4 text-gray-500 text-sm">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm text-gray-500 text-center">
            * Pricing is approximate and may vary based on features, user count, and negotiation. Contact vendors for exact quotes.
          </p>
        </div>
      </div>

      {/* Why Choose Expertly */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Why Choose Expertly TMS?</h2>
            <p className="mt-2 text-gray-600">
              What makes us different from legacy TMS platforms
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: 'AI-First Design',
                description: 'Built from the ground up with AI at the core. Not a legacy system with AI bolted on as an afterthought.',
              },
              {
                icon: Eye,
                title: 'Evidence-Based Extraction',
                description: 'Every AI-extracted field shows exactly where it came from in the source email. Full transparency, no black box.',
              },
              {
                icon: Zap,
                title: 'Modern Cloud-Native',
                description: 'No legacy code, no desktop clients to install, no VPNs. Just open a browser and start working.',
              },
              {
                icon: DollarSign,
                title: 'Simple Pricing',
                description: 'Transparent per-user pricing. No hidden modules, no surprise implementation fees, no multi-year contracts.',
              },
              {
                icon: Clock,
                title: 'Fast Setup',
                description: 'Go from signup to processing your first quote in minutes. No months-long implementation projects.',
              },
              {
                icon: Settings,
                title: 'Beautiful UX',
                description: 'A modern interface designed for speed and efficiency. No more clicking through 10 screens to complete one task.',
              },
            ].map((item, idx) => (
              <div key={idx} className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Honest Assessment */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <HelpCircle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">An Honest Assessment</h3>
                <div className="prose prose-gray max-w-none text-gray-600">
                  <p className="mb-4">
                    We believe in transparency. Here's who might be better served by a competitor:
                  </p>
                  <ul className="space-y-2">
                    <li><strong>Large enterprises with complex EDI needs:</strong> McLeod and Trimble have decades of EDI integrations. We're building ours.</li>
                    <li><strong>Asset-based carriers managing their own fleets:</strong> Trimble TMW's telematics and fleet management are best-in-class.</li>
                    <li><strong>Companies needing on-premise deployment:</strong> We're cloud-only. McLeod and Descartes offer on-premise options.</li>
                    <li><strong>Heavy DAT load board users:</strong> DAT's TMS has the tightest integration with DAT services, naturally.</li>
                  </ul>
                  <p className="mt-4">
                    Where we excel: brokers who want to move fast, eliminate data entry, and don't need every enterprise feature on day one.
                    Our AI capabilities are genuinely ahead of any competitor in this space.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 py-24">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
            Ready to try a modern TMS?
          </h2>
          <p className="mt-6 text-xl text-emerald-100 max-w-xl mx-auto">
            See for yourself why AI-first makes a difference.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-emerald-600 rounded-xl hover:bg-emerald-50 transition-all font-semibold text-lg shadow-xl"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="mailto:hello@expertly.ai"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all font-semibold text-lg border border-white/20"
            >
              <Mail className="w-5 h-5" />
              Contact Sales
            </a>
          </div>
          <p className="mt-6 text-sm text-emerald-200">
            No credit card required. Free for 14 days.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <ExpertlyLogo className="w-8 h-8" />
              <span className="text-lg font-bold text-white">Expertly TMS</span>
            </div>
            <div className="flex items-center gap-6">
              <Link to="/landing" className="text-gray-400 hover:text-white text-sm">
                Home
              </Link>
              <Link to="/" className="text-gray-400 hover:text-white text-sm">
                Dashboard
              </Link>
            </div>
            <p className="text-gray-400 text-sm">
              Part of the Expertly suite of products.
            </p>
          </div>
        </div>
      </footer>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 w-12 h-12 bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-emerald-700 transition-colors z-50"
        >
          <ChevronUp className="w-6 h-6" />
        </button>
      )}
    </div>
  )
}
