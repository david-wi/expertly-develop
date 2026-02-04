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
  competitorAdvantages?: string
  actionItems?: string
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
      { id: 'manual-quote', name: 'Manual quote creation', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod has 35+ years of quote workflow refinement with extensive keyboard shortcuts. Trimble offers deep ERP integration for instant cost lookups.', actionItems: '1) Add keyboard shortcuts (Ctrl+N new quote, Ctrl+S save, Tab between fields, Ctrl+Enter submit). 2) Track average quote creation time and set target <45 seconds. 3) Add smart autocomplete for customer name, origin/destination cities using recent history. 4) Create "quick quote" mode that shows only essential fields with defaults for the rest.' },
      { id: 'email-quote', name: 'Email-to-quote extraction', description: 'Parse incoming emails to auto-fill quote fields', mcleod: false, trimble: false, mercurygate: 'partial', descartes: false, dat: false, expertly: true, competitorAdvantages: 'MercuryGate has basic rules-based extraction. Our AI approach is more flexible but could improve reliability.', actionItems: '1) Add confidence scoring threshold - flag extractions below 85% confidence for human review. 2) Create feedback loop: when user corrects an extraction, log it and use for model improvement. 3) Build extraction accuracy dashboard tracking success rate by field type. 4) Add "extraction replay" showing exactly what the AI saw and extracted. 5) Test against 100 real customer emails and publish accuracy metrics.' },
      { id: 'ai-extraction', name: 'AI-powered field extraction with evidence', description: 'AI extracts fields and shows source text as proof', mcleod: false, trimble: false, mercurygate: false, descartes: false, dat: false, expertly: true, competitorAdvantages: 'This is our key differentiator - no competitor offers evidence-based AI extraction. Continue investing here.', actionItems: '1) PROTECT AND EXTEND this advantage. Add handling for: PDF attachments, forwarded email chains, reply threads, image-based rate sheets. 2) Build evidence highlighting that works on mobile. 3) Add "extraction confidence" scores per field (high/medium/low). 4) Create marketing case studies showing time saved vs. manual entry. 5) File provisional patent on evidence-based extraction methodology. 6) Add extraction support for common formats: VICS BOL, standard rate sheets, Excel attachments.' },
      { id: 'quote-templates', name: 'Quote templates', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod has sophisticated template inheritance and conditional fields. MercuryGate templates support dynamic pricing rules.', actionItems: '1) Add template inheritance (base template → customer-specific overrides). 2) Support conditional fields (if equipment=reefer, show temperature field). 3) Add dynamic pricing rules in templates (base rate + fuel surcharge formula). 4) Create template versioning so customers can roll back changes. 5) Build template marketplace where users can share commonly-used templates.' },
      { id: 'multi-stop-quote', name: 'Multi-stop quote support', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: true, competitorAdvantages: 'Trimble and McLeod support unlimited stops with individual pricing per leg. MercuryGate has visual drag-drop stop reordering.', actionItems: '1) Add visual route map showing all stops with driving route. 2) Enable pricing per leg (stop 1→2: $500, stop 2→3: $300). 3) Add drag-drop stop reordering with automatic mileage recalculation. 4) Show total transit time estimates including dwell time at each stop. 5) Support "round trip" quotes that return to origin.' },
      { id: 'quote-expiration', name: 'Quote expiration tracking', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod offers automatic re-quote suggestions when quotes expire. MercuryGate has batch expiration management.', actionItems: '1) Add automatic email notification 24 hours before quote expires asking customer if they want to rebook. 2) Create "expired quotes" dashboard showing potential revenue at risk. 3) Add one-click "re-quote" that creates new quote with updated rates. 4) Build batch expiration management - extend multiple quotes at once. 5) Add expiration analytics showing average quote-to-book time by customer.' },
      { id: 'quote-versioning', name: 'Quote versioning/revisions', mcleod: true, trimble: true, mercurygate: true, descartes: 'partial', dat: false, expertly: 'planned', competitorAdvantages: 'McLeod keeps complete audit trail of all quote changes with user attribution. Trimble allows side-by-side version comparison. HIGH PRIORITY for enterprise.', actionItems: 'PRIORITY: 1) Store complete quote state on every save as new version. 2) Show version history with who changed what, when. 3) Add side-by-side comparison: "v1 vs v3" showing all differences highlighted. 4) Allow revert to previous version with one click. 5) Add "reason for change" field when saving new version. 6) Build audit report for compliance: "all changes to quote #12345" exportable as PDF. TIMELINE: Implement in Q2.' },
      { id: 'customer-pricing', name: 'Customer-specific pricing rules', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'planned', competitorAdvantages: 'McLeod has extremely sophisticated pricing engines with lane-based, volume-based, and contract rate hierarchies. MercuryGate supports dynamic market-based pricing. KEY enterprise requirement.', actionItems: 'CRITICAL ENTERPRISE FEATURE: 1) Build pricing rules engine supporting: base rate per mile, minimum charges, fuel surcharge formulas, lane-specific rates (Chicago-Dallas = $2.10/mi), volume discounts (10+ loads/month = 5% off). 2) Support contract rate uploads from Excel/CSV. 3) Add rate effective dates (contract rates valid Jan 1 - Dec 31). 4) Show pricing rule that was applied on each quote ("Contract rate: CUSTOMER-2024"). 5) Build pricing audit trail. 6) Add margin minimums that warn if quote is below threshold. TIMELINE: Implement in Q2-Q3, this is a gate for enterprise sales.' },
      { id: 'margin-calc', name: 'Margin calculation & display', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod shows real-time margin calculations with historical comparison. Trimble integrates fuel cost projections.', actionItems: '1) Add historical margin comparison: "This lane avg margin: 18%, this quote: 15%" with visual indicator. 2) Show margin as both $ and %. 3) Add projected fuel cost calculator using DOE index. 4) Create margin alerts: highlight in red if below user-defined threshold. 5) Add "quick adjust" buttons: "+$50" "+$100" "+5%" for fast rate adjustments.' },
      { id: 'quote-pdf', name: 'Quote PDF generation', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'All competitors offer customizable PDF templates with company branding. McLeod has dozens of pre-built templates.', actionItems: '1) Add 5-10 professional PDF templates (modern, classic, detailed, summary). 2) Allow custom logo, colors, footer text per customer. 3) Add terms & conditions section with editable default text. 4) Support multi-language quotes (Spanish, French). 5) Add QR code linking to online quote acceptance page.' },
      { id: 'email-quote-direct', name: 'Email quote directly from system', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'MercuryGate tracks email opens and quote views. McLeod integrates with Outlook. Consider adding email tracking.', actionItems: '1) Add email open tracking using tracking pixel. 2) Show "Quote viewed" notification when customer opens email. 3) Add "Quote clicked" when they click links in email. 4) Build email analytics dashboard: open rates, response rates by customer. 5) Integrate with Gmail/Outlook for easier sending. 6) Add email templates with merge fields (customer name, quote details).' },
      { id: 'quote-approval', name: 'Quote approval workflows', mcleod: 'addon', trimble: true, mercurygate: true, descartes: false, dat: false, expertly: 'planned', competitorAdvantages: 'Trimble has multi-level approval hierarchies with automatic escalation. MercuryGate offers threshold-based approval rules. Essential for larger brokerages.', actionItems: 'ENTERPRISE FEATURE: 1) Build approval rules engine: quotes over $X require manager approval, quotes below Y% margin require director approval. 2) Add multi-level approval chains (rep → manager → director). 3) Create approval queue with pending items and aging. 4) Add automatic escalation after X hours without response. 5) Support mobile approval via email link or push notification. 6) Build approval audit trail for compliance. TIMELINE: Q3 - needed for enterprise customers.' },
      { id: 'quote-to-shipment', name: 'Quote-to-shipment conversion', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod maintains full traceability from quote to final invoice. MercuryGate supports partial quote conversion.', actionItems: '1) Add full traceability: shipment shows "Created from Quote #12345". 2) Support partial conversion: quote for 10 loads, book 3 now, 7 later. 3) Show quote-to-shipment conversion rate analytics by customer, rep. 4) Add automatic quote status update when shipment is created. 5) Allow converting quote to recurring shipment template.' },
    ],
  },
  {
    id: 'order-load-management',
    name: 'Order/Load Management',
    icon: Package,
    features: [
      { id: 'load-entry', name: 'Load entry from scratch', description: 'Manually create a new shipment order with all details', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod has extensive keyboard shortcuts - experienced users can enter a load in under 30 seconds. Trimble has smart field auto-completion based on customer history. MercuryGate offers voice-to-text entry.', actionItems: '1) Add comprehensive keyboard shortcuts: Ctrl+N (new), Ctrl+D (duplicate), Tab (next field), Enter (save). 2) Implement smart autocomplete using last 50 shipments for each customer (same origins, destinations, commodities). 3) Add "duplicate load" feature to copy existing shipment. 4) Create load entry timer to benchmark and improve - target <30 seconds for experienced users. 5) Consider voice entry integration using browser speech API.' },
      { id: 'edi-204-accept', name: 'EDI 204 load tender acceptance', description: 'Automatically receive and accept shipment orders from shippers via electronic data interchange - the industry standard for large retailers like Walmart, Target, Amazon', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: false, expertly: 'planned', competitorAdvantages: 'McLeod has 2,000+ pre-built EDI trading partner maps. Trimble processes millions of EDI transactions daily with 99.9% uptime. MercuryGate offers self-service EDI setup. CRITICAL - without this, you cannot work with major shippers. Top priority.', actionItems: 'TOP PRIORITY - ENTERPRISE GATE: 1) Partner with EDI provider (SPS Commerce, TrueCommerce, or Cleo) rather than building from scratch - they have pre-built maps. 2) Support core transactions: 204 (tender), 990 (response), 214 (status), 210 (invoice). 3) Build EDI message viewer showing raw and parsed data for debugging. 4) Create self-service trading partner setup with test mode. 5) Add EDI transaction dashboard showing volume, errors, response times. 6) Aim for 99.9% uptime SLA on EDI processing. TIMELINE: Start Q2, must have basic 204/990 by Q3 end.' },
      { id: 'recurring-templates', name: 'Recurring load templates', description: 'Save frequently-run shipments as templates - e.g., "Chicago to Dallas every Monday" - to create new loads with one click', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'planned', competitorAdvantages: 'McLeod supports complex recurrence patterns (e.g., every 2nd Tuesday, excluding holidays). MercuryGate templates include carrier preferences and auto-tendering rules. High-value for brokers with contract freight.', actionItems: '1) Build template system supporting: daily, weekly, bi-weekly, monthly recurrence. 2) Add schedule builder: specific days (M/W/F), Nth day of month, exclude holidays. 3) Include carrier preferences in template: "always try Carrier X first". 4) Add auto-tendering option: "automatically tender when load is created". 5) Show "upcoming scheduled loads" dashboard. 6) Support template pause/resume for seasonal freight. 7) Add bulk template management - update rates across multiple templates.' },
      { id: 'multi-stop-loads', name: 'Multi-stop/multi-pickup loads', description: 'Handle shipments with multiple pickup or delivery locations - common in retail distribution and consolidation', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'Trimble supports unlimited stops with separate accessorial billing per stop. McLeod has visual route mapping showing stop sequence. MercuryGate offers drag-drop stop reordering with automatic mileage recalculation.', actionItems: '1) Add visual route map showing all stops using Google/Mapbox. 2) Support per-stop accessorial charges (e.g., $75 unloading fee at stop 2). 3) Implement drag-drop stop reordering with automatic mileage recalc. 4) Show estimated arrival time at each stop based on drive time + dwell. 5) Add stop type indicators: pickup (P) vs delivery (D). 6) Support appointment windows per stop.' },
      { id: 'ltl-consolidation', name: 'LTL consolidation', description: 'Combine multiple smaller shipments (Less Than Truckload) going the same direction into one truck to reduce costs', mcleod: true, trimble: true, mercurygate: true, descartes: 'partial', dat: false, expertly: 'planned', competitorAdvantages: 'McLeod has sophisticated consolidation algorithms that maximize cube utilization. MercuryGate shows real-time consolidation opportunities across your entire freight. Trimble integrates with LTL carrier APIs for instant rating. Growing market segment.', actionItems: '1) Build consolidation suggestion engine: "These 3 shipments could share a truck, saving $X". 2) Show compatibility factors: same direction, timing overlap, equipment match. 3) Calculate cube/weight utilization percentage. 4) Add "consolidation planner" view showing potential combinations. 5) Integrate LTL rating APIs (SMC³, Carrier Logistics) for instant pricing. 6) Support partial fills: show available space on existing loads. TIMELINE: Q3-Q4, growing market segment.' },
      { id: 'split-shipments', name: 'Split shipments', description: 'Divide one large order across multiple trucks when it exceeds capacity or needs partial early delivery', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: false, expertly: 'planned', competitorAdvantages: 'MercuryGate maintains parent-child relationships between split loads with unified tracking. McLeod handles complex billing splits (50/50, by weight, by piece count). Trimble offers visual split planning tools.', actionItems: '1) Add "split shipment" action that creates child loads linked to parent. 2) Maintain parent-child relationship visible in both directions. 3) Show unified tracking: "Order #123: Part 1 delivered, Part 2 in transit". 4) Support split billing methods: even split, by weight, by piece count, manual allocation. 5) Add visual split planner showing original load breakdown. 6) Auto-notify customer when all parts of split order are delivered.' },
      { id: 'cross-docking', name: 'Cross-docking support', description: 'Move freight directly from inbound to outbound trucks at a warehouse without long-term storage - used in retail distribution', mcleod: true, trimble: true, mercurygate: true, descartes: 'partial', dat: false, expertly: false, competitorAdvantages: 'Trimble has deep warehouse management integration for cross-dock scheduling. McLeod optimizes dock door assignments. MercuryGate tracks product at the SKU level through the cross-dock. Specialized feature for larger operations.', actionItems: 'DEPRIORITIZE - specialized feature for larger operations. Most pure brokers don\'t need this. If customer demand emerges: 1) Add cross-dock location type with inbound/outbound scheduling. 2) Track dwell time at cross-dock facility. 3) Support dock door assignment (optional). Focus resources on higher-impact features first.' },
      { id: 'order-status', name: 'Order status tracking', description: 'See where each shipment is in its lifecycle - booked, dispatched, in transit, delivered', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'MercuryGate has 15+ granular status stages. Trimble shows predictive delivery times based on real-time traffic. McLeod offers customizable status workflows per customer. We should add more status granularity.', actionItems: '1) Add more granular statuses: Quoted → Booked → Carrier Assigned → Dispatched → En Route to Pickup → At Pickup → Loaded → In Transit → At Delivery → Unloading → Delivered → Invoiced → Closed. 2) Show predictive ETA using distance + traffic data. 3) Allow customer-specific status workflows (some customers want more/fewer updates). 4) Add status change timestamps visible in shipment history. 5) Create status-based alerts: "Shipment at pickup for >2 hours".' },
      { id: 'customer-portal-orders', name: 'Customer portal for orders', description: 'Self-service website where your customers can submit loads, track shipments, and view invoices without calling you', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'MercuryGate portal is highly customizable with your branding. Trimble offers mobile-friendly customer portal. McLeod portal integrates with customer ERP systems. HUGE efficiency gain - reduces phone calls 30-50%. High priority.', actionItems: 'HIGH PRIORITY - EFFICIENCY MULTIPLIER: 1) Build customer portal MVP with: order submission form, shipment tracking with map, invoice view and payment. 2) White-label with customer\'s broker\'s branding (logo, colors, domain). 3) Add self-service rate requests. 4) Show document repository (BOLs, PODs, invoices). 5) Build notification preferences (email when shipped, delivered, invoiced). 6) Make mobile-responsive from day one. 7) Track portal adoption metrics to show ROI. TIMELINE: Start Q2, MVP by Q3. This dramatically reduces "where is my freight?" calls.' },
      { id: 'bulk-import', name: 'Bulk load import (CSV/Excel)', description: 'Upload a spreadsheet of multiple loads at once instead of entering each one manually', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'planned', competitorAdvantages: 'MercuryGate has smart column mapping that learns your spreadsheet format. McLeod validates addresses and customer codes during import. Trimble offers scheduled automatic imports from SFTP folders. Essential for high-volume customers.', actionItems: '1) Build CSV/Excel import with drag-drop column mapping. 2) Save column mappings per customer ("Customer X uses column A for origin city"). 3) Add validation before import: address verification, customer code check, required fields. 4) Show import preview with error highlighting. 5) Support partial imports (import valid rows, skip errors). 6) Add scheduled import from SFTP/email for automation. 7) Create import history with rollback capability. TIMELINE: Q2, essential for high-volume customers.' },
    ],
  },
  {
    id: 'dispatch-planning',
    name: 'Dispatch & Load Planning',
    icon: MapPin,
    features: [
      { id: 'dispatch-board', name: 'Dispatch board/calendar view', description: 'Visual overview of all loads by date, showing what needs to be picked up and delivered', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod dispatch board is highly customizable with 20+ column options. Trimble offers timeline/Gantt view showing load duration. MercuryGate has map-based dispatch view showing geographic distribution. Consider adding map view.', actionItems: '1) Add map-based dispatch view using Mapbox/Google Maps showing load origins/destinations geographically. 2) Create Gantt/timeline view showing load duration and overlaps. 3) Allow column customization (show/hide, reorder, resize). 4) Add keyboard navigation for power users. 5) Create saved views: "Today\'s pickups", "At-risk loads", "Unassigned". 6) Add color coding by status, customer, or equipment type.' },
      { id: 'drag-drop', name: 'Drag-and-drop dispatching', description: 'Assign loads to carriers by simply dragging them - much faster than filling out forms', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: true, competitorAdvantages: 'MercuryGate shows carrier fit score when hovering during drag. McLeod validates lane history and insurance during drop. Trimble shows equipment match warnings. Our drag-drop is good but could show more context.', actionItems: '1) Show "carrier fit score" tooltip on hover during drag: lane history, on-time %, insurance status. 2) Validate and warn on drop: expired insurance, wrong equipment type, out-of-area. 3) Show last 3 loads this carrier did on this lane with rates. 4) Add "quick assign" dropdown as alternative to drag-drop. 5) Show carrier available capacity indicator.' },
      { id: 'driver-assignment', name: 'Driver assignment', description: 'Assign specific drivers to loads - primarily used by asset-based carriers who own their trucks', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'Trimble has deep HOS (Hours of Service) integration showing available drive time. McLeod tracks driver certifications (Hazmat, TWIC). Less critical for pure brokers who use carriers, not drivers.', actionItems: 'LOWER PRIORITY for pure brokerage model. If asset-carrier customers emerge: 1) Add driver database with contact info, certifications. 2) Basic HOS tracking if we add ELD integration. 3) Track driver certifications (Hazmat, TWIC, TSA). Focus on carrier-level features first.' },
      { id: 'equipment-assignment', name: 'Equipment assignment', description: 'Assign specific trailers, tractors, or equipment types (reefer, flatbed, van) to loads', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'partial', competitorAdvantages: 'Trimble has full asset management with maintenance scheduling. McLeod tracks equipment certifications and inspection dates. More relevant for asset-based operations than pure brokerage.', actionItems: 'LOWER PRIORITY for pure brokerage. Current equipment type selection is adequate. If asset-carriers request: add equipment database with trailer numbers, types, dimensions. Focus on broker features first.' },
      { id: 'route-optimization', name: 'Route optimization', description: 'Automatically calculate the best route considering distance, traffic, fuel stops, and HOS rules', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'partial', dat: false, expertly: 'planned', competitorAdvantages: 'Trimble ALK/PC*MILER integration is industry gold standard used by most carriers. McLeod offers route comparison tools. MercuryGate includes practical routing (low bridges, truck routes). Consider PC*MILER integration.', actionItems: '1) Integrate with PC*MILER API for industry-standard routing - this is the credibility play. 2) Alternatively, use Google Maps Truck Routing API (cheaper). 3) Show practical route (truck-legal) vs shortest route comparison. 4) Display route on map with turn-by-turn. 5) Calculate fuel stops and estimated fuel cost. TIMELINE: Q3-Q4, nice-to-have but adds professionalism.' },
      { id: 'mileage-calc', name: 'Mileage calculation', description: 'Calculate distances between locations for pricing and carrier payment', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'Trimble owns PC*MILER, the industry-standard mileage tool. McLeod supports multiple mileage sources (practical, shortest, toll-avoided). We use basic calculation - should add PC*MILER option for credibility.', actionItems: '1) Add PC*MILER integration as "premium mileage" option - carriers and shippers trust this source. 2) Support multiple mileage methods: practical (truck legal), shortest, HHG (household goods). 3) Show mileage breakdown: line haul miles, out of route miles. 4) Display on quotes/invoices: "Mileage: 847 miles (PC*MILER practical)". 5) Consider offering PC*MILER as a billable add-on to cover API costs.' },
      { id: 'fuel-surcharge', name: 'Fuel surcharge auto-calculation', description: 'Automatically calculate fuel surcharges based on DOE fuel price index - changes weekly and varies by region', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'planned', competitorAdvantages: 'McLeod supports complex fuel tables (by customer, lane, equipment type). Trimble pulls DOE prices automatically each Monday. MercuryGate supports regional fuel price variations. Standard billing requirement.', actionItems: '1) Build fuel surcharge calculator using DOE National Average Diesel Price (updates weekly). 2) Support multiple fuel table formats: per-mile surcharge, percentage of linehaul. 3) Allow customer-specific fuel tables (some use specific indices). 4) Auto-update prices weekly from DOE website. 5) Show fuel surcharge as separate line item on quotes/invoices. 6) Support regional pricing (West Coast vs East Coast). TIMELINE: Q2, standard billing requirement.' },
      { id: 'appointment-scheduling', name: 'Appointment scheduling', description: 'Track pickup and delivery appointment times at warehouses - critical for avoiding detention charges', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: true, competitorAdvantages: 'MercuryGate integrates with dock scheduling systems like Opendock. McLeod sends automatic appointment reminders. Trimble tracks appointment compliance rates. Consider dock scheduling integrations.', actionItems: '1) Add automatic appointment reminder emails/texts to carriers (24h, 2h before). 2) Track appointment compliance: on-time, early, late arrivals. 3) Integrate with dock scheduling systems (Opendock, Retalon) - API integration. 4) Alert when appointment is missed or at risk. 5) Show appointment status on dispatch board. 6) Calculate and track detention automatically when appointments are missed.' },
      { id: 'driver-availability', name: 'Driver availability tracking', description: 'Know which drivers are available, on a load, or off-duty - important for asset-based carriers', mcleod: true, trimble: true, mercurygate: true, descartes: 'partial', dat: false, expertly: 'partial', competitorAdvantages: 'Trimble has real-time HOS integration showing exactly when drivers become available. McLeod tracks PTO and home time requests. More relevant for carriers than brokers.', actionItems: 'LOWER PRIORITY for pure brokerage. If we get ELD integration, we\'ll have some visibility into driver availability. Focus on carrier-level capacity tracking instead of driver-level.' },
      { id: 'realtime-location', name: 'Real-time driver location', description: 'See where trucks are on a map right now using GPS or ELD tracking', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'Trimble has the most carrier ELD integrations (KeepTruckin, Samsara, etc.). MercuryGate offers 100+ telematics integrations. McLeod partners with MacroPoint. HIGH VALUE - customers increasingly expect real-time visibility.', actionItems: 'HIGH PRIORITY: 1) Partner with tracking aggregator (MacroPoint, FourKites, project44) - they have carrier relationships built. 2) Alternatively, integrate Trucker Tools which is free for carriers. 3) Show live map with all in-transit loads. 4) Display ETA based on current location + traffic. 5) Send automatic customer notifications on location milestones. 6) Track "dark time" when we lose tracking signal. TIMELINE: Start Q2, this is increasingly table stakes for brokers.' },
    ],
  },
  {
    id: 'carrier-management',
    name: 'Carrier Management',
    icon: Truck,
    features: [
      { id: 'carrier-db', name: 'Carrier database', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod has 35+ years of carrier data. DAT has the largest database from load board usage. Consider FMCSA pre-population.', actionItems: '1) Add FMCSA carrier lookup: enter MC# and auto-populate company name, address, authority status, safety data. 2) Create carrier search with filters: equipment type, lanes served, insurance minimums. 3) Show carrier "quick stats" on profile: total loads, on-time %, avg rate. 4) Add carrier notes/comments section for internal knowledge sharing. 5) Support carrier groupings: "Preferred", "Backup", "New".' },
      { id: 'mc-dot-tracking', name: 'MC/DOT number tracking', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'All competitors auto-pull FMCSA data. Trimble has real-time authority monitoring. We do this well.', actionItems: 'We do this adequately. Enhancements: 1) Add real-time authority monitoring with instant alerts on revocation/suspension. 2) Show authority history (when granted, any lapses). 3) Display authority type clearly: Contract, Broker, Common. 4) Alert when carrier is operating close to authority limits.' },
      { id: 'insurance-cert', name: 'Insurance certificate tracking', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod integrates with Rmis, MyCarrierPackets for automated cert collection. Trimble offers OCR certificate parsing.', actionItems: '1) Integrate with insurance verification services (Rmis, Highway, MyCarrierPackets) - they pull certs automatically. 2) Add OCR/AI to extract coverage amounts, dates, policy numbers from uploaded certificates. 3) Support multiple insurance types: auto liability, cargo, general liability, workers comp. 4) Track additional insured status (is broker listed?). 5) Archive old certificates for audit trail. TIMELINE: Q3, reduces manual data entry significantly.' },
      { id: 'insurance-alerts', name: 'Insurance expiration alerts', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'Trimble has configurable alert windows (30/60/90 days). McLeod auto-suspends carriers on expiration.', actionItems: '1) Add configurable alert windows: 30, 14, 7, 1 day before expiration. 2) Auto-suspend carrier from tendering when insurance expires (no manual intervention). 3) Send automatic email to carrier requesting updated certificate. 4) Show insurance status prominently on carrier profile. 5) Create "expiring insurance" report for proactive management.' },
      { id: 'carrier-scoring', name: 'Carrier scoring/rating', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'DAT has CarrierWatch with predictive failure scoring. MercuryGate uses ML for performance prediction. Add predictive analytics.', actionItems: '1) Build composite carrier score combining: on-time %, claim rate, response time, rate competitiveness. 2) Add predictive risk scoring using ML: identify carriers likely to fail/cancel. 3) Show industry benchmarks: "This carrier is in top 20% for on-time delivery". 4) Consider DAT CarrierWatch API integration for third-party risk scores. 5) Display score prominently during carrier selection.' },
      { id: 'lane-history', name: 'Lane history by carrier', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod shows profitability by lane/carrier combination. Trimble offers lane-based carrier recommendations.', actionItems: '1) Show profitability by lane/carrier: "Carrier X on Chicago-Dallas: $2,450 avg, 22% margin, 95% on-time". 2) Add lane-based carrier recommendations: "Top carriers for this lane based on history". 3) Display trend data: is this carrier\'s performance improving or declining? 4) Show rate history on this lane over time. 5) Highlight carriers who haven\'t done this lane but operate nearby.' },
      { id: 'ontime-tracking', name: 'On-time percentage tracking', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'DAT has industry benchmark comparisons. MercuryGate tracks by pickup AND delivery separately.', actionItems: '1) Track pickup and delivery on-time separately (carrier may be great at pickup but miss deliveries). 2) Add grace period configuration: 15 min, 30 min, 1 hour. 3) Show on-time trend over time: last 30, 90, 365 days. 4) Display industry benchmark comparison if we can get data. 5) Factor on-time into carrier scoring and recommendations.' },
      { id: 'carrier-onboarding', name: 'Carrier onboarding workflow', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'partial', competitorAdvantages: 'MercuryGate has carrier self-service portal with document upload. McLeod integrates with Highway, Rmis. HIGH PRIORITY - reduces manual work significantly.', actionItems: 'HIGH PRIORITY: 1) Build carrier self-service onboarding portal: carrier enters MC#, we pull FMCSA data, they upload insurance/W9. 2) Create checklist workflow: W9 ✓, Insurance ✓, Contract Signed ✓, Approved ✓. 3) Support electronic contract signing (DocuSign, or built-in). 4) Integrate with Highway or Rmis for instant verification. 5) Send onboarding link to carriers: "Complete your setup to haul for us". 6) Track onboarding completion rate and time. TIMELINE: Q2, this saves hours of manual carrier setup.' },
      { id: 'compliance-dashboard', name: 'Carrier compliance dashboard', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: true, competitorAdvantages: 'Trimble has industry-leading compliance dashboards with real-time authority/insurance status.', actionItems: '1) Create compliance overview: X carriers compliant, Y expiring soon, Z non-compliant. 2) Show drill-down by compliance issue type: insurance, authority, safety rating. 3) Add batch actions: email all carriers with expiring insurance. 4) Display compliance trend: are we getting better or worse? 5) Export compliance report for customer audits.' },
      { id: 'preferred-carriers', name: 'Preferred carrier lists', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'MercuryGate supports lane-specific preferred carriers. McLeod has customer-carrier preference mapping.', actionItems: '1) Add lane-specific preferred carriers: "For Chicago-Dallas, always try Carrier X first". 2) Support customer-specific carrier restrictions: "Customer Y only allows carriers on their approved list". 3) Create carrier tiers: Primary, Secondary, Backup with auto-waterfall logic. 4) Show preferred carrier status during dispatch. 5) Track preferred carrier coverage rate: how often do we use preferred vs spot?' },
      { id: 'carrier-blacklist', name: 'Carrier blacklisting', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod blocks blacklisted carriers at tender creation. Trimble shares blacklists across divisions.', actionItems: '1) Hard-block blacklisted carriers - prevent tender creation with warning. 2) Require blacklist reason (claims, service failure, fraud). 3) Support blacklist expiration/review dates. 4) Allow customer-specific blacklists (Customer X won\'t use Carrier Y). 5) Show blacklist warnings prominently if carrier appears in search results. 6) Create blacklist audit trail: who blacklisted, when, why.' },
      { id: 'capacity-tracking', name: 'Carrier capacity tracking', mcleod: 'partial', trimble: true, mercurygate: true, descartes: 'partial', dat: true, expertly: 'planned', competitorAdvantages: 'MercuryGate integrates with carrier capacity APIs in real-time. DAT shows available trucks from load board data. HIGH VALUE for spot market.', actionItems: 'HIGH VALUE: 1) Integrate with DAT API to see carrier truck availability from load board data. 2) Build carrier capacity posting feature: carriers tell us where their trucks will be empty. 3) Show "trucks available near origin" when dispatching. 4) Track historical capacity patterns by carrier, lane, day of week. 5) Add capacity notifications: "Carrier X has a truck empty in Chicago tomorrow". TIMELINE: Q3-Q4, very valuable for spot market coverage.' },
    ],
  },
  {
    id: 'tendering-procurement',
    name: 'Tendering & Procurement',
    icon: Send,
    features: [
      { id: 'manual-tender', name: 'Manual tender creation', description: 'Create an offer to a carrier specifying the load details and your offered rate', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod has quick-tender with one-click sending to frequently used carriers. Trimble shows historical accept rates by carrier during tender creation. MercuryGate displays carrier profit margin estimates. We should show more carrier context during tendering.', actionItems: '1) Add "quick tender" to recent/frequent carriers with one click. 2) Show carrier context during tender: historical accept rate, avg response time, last rate on this lane. 3) Display carrier estimated profit margin: "At $2,400, carrier profit ~$350". 4) Add tender templates for common scenarios. 5) Show tender success predictor: "High/Medium/Low chance of acceptance at this rate".' },
      { id: 'auto-waterfall', name: 'Automated tender waterfall', description: 'Automatically offer loads to carriers in priority order - if carrier #1 declines, it goes to carrier #2, and so on', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'planned', competitorAdvantages: 'MercuryGate waterfall considers carrier cost, performance score, and capacity in real-time. McLeod supports time-based escalation (e.g., increase rate $50 after 2 hours). Trimble integrates backup carriers from load boards. HIGH VALUE - saves hours of manual tendering.', actionItems: 'HIGH VALUE FEATURE: 1) Build waterfall engine: define carrier sequence, rate for each tier, timeout before escalation. 2) Support time-based rate escalation: if no accept in 2 hours, increase rate $50 and retry. 3) Allow waterfall to post to load board as final fallback. 4) Show waterfall progress in real-time: "Offered to Carrier A (pending), B (declined), C (next)". 5) Track waterfall success rates and optimize sequence based on data. 6) Support customer-specific waterfall rules. TIMELINE: Q2-Q3, this is a major efficiency gain.' },
      { id: 'spot-market', name: 'Spot market integration (DAT, Truckstop)', description: 'Post loads to public load boards where thousands of carriers search for freight, and find available trucks', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: true, expertly: 'planned', competitorAdvantages: 'DAT has native integration with the largest load board (1M+ daily postings). MercuryGate posts to multiple boards simultaneously. Truckstop integration common in Aljex. ESSENTIAL for spot market brokers - top priority.', actionItems: 'TOP PRIORITY: 1) Integrate DAT PowerDAT API for load posting and carrier search. 2) Add Truckstop ITS API as second board option. 3) One-click "post to boards" from dispatch view. 4) Auto-remove posting when load is covered. 5) Show carrier responses/calls from board directly in TMS. 6) Display market rate data for the lane from board. 7) Track which boards produce best carrier matches. TIMELINE: Q2, essential for spot market brokers.' },
      { id: 'rate-confirmation', name: 'Rate confirmation generation', description: 'Generate the legal document that confirms the agreed rate and load details between broker and carrier', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod has dozens of rate confirmation templates with legal language vetted by industry lawyers. Trimble supports electronic signature capture. MercuryGate tracks rate con versions. Our rate cons are good; consider adding e-signature.', actionItems: '1) Add electronic signature capture (DocuSign integration or built-in). 2) Create multiple rate con templates (standard, detailed, customer-specific). 3) Have legal review our rate con language for completeness. 4) Track rate con versions: original, amendments. 5) Add "signed rate con" status visible in load view. 6) Send automatic reminder if rate con unsigned after X hours.' },
      { id: 'rate-negotiation', name: 'Carrier rate negotiation tracking', description: 'Track back-and-forth rate discussions - carrier asks for $2,000, you counter $1,800, they accept $1,900', mcleod: 'partial', trimble: 'partial', mercurygate: true, descartes: 'partial', dat: 'partial', expertly: 'planned', competitorAdvantages: 'MercuryGate has full negotiation thread history visible to dispatchers. McLeod logs all rate changes with timestamps. Useful for training and dispute resolution. Consider adding negotiation tracking.', actionItems: '1) Add negotiation thread: log all offers/counter-offers with timestamps. 2) Show thread history to dispatchers taking over loads. 3) Track negotiation patterns: "This carrier typically counters +$100". 4) Use for training: show examples of successful negotiations. 5) Calculate negotiation success rate by dispatcher. 6) Support negotiation via carrier portal (not just phone/email).' },
      { id: 'tender-tracking', name: 'Tender acceptance/rejection tracking', description: 'See which carriers accepted, declined, or haven\'t responded to your load offers', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'MercuryGate shows carrier response patterns (e.g., "this carrier typically responds in 15 min"). Trimble tracks decline reasons for analytics. McLeod offers tender status dashboards. We do this adequately.', actionItems: '1) Add carrier response pattern analytics: "Carrier X typically responds in 12 min". 2) Track and require decline reasons for analytics. 3) Create tender status dashboard: pending, accepted, declined, expired. 4) Show response rate by carrier. 5) Alert when tender is aging without response. 6) Analyze common decline reasons to improve tender success.' },
      { id: 'counter-offer', name: 'Counter-offer workflows', description: 'Let carriers propose a different rate instead of just accepting or rejecting - "I\'ll do it for $100 more"', mcleod: 'partial', trimble: 'partial', mercurygate: true, descartes: false, dat: 'partial', expertly: 'planned', competitorAdvantages: 'MercuryGate has full counter-offer workflows with automatic approval thresholds. McLeod supports counter-offers but requires manual processing. Improves carrier relationships and load coverage.', actionItems: '1) Allow carriers to submit counter-offers with proposed rate. 2) Auto-approve counter-offers within threshold (e.g., +$50 ok, +$200 needs manager). 3) Notify dispatcher immediately of counter-offer. 4) Track counter-offer acceptance rate. 5) Show counter-offer history on carrier profile. 6) Support counter-offer via carrier portal and API.' },
      { id: 'carrier-portal-tender', name: 'Carrier portal for tenders', description: 'Website where carriers can log in to see available loads, accept tenders, and submit paperwork - reduces phone/email', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'MercuryGate carrier portal has 100K+ registered carriers. Trimble portal shows carriers their performance scores. McLeod portal supports document upload and quick pay requests. HUGE efficiency gain - reduces phone calls dramatically.', actionItems: 'HIGH PRIORITY: 1) Build carrier portal MVP with: view available tenders, accept/decline, submit counter-offers. 2) Add document upload: rate con signing, POD submission, carrier packet. 3) Show carrier their performance score and history with us. 4) Support quick pay requests from portal. 5) Send email notifications for new tenders. 6) Track portal adoption: % of carriers using portal vs phone. 7) Mobile-friendly design required. TIMELINE: Q3, this dramatically reduces phone calls and emails.' },
    ],
  },
  {
    id: 'tracking-visibility',
    name: 'Tracking & Visibility',
    icon: Eye,
    features: [
      { id: 'gps-tracking', name: 'Real-time GPS tracking', description: 'See exactly where trucks are on a map using GPS data from driver phones or truck ELDs', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'Trimble has native tracking from their hardware in millions of trucks. MercuryGate aggregates 100+ tracking sources (MacroPoint, FourKites, project44). McLeod partners with MacroPoint. CRITICAL differentiator - customers expect real-time visibility. Top priority.', actionItems: 'TOP PRIORITY: 1) Partner with tracking aggregator: MacroPoint (DAT-owned, 1M+ trucks), project44, or FourKites. They have carrier relationships already built. 2) Alternatively, integrate Trucker Tools - free for carriers, good coverage. 3) Build real-time map view showing all in-transit loads. 4) Display ETA based on current location + traffic (Google/Mapbox). 5) Store tracking history for post-delivery analysis. 6) Track "dark time" when tracking signal lost. TIMELINE: Start Q2, increasingly table stakes.' },
      { id: 'check-calls', name: 'Check call scheduling', description: 'Schedule reminders to call carriers for status updates - e.g., "Call driver 2 hours before pickup"', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod auto-generates check call tasks based on shipment timeline. MercuryGate reduces check calls needed via automated tracking. Trimble triggers check calls when tracking goes stale. Our check calls work; automation would reduce manual work.', actionItems: '1) Auto-generate check call tasks based on shipment timeline: 2h before pickup, 1h after expected pickup (if no update). 2) Reduce check calls when we have automated tracking (show "live tracking active - no call needed"). 3) Trigger check call when tracking goes stale (no update in 2 hours). 4) Log check call results with templates: "loaded", "in transit", "delayed by X hours". 5) Track check call compliance by dispatcher.' },
      { id: 'auto-tracking', name: 'Automated tracking updates', description: 'Get truck locations automatically without phone calls - via ELD integration or driver app', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'MercuryGate gets automatic updates from 100K+ carriers. Trimble offers Trucker Tools integration for carriers without ELDs. McLeod partners with major visibility providers. Dramatically reduces dispatcher workload - very high value.', actionItems: 'HIGH VALUE: 1) Build tracking request workflow: send carrier/driver link to share location. 2) Integrate Trucker Tools or similar driver app for carriers without ELDs. 3) Accept tracking from multiple sources per load (ELD primary, driver app backup). 4) Show tracking source and freshness: "Last update: 5 min ago via KeepTruckin". 5) Calculate check call reduction from automation - show ROI. TIMELINE: Part of tracking initiative Q2-Q3.' },
      { id: 'eld-integration', name: 'ELD/telematics integration', description: 'Connect to Electronic Logging Devices in trucks (required by law since 2019) to get automatic location and Hours of Service data', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'Trimble integrates with all major ELD providers (KeepTruckin, Samsara, Omnitracs, etc.). MercuryGate has pre-built connectors for 50+ ELD systems. Industry moving toward universal connectivity.', actionItems: '1) Use tracking aggregator rather than direct ELD integrations (50+ providers is too many). 2) MacroPoint/project44/FourKites already have ELD relationships built. 3) If direct integration needed, prioritize: KeepTruckin (Motive), Samsara - largest market share. 4) Accept ELD data via API for large carriers who push data. 5) Show HOS data if available: remaining drive time.' },
      { id: 'geofence-alerts', name: 'Geofence alerts (arrival/departure)', description: 'Automatic notifications when a truck enters or leaves a defined area - e.g., "Truck arrived at Walmart DC #4521"', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'Trimble has pre-defined geofences for 500K+ shipping locations. MercuryGate learns facility boundaries automatically. McLeod triggers invoicing workflows on delivery geofence. Very high value for customer communication and billing.', actionItems: '1) Build geofence capability around pickup/delivery locations (500m radius default). 2) Trigger "arrived at pickup" / "departed pickup" / "arrived at delivery" events automatically. 3) Send customer notifications on geofence triggers. 4) Auto-update shipment status on arrival/departure. 5) Learn facility boundaries from historical tracking data. 6) Trigger invoicing workflow on delivery arrival. 7) Calculate detention automatically when dwell time exceeds threshold.' },
      { id: 'exception-alerting', name: 'Exception alerting (late, at-risk)', description: 'Automatic warnings when shipments are running late or have problems - so you can fix issues before customers complain', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: true, competitorAdvantages: 'MercuryGate uses ML to predict late deliveries 6+ hours before they happen. Trimble shows traffic-adjusted arrival predictions. McLeod has configurable exception rules per customer. We do basic alerts; should add predictive capabilities.', actionItems: '1) Add predictive late delivery alerts using location + traffic + remaining drive time. 2) Calculate "at risk" shipments: ETA after appointment, no tracking for X hours, no pickup confirmation. 3) Create exception dashboard showing all at-risk loads. 4) Support customer-specific exception rules (some want alerts at 1h late, others at 4h). 5) Send proactive customer notifications before they ask. 6) Build ML model to predict which loads will have issues based on historical patterns.' },
      { id: 'customer-tracking', name: 'Customer tracking portal', description: 'Website where your customers can see their shipment status in real-time without calling you', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'MercuryGate portal shows map, timeline, documents, and ETA. Trimble portal is white-labeled with your branding. McLeod portal integrates with customer order systems. HUGE efficiency gain - reduces inbound "where is my freight?" calls 50%+.', actionItems: 'HIGH PRIORITY - EFFICIENCY MULTIPLIER: 1) Build customer portal MVP with: live shipment map, status timeline, ETA display, document access (BOL, POD). 2) White-label with broker branding (logo, colors, custom domain option). 3) Add email notifications on status changes (configurable per customer). 4) Show historical shipments with search/filter. 5) Include invoice view and payment status. 6) Mobile-responsive design required. 7) Track portal usage metrics to demonstrate value. TIMELINE: Q2-Q3, this dramatically reduces "where is my freight?" calls.' },
      { id: 'tracking-timeline', name: 'Tracking history/timeline', description: 'Visual history of all tracking events - when the truck was dispatched, picked up, had delays, delivered', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'MercuryGate timeline shows predicted vs actual with variance analysis. Trimble includes carrier communication log in timeline. McLeod stores complete audit trail. Our timeline is functional but could show more detail.', actionItems: '1) Add predicted vs actual comparison: show original ETA alongside actual arrival time with variance. 2) Include carrier communication log in timeline (calls, emails, texts). 3) Display location pings on timeline with map integration. 4) Show dwell time at each stop (time between arrival and departure). 5) Add exception events prominently (delays, issues) with reason codes. 6) Support timeline export for customer reporting. 7) Color-code events by type for quick scanning.' },
      { id: 'pod-capture', name: 'Proof of delivery capture', description: 'Collect signed delivery receipts that prove freight was delivered - required for invoicing and dispute resolution', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'partial', competitorAdvantages: 'Trimble driver apps capture POD with signature and photos instantly. MercuryGate uses AI to extract POD data automatically. McLeod validates POD against expected delivery details. We accept PODs but should add mobile capture.', actionItems: 'HIGH PRIORITY for billing: 1) Add mobile POD capture via carrier portal or driver link (no app install needed). 2) Support electronic signature capture on mobile. 3) Use AI/OCR to extract: delivery date/time, receiver name, piece count, exceptions noted. 4) Validate POD against expected delivery (correct address, expected pieces). 5) Auto-trigger invoicing workflow when POD received. 6) Store POD with timestamp and GPS coordinates for dispute resolution. TIMELINE: Part of Q2-Q3 carrier portal work.' },
      { id: 'photo-capture', name: 'Photo/document capture on delivery', description: 'Take photos of freight condition at delivery to document damages or verify counts', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'Trimble driver app captures timestamped, GPS-tagged photos. MercuryGate uses image recognition to detect damage. Critical for claims disputes - photos are evidence. Should be part of mobile app strategy.', actionItems: '1) Add photo capture to mobile POD workflow (no app install - web-based camera access). 2) Auto-tag photos with timestamp, GPS location, and load number. 3) Support multiple photos per delivery: freight condition, seal numbers, receiver signature. 4) Store photos with high enough resolution for claims disputes. 5) Consider AI damage detection to flag potential issues. 6) Link photos to shipment record for easy retrieval during disputes. TIMELINE: Part of Q2-Q3 POD capture work.' },
    ],
  },
  {
    id: 'edi-integrations',
    name: 'EDI & Integrations',
    icon: Network,
    features: [
      { id: 'edi-204', name: 'EDI 204 (Load Tender)', description: 'Receive shipment orders electronically from shippers in standard EDI format - required by major retailers and manufacturers', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: false, expertly: 'planned', competitorAdvantages: 'McLeod and Trimble have decades of EDI expertise with 95%+ trading partner coverage. CRITICAL for enterprise customers - top priority.', actionItems: 'TOP PRIORITY - ENTERPRISE GATE: 1) Partner with EDI provider (SPS Commerce, TrueCommerce, Cleo) - they have 2000+ pre-built trading partner maps. 2) Support EDI 204 inbound: parse tender, create load in TMS automatically. 3) Build EDI mapping UI for self-service setup. 4) Create test mode for trading partner onboarding. 5) Target 99.9% uptime on EDI processing. 6) Document EDI specifications publicly. TIMELINE: Q2-Q3, this is the #1 enterprise blocker.' },
      { id: 'edi-990', name: 'EDI 990 (Tender Response)', description: 'Electronically confirm you received and will handle a shipper\'s load tender', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: false, expertly: 'planned', competitorAdvantages: 'Automatic response handling in McLeod/Trimble. Part of core EDI requirement.', actionItems: 'Part of EDI 204 implementation: 1) Auto-generate 990 acceptance when load is accepted in TMS. 2) Support 990 rejection with reason codes. 3) Track 990 response time SLA (most shippers expect <15 min). 4) Alert when 990 response is overdue. Required by any shipper using EDI 204.' },
      { id: 'edi-214', name: 'EDI 214 (Status Update)', description: 'Send shipment status updates (picked up, in transit, delivered) to shippers electronically', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: false, expertly: 'planned', competitorAdvantages: 'Real-time status updates required by major shippers like Walmart, Target. Enterprise blocker.', actionItems: 'Critical for enterprise: 1) Auto-send 214 on status changes: pickup, departure, arrival, delivery. 2) Support shipper-specific status code mapping (each has their own codes). 3) Send 214 triggered by geofence events when tracking is active. 4) Track 214 delivery success/failures. 5) Required by Walmart, Target, Amazon - won\'t get their business without it. Include in Q2-Q3 EDI work.' },
      { id: 'edi-210', name: 'EDI 210 (Invoice)', description: 'Send invoices to shippers electronically for automated processing and faster payment', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: false, expertly: 'planned', competitorAdvantages: 'Electronic invoicing reduces DSO by 5-10 days. Major customer requirement.', actionItems: 'Important for cash flow: 1) Generate 210 invoice from TMS invoice data. 2) Support shipper-specific formats and codes. 3) Track 210 acknowledgment and payment timing. 4) Reduces DSO 5-10 days vs paper/email invoicing. 5) Many shippers require EDI invoicing for preferred vendor status. Include in Q3 EDI work.' },
      { id: 'api-access', name: 'API access', description: 'Let customers and partners connect their systems to ours programmatically', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'MercuryGate has most extensive REST API documentation. We should publish comprehensive API docs.', actionItems: '1) Publish comprehensive REST API documentation publicly. 2) Create API playground for developers to test. 3) Add webhook support for real-time event notifications. 4) Implement API rate limiting and authentication best practices. 5) Build sample integrations and code examples. 6) Consider GraphQL for more flexible queries. Our API exists but needs better documentation.' },
      { id: 'quickbooks', name: 'QuickBooks integration', description: 'Sync invoices and payments with QuickBooks accounting software', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: true, dat: 'addon', expertly: 'planned', competitorAdvantages: 'Descartes Aljex has native QuickBooks sync. Popular with smaller brokers - PRIORITY for SMB market.', actionItems: 'PRIORITY for SMB market: 1) Build QuickBooks Online integration using their API. 2) Sync customers (create QB customer when TMS customer created). 3) Push invoices to QB when created in TMS. 4) Pull payments from QB when recorded. 5) Map GL codes to QB accounts. 6) Support QuickBooks Desktop via Web Connector if demand exists. TIMELINE: Q3, critical for smaller brokers.' },
      { id: 'sage', name: 'Sage integration', description: 'Sync with Sage accounting software used by some mid-market companies', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: false, competitorAdvantages: 'Trimble has certified Sage integration. Less common requirement than QuickBooks.', actionItems: 'Lower priority than QuickBooks. If customer demand emerges: 1) Research Sage API availability (Sage 50, Sage 100, Sage Intacct have different APIs). 2) Build on demand for specific enterprise customer. 3) Consider integration platform (Workato, Zapier) for faster delivery.' },
      { id: 'netsuite', name: 'NetSuite integration', description: 'Sync with NetSuite ERP used by mid-market and enterprise companies', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: false, competitorAdvantages: 'MercuryGate offers pre-built NetSuite connector. Enterprise accounting requirement.', actionItems: 'Enterprise requirement: 1) Build NetSuite integration using SuiteTalk API. 2) Sync customers, invoices, payments, and vendors (carriers). 3) Map GL codes and departments. 4) Consider building when we have enterprise customer requiring it. Lower priority than QuickBooks for now.' },
      { id: 'salesforce', name: 'Salesforce CRM integration', description: 'Connect sales pipeline and customer data between Salesforce and TMS', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'MercuryGate has bi-directional Salesforce sync. Growing requirement for sales-driven brokers.', actionItems: '1) Build Salesforce integration: sync accounts (customers), opportunities, and activity. 2) Show TMS data in Salesforce: shipment count, revenue, margins per customer. 3) Create Salesforce app/widget for quick TMS access. 4) Track quote → close → shipment in Salesforce. 5) Growing requirement as brokers professionalize sales. TIMELINE: Q4 or when customer demand justifies.' },
      { id: 'macropoint', name: 'MacroPoint/FourKites integration', description: 'Connect to leading visibility platforms for real-time tracking across carriers', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'Trimble has native MacroPoint integration. Essential for real-time visibility requirements.', actionItems: 'Part of tracking strategy: 1) Integrate MacroPoint API (now DAT Visibility) - they aggregate tracking from most carriers. 2) Alternative: project44 or FourKites depending on customer preference. 3) Send load info to visibility platform. 4) Receive location updates into TMS. 5) Show tracking on map with ETA. Include in Q2-Q3 tracking initiative.' },
      { id: 'dat-loadboard', name: 'DAT load board integration', description: 'Post loads to DAT, the largest freight marketplace, and find available carriers', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: true, expertly: 'planned', competitorAdvantages: 'DAT has seamless native integration obviously. MercuryGate posts loads directly. HIGH VALUE for spot market.', actionItems: 'TOP PRIORITY for spot brokers: 1) Integrate DAT PowerDAT API: post loads, search carriers, get rate data. 2) One-click "post to DAT" from dispatch. 3) Auto-remove when load covered. 4) Show DAT market rates for lane benchmarking. 5) Display carrier contact info from DAT responses. 6) Track which loads came from DAT. TIMELINE: Q2, essential for spot market brokers.' },
      { id: 'truckstop', name: 'Truckstop load board integration', description: 'Post loads to Truckstop, the second-largest freight marketplace', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'MercuryGate supports multiple load boards. Important for capacity finding.', actionItems: '1) Integrate Truckstop ITS API for load posting. 2) Post to both DAT and Truckstop simultaneously for maximum reach. 3) Some carriers prefer Truckstop, so coverage improves with both. 4) Add after DAT integration is stable. TIMELINE: Q3, after DAT integration.' },
      { id: 'trucker-tools', name: 'Trucker Tools integration', description: 'Get tracking from carriers via free Trucker Tools app - no ELD required', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'MercuryGate has Trucker Tools tracking built-in. Good for smaller carriers without ELD.', actionItems: 'Good backup tracking: 1) Integrate Trucker Tools API - free for carriers, they just download app. 2) Send tracking request link to carriers who don\'t have ELD. 3) Receive location updates from driver\'s phone. 4) Good solution for owner-operators and small carriers. 5) Include in Q2-Q3 tracking initiative as complement to MacroPoint.' },
    ],
  },
  {
    id: 'billing-invoicing',
    name: 'Billing & Invoicing',
    icon: DollarSign,
    features: [
      { id: 'invoice-gen', name: 'Invoice generation', description: 'Create invoices to bill customers for completed shipments', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod auto-generates invoices the moment POD is received. MercuryGate calculates all accessorials automatically. Trimble validates invoices against contracted rates before sending. Our invoicing is functional; should add auto-generation.', actionItems: '1) Add auto-invoice trigger when POD received (configurable per customer). 2) Auto-calculate accessorials based on shipment events (detention, fuel surcharge). 3) Validate invoice against contracted rates before generation. 4) Support invoice review queue before auto-send. 5) Track invoice generation time - target <5 min from POD to invoice. 6) Add bulk invoice generation for end-of-day processing.' },
      { id: 'invoice-pdf', name: 'Invoice PDF export', description: 'Generate professional PDF invoices with your company branding', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod offers 20+ invoice templates. MercuryGate supports multiple invoice formats per customer. Trimble includes load documents as invoice attachments. Standard feature, we\'re on par.', actionItems: '1) Add 5-10 professional invoice templates (modern, classic, detailed). 2) Support per-customer invoice formats (some want summary, others detailed). 3) Option to attach supporting docs (BOL, POD, rate con) to invoice PDF. 4) Include company branding (logo, colors, remittance address). 5) Support multiple currency formats for international customers. 6) Add invoice memo/notes section for special instructions.' },
      { id: 'email-invoices', name: 'Email invoices directly', description: 'Send invoices via email without downloading and attaching manually', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'MercuryGate tracks email opens and when invoices are viewed. Trimble supports scheduled invoice sending. McLeod maintains email history per customer. Consider adding open/view tracking.', actionItems: '1) Add email open tracking using tracking pixel. 2) Show "Invoice viewed" notification when customer opens email. 3) Track email delivery status (sent, delivered, bounced). 4) Support scheduled invoice sending (send all invoices at 8am). 5) Maintain email history per customer for audit trail. 6) Add customizable email templates with merge fields.' },
      { id: 'batch-invoicing', name: 'Batch invoicing', description: 'Generate and send many invoices at once - e.g., invoice all delivered loads from last week in one click', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'planned', competitorAdvantages: 'MercuryGate processes thousands of invoices in minutes with automatic validation. McLeod supports complex batch rules (by customer, date range, status). Trimble previews batch before sending. Important for efficiency at scale.', actionItems: 'PRIORITY for efficiency: 1) Build batch invoice generator with filters: date range, customer, status (delivered + POD received). 2) Add validation before batch: check for missing data, rate mismatches, duplicate invoices. 3) Show batch preview before sending - allow removal of individual invoices. 4) Support batch rules: "Invoice all loads with POD older than 24 hours". 5) Process batches asynchronously with progress indicator. 6) Send batch completion report with success/failure summary. TIMELINE: Q3, important for scaling operations.' },
      { id: 'invoice-status', name: 'Invoice status tracking', description: 'Track invoice lifecycle - sent, viewed, paid, disputed', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'MercuryGate shows detailed payment application history. Trimble tracks partial payments and credits. McLeod has invoice dispute workflow. Our tracking is basic but functional.', actionItems: '1) Add granular status tracking: Draft → Sent → Viewed → Partial Paid → Paid → Closed. 2) Support partial payments with remaining balance tracking. 3) Build dispute workflow: customer disputes → review → adjust or hold. 4) Show payment application history (which payments applied to which invoices). 5) Add status change notifications and alerts for aging invoices. 6) Create invoice status dashboard with aging summary.' },
      { id: 'payment-recording', name: 'Payment recording', description: 'Record when customers pay invoices to track what\'s outstanding', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod supports automatic payment import from bank feeds. MercuryGate matches payments to invoices using AI. Trimble integrates with major accounting systems. Our payment recording is manual; should add bank import.', actionItems: '1) Add bank feed integration (Plaid or direct bank API) for automatic payment import. 2) Build AI-powered payment matching: match incoming payments to invoices by amount, reference, customer. 3) Support batch payment entry for check runs. 4) Track payment method (ACH, check, wire) and reference numbers. 5) Auto-match payments within tolerance (e.g., $0.01-$1.00 variance). 6) Flag unmatched payments for manual review. TIMELINE: Q3-Q4, significant efficiency gain.' },
      { id: 'aging-reports', name: 'Aging reports', description: 'See which invoices are overdue and by how long (30/60/90 days) to prioritize collections', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: 'partial', competitorAdvantages: 'McLeod has executive dashboards showing aging trends over time. MercuryGate calculates customer risk scores based on payment history. Trimble offers drill-down from aging to individual invoices. Our aging is basic; needs enhancement.', actionItems: '1) Build standard aging buckets: Current, 1-30, 31-60, 61-90, 90+ days. 2) Add aging trends over time: is aging getting better or worse? 3) Calculate customer risk scores based on payment history. 4) Support drill-down from aging summary to individual invoices. 5) Create executive dashboard showing total AR, aging distribution, DSO trends. 6) Add collection notes and activity tracking per customer. 7) Support aging report by sales rep for accountability.' },
      { id: 'credit-hold', name: 'Credit hold management', description: 'Automatically stop quoting/shipping for customers who owe too much money or are too far past due', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: true, competitorAdvantages: 'McLeod has sophisticated credit rules (% of credit limit, days past due combinations). MercuryGate shows credit warnings during quote entry. Trimble supports approval workflows for credit exceptions. Our credit hold works but needs more configurability.', actionItems: '1) Add configurable credit rules: by credit limit amount, by % of limit used, by days past due. 2) Support rule combinations: hold if (over 80% limit AND has 60+ day past due). 3) Show credit warnings during quote entry - soft warning before hard block. 4) Build credit exception approval workflow: sales rep requests, manager approves. 5) Send automatic notifications when customer approaches credit limit. 6) Track credit exception history for audit purposes.' },
      { id: 'line-items', name: 'Invoice line item customization', description: 'Add, remove, or modify individual charges on invoices - linehaul, fuel, accessorials', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'MercuryGate has 50+ standard accessorial codes with customer-specific naming. McLeod supports GL code mapping per line item. Trimble validates line items against contracted rates. We\'re functional here.', actionItems: '1) Add standard accessorial code library (detention, layover, fuel surcharge, lumper, etc.). 2) Support customer-specific accessorial naming (map our codes to their codes). 3) Add GL code mapping per line item type for accounting export. 4) Validate line items against contracted rates during invoice creation. 5) Support line item templates for common charge combinations. 6) Track line item adjustments with audit trail.' },
      { id: 'accessorials', name: 'Accessorial billing (detention, layover)', description: 'Bill for extra services beyond basic transport - waiting time (detention), overnight stays (layover), liftgate use, etc.', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod auto-calculates detention from actual arrival/departure times. MercuryGate has rules engine for accessorial triggers. Trimble tracks accessorial approval workflows. Should add automatic detention calculation.', actionItems: '1) Auto-calculate detention from tracking: if dwell time > 2 hours, trigger detention charge. 2) Build accessorial rules engine: define triggers and rates per accessorial type. 3) Support customer-specific accessorial rates and free time allowances. 4) Add accessorial approval workflow for charges over threshold. 5) Track accessorial recovery rate (charged vs. paid by customer). 6) Calculate detention automatically from geofence arrival/departure times.' },
      { id: 'auto-invoice-pod', name: 'Automatic invoice from POD', description: 'Automatically generate and send invoice the moment proof of delivery is received', mcleod: true, trimble: true, mercurygate: true, descartes: 'partial', dat: false, expertly: 'planned', competitorAdvantages: 'MercuryGate closes loads and invoices in under 5 minutes from POD receipt. McLeod validates POD data before auto-invoicing. Trimble triggers different workflows based on customer preferences. Huge cash flow improvement - reduces DSO by 3-5 days.', actionItems: 'HIGH PRIORITY - CASH FLOW IMPACT: 1) Build auto-invoice trigger on POD receipt with configurable delay (immediate, 1 hour, end of day). 2) Validate POD before auto-invoicing: delivery confirmed, no exceptions noted, required fields present. 3) Support per-customer auto-invoice preferences (some want manual review). 4) Add validation rules: skip auto-invoice if discrepancies found. 5) Track time from POD to invoice to measure improvement. 6) Target: <5 minutes from POD to invoice for clean deliveries. TIMELINE: Q2, significant DSO improvement.' },
      { id: 'payment-terms', name: 'Customer payment terms', description: 'Set different payment expectations per customer - Net 30, Net 45, etc.', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod supports early payment discounts (2% 10 Net 30). MercuryGate tracks payment term compliance. Trimble alerts when customers consistently pay late. Standard feature, we\'re adequate.', actionItems: '1) Support standard payment terms: Net 15, Net 30, Net 45, Net 60, Due on Receipt. 2) Add early payment discounts (e.g., 2% 10 Net 30 = 2% discount if paid within 10 days). 3) Track payment term compliance: does customer actually pay by due date? 4) Alert when customers consistently pay late (avg days past due). 5) Show payment terms on invoice and in customer profile. 6) Consider payment term as factor in credit limit decisions.' },
    ],
  },
  {
    id: 'carrier-payables',
    name: 'Carrier Payables',
    icon: ClipboardList,
    features: [
      { id: 'carrier-settlement', name: 'Carrier settlement/payment', description: 'Calculate and process what you owe carriers for completed loads', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: 'partial', competitorAdvantages: 'McLeod has sophisticated settlement workbench processing hundreds of settlements per hour. MercuryGate auto-calculates pay including fuel, accessorials, and deductions. Trimble validates against rate confirmations automatically. We need full settlement workflow - high priority for operations.', actionItems: 'HIGH PRIORITY for operations: 1) Build settlement workbench: view all loads ready for payment, approve/adjust, batch pay. 2) Auto-calculate carrier pay: linehaul + fuel surcharge + accessorials - deductions. 3) Validate against rate confirmation before settlement. 4) Support batch settlement processing (pay multiple carriers at once). 5) Generate payment file for ACH processing. 6) Track settlement status: pending, approved, paid, remittance sent. 7) Send remittance advice to carriers on payment. TIMELINE: Q2, essential for operations.' },
      { id: 'rate-matching', name: 'Rate confirmation matching', description: 'Verify carrier invoices match what was agreed on the rate confirmation to catch billing errors', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'planned', competitorAdvantages: 'MercuryGate uses AI to match carrier invoices to loads with 95%+ accuracy. McLeod highlights discrepancies for review. Trimble auto-approves exact matches. Critical for catching carrier overbilling - typically saves 1-2% of carrier costs.', actionItems: 'PRIORITY - COST SAVINGS: 1) Use AI/OCR to extract carrier invoice amounts and match to rate con. 2) Auto-approve exact matches (within $1 tolerance). 3) Flag discrepancies for review with side-by-side comparison. 4) Track match rate and discrepancy reasons. 5) Calculate savings from caught overbilling. 6) Build discrepancy dashboard showing patterns (which carriers overbill?). 7) Target 95%+ auto-match rate. TIMELINE: Q2-Q3, typically saves 1-2% of carrier costs.' },
      { id: 'carrier-invoice', name: 'Carrier invoice processing', description: 'Receive and process invoices from carriers requesting payment for completed loads', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: 'partial', competitorAdvantages: 'MercuryGate has carrier invoice portal - carriers submit invoices directly. McLeod uses OCR to extract invoice data from PDFs. Trimble validates against supporting documents (BOL, POD). Should add carrier invoice portal and auto-extraction.', actionItems: '1) Build carrier invoice submission in carrier portal - carriers upload directly instead of emailing. 2) Use AI/OCR to extract invoice data from PDFs (amount, date, load reference). 3) Auto-match invoices to loads using reference numbers. 4) Validate against required docs: POD received, rate con signed. 5) Track invoice processing time (submission to payment). 6) Send automatic acknowledgment when invoice received. 7) Create carrier invoice queue for AP review.' },
      { id: 'factoring', name: 'Factoring integration', description: 'Connect with factoring companies (who pay carriers quickly in exchange for a fee) - carriers often use these for cash flow', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'MercuryGate integrates with major factors (Triumph, RTS, OTR). McLeod sends payment directly to factor when carrier is factored. Trimble tracks NOA (Notice of Assignment) automatically. Important for carrier relationships - many small carriers factor.', actionItems: '1) Track NOA (Notice of Assignment) status per carrier - flag when carrier is factored. 2) Redirect payment to factor instead of carrier when NOA active. 3) Integrate with major factors APIs: Triumph, RTS, OTR Solutions, TAFS. 4) Send payment verification to factors as required. 5) Support NOA upload and storage in carrier profile. 6) Alert when payment is going to factor vs. carrier. TIMELINE: Q3-Q4, important for carrier relationships.' },
      { id: 'quick-pay', name: 'Quick pay options', description: 'Pay carriers faster than standard terms (e.g., 2 days instead of 30) for a fee - carriers love this, it\'s profitable for brokers', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: false, expertly: 'planned', competitorAdvantages: 'McLeod has configurable quick pay rules (3% for same day, 2% for 5 days, etc.). MercuryGate offers quick pay from carrier portal. Trimble tracks quick pay profitability. Great profit center for brokers - typically 2-3% fee, easy money.', actionItems: 'PRIORITY - PROFIT CENTER: 1) Build quick pay program: same day (3%), 2-day (2.5%), 5-day (2%) fee tiers. 2) Allow carriers to request quick pay from carrier portal. 3) Auto-calculate quick pay fee and net payment amount. 4) Track quick pay profitability: total fees earned. 5) Show quick pay option on settlement workbench. 6) Market quick pay to carriers - competitive advantage for carrier recruitment. 7) Consider offering quick pay as standard for preferred carriers. TIMELINE: Q2-Q3, profit center for the business.' },
      { id: 'carrier-payment-status', name: 'Carrier payment status', description: 'Track what\'s been paid, what\'s pending, and communicate payment status to carriers', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: 'partial', competitorAdvantages: 'MercuryGate carrier portal shows payment status in real-time - reduces "where\'s my money" calls. McLeod sends automatic payment notifications. Trimble tracks check numbers and payment methods. Need carrier-facing payment visibility.', actionItems: '1) Show payment status in carrier portal: pending, approved, scheduled, paid. 2) Display expected payment date based on settlement schedule. 3) Send automatic payment notification when payment is processed. 4) Track check number/ACH reference for payment inquiries. 5) Show remittance detail: which loads are included in this payment. 6) Allow carriers to see their full payment history with us. 7) Reduce "where\'s my money" calls by making info self-service.' },
      { id: 'payables-aging', name: 'Payables aging reports', description: 'See what you owe carriers by age - which bills are coming due soon or overdue', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'planned', competitorAdvantages: 'McLeod has cash flow forecasting based on payables aging. MercuryGate shows expected outflow by date. Trimble tracks carrier payment terms compliance. Important for cash management.', actionItems: '1) Build payables aging report: Current, 1-30, 31-60, 61-90, 90+ days. 2) Add cash flow forecast: expected outflow by week for next 4-8 weeks. 3) Track payment terms compliance: are we paying carriers on time? 4) Show payables by carrier with drill-down to individual loads. 5) Highlight overdue payables - carriers may stop working with us. 6) Support scheduled payment runs (e.g., pay all Net 30 items on Fridays). TIMELINE: Q3, important for cash management.' },
    ],
  },
  {
    id: 'document-management',
    name: 'Document Management',
    icon: FolderOpen,
    features: [
      { id: 'doc-upload', name: 'Document upload/storage', description: 'Store all shipment-related documents (BOLs, PODs, invoices, rate confirmations) in one place', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod has unlimited document storage with version history. MercuryGate organizes docs by shipment and document type automatically. Trimble links documents to GL transactions for audit. Our storage is functional but lacks organization features.', actionItems: '1) Auto-organize documents by shipment and document type (BOL, POD, Rate Con, Invoice). 2) Add version history for documents - track if POD was replaced/updated. 3) Link documents to related records: load, carrier, customer, invoice. 4) Support drag-drop upload and batch upload. 5) Show document checklist per load: BOL ✓, Rate Con ✓, POD ✗. 6) Add document expiration alerts (certificates, contracts). 7) Implement retention policy: archive old docs, delete after X years if required.' },
      { id: 'bol-gen', name: 'BOL generation', description: 'Create Bills of Lading - the legal document describing freight that travels with every shipment', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: 'planned', competitorAdvantages: 'McLeod has 50+ BOL templates including specialized formats (Hazmat, refrigerated). MercuryGate generates BOLs with shipper-specific requirements automatically. Trimble includes barcode/QR codes for scanning. Standard requirement for operations.', actionItems: 'PRIORITY for operations: 1) Build standard BOL template compliant with industry standards (straight BOL, VICS). 2) Add specialized templates: Hazmat, refrigerated (temp requirements), high-value. 3) Support shipper-specific BOL formats (some customers have their own). 4) Include barcode/QR code for easy scanning and tracking. 5) Auto-populate from shipment data - no re-entry needed. 6) Support PDF generation and printing. TIMELINE: Q2, standard requirement for operations.' },
      { id: 'ratecon-storage', name: 'Rate confirmation storage', description: 'Store the signed agreements between you and carriers - needed for disputes and audits', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod links rate cons to all related documents (POD, invoice, settlement). MercuryGate tracks rate con versions and change history. Trimble highlights discrepancies between rate con and invoice. We store docs well but need better linking.', actionItems: '1) Link rate con to all related documents: load, POD, carrier invoice, settlement. 2) Track rate con versions: original, amendments, with change history. 3) Extract key terms from rate con using AI (rate, accessorials, special instructions). 4) Flag discrepancies between rate con and carrier invoice automatically. 5) Support rate con status: draft, sent, signed, expired. 6) Enable quick retrieval during disputes with carrier.' },
      { id: 'pod-storage', name: 'POD storage', description: 'Store signed proof of delivery documents - required for invoicing and resolving delivery disputes', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'MercuryGate extracts delivery time and signature from POD images automatically. Trimble validates POD against expected delivery. McLeod triggers invoicing workflow on POD receipt. We store PODs but lack extraction capabilities.', actionItems: '1) Use AI/OCR to extract from POD: delivery date/time, receiver name, signature present, exception notes. 2) Validate POD against expected delivery (correct address, expected receiver). 3) Trigger invoicing workflow automatically on POD receipt. 4) Link POD to load, invoice, and carrier settlement. 5) Support POD quality check: is signature present, is it legible? 6) Flag PODs with exceptions or discrepancies for review.' },
      { id: 'doc-imaging', name: 'Document imaging/scanning', description: 'Scan paper documents or capture photos to create digital records', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'partial', competitorAdvantages: 'Trimble mobile app scans docs with automatic edge detection and enhancement. MercuryGate uses OCR to extract data from scanned docs. McLeod integrates with document scanning services. Should add mobile scanning capability.', actionItems: '1) Add mobile document scanning in carrier/customer portal using camera. 2) Implement edge detection and auto-crop for cleaner scans. 3) Apply image enhancement (brightness, contrast) for better readability. 4) Use OCR to extract text from scanned documents. 5) Support multi-page document scanning (scan all pages, combine into one PDF). 6) Auto-classify scanned docs using AI (is this a POD, BOL, or carrier invoice?).' },
      { id: 'doc-search', name: 'Document search', description: 'Find documents by load number, carrier name, date range, or document content', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: true, competitorAdvantages: 'MercuryGate has full-text search within document content (OCR). McLeod searches by metadata, date, type, and custom fields. Trimble finds documents across all related entities. Our search is by metadata only; should add content search.', actionItems: '1) Add full-text search within document content using OCR-extracted text. 2) Support search by metadata: load number, customer, carrier, date range, document type. 3) Enable cross-entity search: find all docs related to a carrier across all loads. 4) Add search filters: document type, date range, uploaded by. 5) Show search results with document preview. 6) Save frequent searches for quick access.' },
      { id: 'auto-classification', name: 'Automatic document classification', description: 'AI that automatically identifies document types - "this is a POD" vs "this is a carrier invoice"', mcleod: false, trimble: 'partial', mercurygate: true, descartes: false, dat: false, expertly: 'planned', competitorAdvantages: 'MercuryGate AI identifies 20+ document types with 95% accuracy and routes them automatically. Trimble uses ML to improve classification over time. Huge time saver for document-heavy operations. Good fit for our AI capabilities.', actionItems: 'GOOD FIT for our AI capabilities: 1) Build AI classifier for common doc types: POD, BOL, Rate Con, Carrier Invoice, Insurance Cert, W9. 2) Auto-route documents to correct location based on classification. 3) Use Claude/LLM for classification - more flexible than rules-based. 4) Target 95%+ accuracy with confidence scoring. 5) Learn from corrections when user re-classifies. 6) Extract load number from document to auto-link. TIMELINE: Q2-Q3, leverages our AI strengths.' },
      { id: 'email-doc-capture', name: 'Email document capture', description: 'Automatically save documents received via email and attach them to the correct shipment', mcleod: 'partial', trimble: 'partial', mercurygate: true, descartes: 'partial', dat: false, expertly: true, competitorAdvantages: 'MercuryGate monitors email for attachments and auto-files them by load number. McLeod matches documents to loads using reference numbers. We capture well from our inbox; should expand to monitoring additional email sources.', actionItems: '1) Monitor multiple email addresses for incoming documents (docs@, pods@, invoices@). 2) Auto-extract attachments and classify using AI. 3) Match documents to loads using reference numbers in email subject/body. 4) Handle multiple attachments per email (common: POD + carrier invoice together). 5) Alert if document cannot be matched to a load. 6) Support email forwarding rules: forward to TMS for processing.' },
    ],
  },
  {
    id: 'reporting-analytics',
    name: 'Reporting & Analytics',
    icon: PieChart,
    features: [
      { id: 'prebuilt-reports', name: 'Pre-built reports', description: 'Ready-to-use reports for common needs - revenue, margins, carrier performance, etc.', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod has 200+ pre-built reports covering every aspect of operations. MercuryGate includes benchmarking against industry averages. Trimble offers role-based report libraries (exec, ops, accounting). We have solid basics; should add more specialized reports.', actionItems: '1) Build report library by role: Executive (revenue, margin trends), Operations (load volume, on-time), Accounting (AR aging, AP due). 2) Add specialized reports: customer profitability, carrier scorecard, lane analysis, sales rep performance. 3) Include benchmarking where possible (industry averages if available). 4) Create report catalog with descriptions and sample output. 5) Track which reports are most used to prioritize enhancements. 6) Target 50+ pre-built reports covering common needs.' },
      { id: 'custom-reports', name: 'Custom report builder', description: 'Create your own reports by selecting fields, filters, and calculations without coding', mcleod: true, trimble: true, mercurygate: true, descartes: 'partial', dat: 'partial', expertly: 'planned', competitorAdvantages: 'McLeod Report Builder lets non-technical users create complex reports. MercuryGate has drag-drop report designer with calculated fields. Trimble integrates with Crystal Reports for advanced customization. Important for customers with unique reporting needs.', actionItems: 'ENTERPRISE feature: 1) Build drag-drop report designer: select fields from any entity (loads, customers, carriers). 2) Support filters: date range, customer, carrier, status, custom field values. 3) Add calculated fields: margin %, on-time %, custom formulas. 4) Enable grouping and subtotals (by customer, by week, by lane). 5) Support multiple output formats: table, chart, pivot. 6) Save and share custom reports with team. TIMELINE: Q3-Q4, important for enterprise customers with unique needs.' },
      { id: 'dashboard-kpi', name: 'Dashboard with KPIs', description: 'Visual overview showing key metrics at a glance - load count, revenue, margins, on-time %', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'MercuryGate dashboards are highly customizable with 50+ widgets. Trimble shows trend lines and period comparisons. McLeod has role-specific dashboards (dispatcher vs. manager views). Our dashboard is clean but could add more customization.', actionItems: '1) Add dashboard customization: drag-drop widgets, resize, save layout. 2) Build widget library: charts, tables, gauges, alerts. 3) Show trend lines and period-over-period comparisons (this week vs last week). 4) Support role-specific default dashboards: dispatcher, manager, executive. 5) Add real-time updates for operational metrics. 6) Enable drill-down from KPI to underlying data.' },
      { id: 'revenue-reports', name: 'Revenue reports', description: 'Track money coming in - by customer, lane, time period, sales rep, etc.', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod has detailed revenue recognition timing and accrual reports. MercuryGate shows revenue trends with forecasting. Trimble integrates revenue with accounting for reconciliation. Our revenue reports are functional.', actionItems: '1) Add revenue breakdown by: customer, lane, equipment type, sales rep, time period. 2) Show revenue recognition: when was revenue earned vs. when invoice was sent vs. when payment received. 3) Add revenue trends with forecasting based on historical patterns. 4) Support revenue comparison: this period vs. last period, vs. budget. 5) Include accrued revenue for delivered but not yet invoiced loads. 6) Export revenue data for accounting reconciliation.' },
      { id: 'margin-analysis', name: 'Margin analysis', description: 'See profit margins on loads - comparing what you charge customers vs. what you pay carriers', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod shows margin by customer, lane, equipment type, and sales rep. MercuryGate tracks margin trends and identifies declining lanes. Trimble compares actual vs. quoted margins. We do margins well - recent enhancement.', actionItems: '1) Add margin breakdown by: customer, lane, equipment type, sales rep, dispatcher. 2) Track margin trends over time - identify declining lanes or customers. 3) Compare actual margin vs. quoted margin (did we give away margin on adjustments?). 4) Highlight low-margin loads and patterns (why are some lanes always low?). 5) Calculate margin including all costs (fuel, accessorials, claims). 6) Set margin alerts: notify when load is below target margin.' },
      { id: 'lane-analysis', name: 'Lane analysis', description: 'Analyze performance on specific routes - Chicago to Dallas margins, volume, carrier performance', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod identifies profitable vs. money-losing lanes with root cause analysis. MercuryGate shows lane pricing trends over time. DAT integrates spot market rates for lane benchmarking. We have basic lane analysis; should add benchmarking.', actionItems: '1) Build lane profitability report: revenue, cost, margin, volume per lane. 2) Identify profitable vs. money-losing lanes with root cause (carrier costs? Low volume?). 3) Show lane pricing trends over time (is this lane getting more/less expensive?). 4) Integrate spot market rates from DAT for benchmarking when available. 5) Analyze carrier performance by lane (who\'s best on which routes?). 6) Support lane grouping: by region, by customer, by equipment type.' },
      { id: 'carrier-performance', name: 'Carrier performance reports', description: 'Track how carriers perform - on-time delivery %, claims, service failures, tender acceptance', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'MercuryGate has carrier scorecards shared with carriers directly. DAT provides industry comparison for carrier performance. McLeod tracks performance by lane and equipment type. We added carrier performance recently - should add scorecards.', actionItems: '1) Build carrier scorecard: on-time %, tender acceptance, claims rate, service failures. 2) Share scorecards with carriers via carrier portal. 3) Track performance by lane and equipment type for each carrier. 4) Compare carrier performance to averages (top 25%, bottom 25%). 5) Identify performance trends: is this carrier getting better or worse? 6) Use performance data in carrier recommendations and auto-assignment.' },
      { id: 'customer-profitability', name: 'Customer profitability reports', description: 'See which customers are most/least profitable including all costs and time spent', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'partial', competitorAdvantages: 'McLeod calculates true customer profitability including indirect costs (claims, re-deliveries). MercuryGate tracks revenue per transaction and cost-to-serve. Trimble identifies at-risk customer relationships. We show basic profitability; need full cost allocation.', actionItems: '1) Calculate true customer profitability including indirect costs: claims, re-deliveries, extra service time. 2) Track cost-to-serve metrics: # of quotes, # of calls, adjustments made. 3) Identify at-risk customer relationships: declining volume, increasing issues. 4) Show profitability trend by customer over time. 5) Compare customer profitability to identify what makes customers profitable. 6) Flag unprofitable customers for pricing review or conversation.' },
      { id: 'export-excel', name: 'Export to Excel/CSV', description: 'Download report data for further analysis in spreadsheets', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'MercuryGate exports maintain formatting and formulas. McLeod offers scheduled exports to SFTP for automation. Trimble integrates with Power BI and Tableau. Our exports work; should add scheduled exports.', actionItems: '1) Support Excel export with formatting preserved (column widths, headers). 2) Add CSV export for data integration with other tools. 3) Build scheduled export: automatically export report to email/SFTP on schedule. 4) Consider Power BI / Tableau connectors for enterprise customers. 5) Support large exports with background processing and download notification. 6) Include export history showing what was exported and when.' },
      { id: 'scheduled-reports', name: 'Scheduled report delivery', description: 'Automatically email reports on a schedule - e.g., "send revenue report every Monday morning"', mcleod: true, trimble: true, mercurygate: true, descartes: 'partial', dat: false, expertly: 'planned', competitorAdvantages: 'MercuryGate supports complex schedules and recipient lists. McLeod sends different reports to different people based on role. Trimble integrates with notification systems. Popular feature for management reporting.', actionItems: 'PRIORITY for enterprise: 1) Build report scheduling: daily, weekly (specific day), monthly, custom cron. 2) Support multiple recipients per scheduled report. 3) Send reports as email attachment (PDF, Excel) or link. 4) Support role-based scheduling: executives get summary, ops gets details. 5) Track report delivery success/failure. 6) Allow pause/resume of scheduled reports. TIMELINE: Q3, popular feature for management reporting.' },
      { id: 'realtime-analytics', name: 'Real-time analytics', description: 'See current day activity as it happens, not just historical data', mcleod: 'partial', trimble: true, mercurygate: true, descartes: 'partial', dat: 'partial', expertly: true, competitorAdvantages: 'MercuryGate has real-time operational dashboards updating every minute. Trimble shows live tracking integrated with analytics. We do real-time well for current operations.', actionItems: 'We do this well - MAINTAIN: 1) Continue real-time dashboard updates (current: good refresh rate). 2) Add live load tracking integrated with analytics. 3) Show real-time exception counts and alerts. 4) Support real-time collaborative views (multiple users see same live data). 5) Add "as of" timestamp so users know data freshness. 6) Consider WebSocket for instant updates on critical metrics.' },
    ],
  },
  {
    id: 'compliance-safety',
    name: 'Compliance & Safety',
    icon: Scale,
    features: [
      { id: 'fmcsa-data', name: 'FMCSA data integration', description: 'Pull carrier authority, safety data, and insurance info directly from the Federal Motor Carrier Safety Administration database', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod has real-time FMCSA monitoring with instant alerts on authority changes. DAT integrates FMCSA with their CarrierWatch scoring. Trimble shows historical FMCSA trends. We pull data well; should add monitoring/alerts.', actionItems: '1) Add real-time FMCSA monitoring: instant alert when carrier authority status changes. 2) Show historical FMCSA trends (safety scores over time). 3) Display all FMCSA data: authority, insurance, safety rating, inspection history. 4) Alert when carrier\'s authority is revoked/suspended - block tendering. 5) Track insurance requirements from FMCSA (BIPD, cargo minimums). 6) Consider integrating additional risk scoring beyond basic FMCSA data.' },
      { id: 'dot-compliance', name: 'DOT compliance tracking', description: 'Ensure carriers meet Department of Transportation requirements - valid authority, insurance, safety ratings', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: 'partial', expertly: 'partial', competitorAdvantages: 'Trimble has most comprehensive compliance tracking with configurable rules per shipper. MercuryGate automatically blocks non-compliant carriers. McLeod integrates with third-party compliance services. Should add automatic blocking.', actionItems: '1) Build configurable compliance rules: minimum insurance amounts, safety rating requirements. 2) Auto-block non-compliant carriers from tendering (no manual intervention needed). 3) Support customer-specific compliance rules (some shippers have stricter requirements). 4) Integrate with compliance services (Highway, Rmis) for enhanced verification. 5) Create compliance dashboard showing carrier compliance status. 6) Track compliance over time: which carriers frequently fall out of compliance?' },
      { id: 'hos-visibility', name: 'HOS (Hours of Service) visibility', description: 'See how many driving hours carriers have remaining - drivers can legally drive max 11 hours per day under federal law', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: false, competitorAdvantages: 'Trimble has deep ELD integration showing real-time HOS for all drivers. MercuryGate validates pickup appointments against driver available hours. Critical for asset-based carriers; less relevant for pure brokers.', actionItems: 'LOWER PRIORITY for pure brokerage: 1) If we add ELD integration, display driver HOS from connected ELDs. 2) Validate appointment times against available drive hours when booking. 3) Flag loads where HOS may be tight (long distance + tight timeline). 4) More relevant for asset-based carriers than pure brokers. 5) Consider adding if we get carrier customers who want this visibility.' },
      { id: 'insurance-compliance', name: 'Insurance compliance', description: 'Verify carriers have required insurance coverage ($750K-$1M liability, cargo insurance) and track expiration dates', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod integrates with Rmis and MyCarrierPackets for automated certificate collection and verification. Trimble parses insurance certificates with AI to extract coverage amounts. We track expirations; should add auto-verification.', actionItems: '1) Integrate with insurance verification services (Rmis, Highway, MyCarrierPackets) for auto-verification. 2) Use AI/OCR to extract coverage amounts from uploaded certificates. 3) Support multiple insurance types: auto liability, cargo, general liability, workers comp. 4) Track "additional insured" status - is broker listed on policy? 5) Set minimum requirements by customer or load type. 6) Alert and block when insurance is expired or below minimums.' },
      { id: 'carrier-safety', name: 'Carrier safety scores', description: 'View carrier safety ratings from FMCSA - crash rates, inspections, out-of-service percentages', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'DAT CarrierWatch predicts carrier failure risk using AI beyond basic FMCSA scores. MercuryGate shows safety trends over time. Trimble integrates safety with insurance requirements. Our scores are basic; consider CarrierWatch-style predictions.', actionItems: '1) Display FMCSA safety scores: crash rate, inspection results, out-of-service %. 2) Show safety score trends over time - is this carrier getting safer or riskier? 3) Consider DAT CarrierWatch API integration for predictive risk scores. 4) Integrate safety into carrier scoring for recommendations. 5) Support safety-based blocking (e.g., don\'t use carriers with Conditional safety rating). 6) Alert when safety scores deteriorate significantly.' },
      { id: 'drug-test', name: 'Drug test tracking', description: 'Track driver drug testing compliance for asset-based carriers - required for drivers under DOT regulations', mcleod: true, trimble: true, mercurygate: 'partial', descartes: 'partial', dat: false, expertly: false, competitorAdvantages: 'Trimble tracks random drug test scheduling and results for fleets. McLeod integrates with drug testing consortiums. Primarily relevant for asset-based carriers with their own drivers, not pure brokers.', actionItems: 'DEPRIORITIZE for pure brokerage: 1) This is primarily for asset-based carriers with their own drivers. 2) Brokers use carriers who manage their own driver compliance. 3) Only consider adding if we get significant asset-carrier customers. 4) If needed: track drug test due dates, results, clearinghouse status.' },
      { id: 'audit-trail', name: 'Audit trail/history logging', description: 'Track all changes to records - who changed what, when - for compliance and dispute resolution', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod has immutable audit logs that satisfy SOC2 and financial audit requirements. MercuryGate timestamps and user-tracks every field change. Trimble supports audit exports for external review. Our audit trail is functional.', actionItems: '1) Ensure immutable audit logs - changes cannot be deleted or modified. 2) Track field-level changes with before/after values. 3) Record user, timestamp, and IP address for all changes. 4) Support audit export for compliance reviews (SOC2, customer audits). 5) Add audit search: find all changes to a record, all changes by a user. 6) Consider audit retention policy (how long to keep logs).' },
      { id: 'ifta', name: 'IFTA reporting', description: 'Generate International Fuel Tax Agreement reports - required quarterly tax filing for carriers operating in multiple states', mcleod: true, trimble: true, mercurygate: 'partial', descartes: 'partial', dat: false, expertly: false, competitorAdvantages: 'Trimble calculates IFTA from ELD mileage automatically. McLeod tracks fuel purchases by state for IFTA calculation. Relevant only for asset-based carriers, not brokers - carriers file their own IFTA.', actionItems: 'DEPRIORITIZE for pure brokerage: 1) IFTA is filed by carriers, not brokers. 2) Brokers don\'t own trucks or buy fuel, so no IFTA obligation. 3) Only relevant if we add asset-carrier features. 4) Not a priority for current broker-focused roadmap.' },
    ],
  },
  {
    id: 'mobile-accessibility',
    name: 'Mobile & Accessibility',
    icon: Smartphone,
    features: [
      { id: 'mobile-driver', name: 'Mobile driver app', description: 'App for truck drivers to receive dispatch info, navigate, capture PODs, and communicate with dispatch', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'Trimble driver app has GPS navigation, ELD integration, and document scanning built-in. MercuryGate app used by 100K+ drivers with real-time load tracking. Primarily for asset-based carriers; brokers use Trucker Tools for carrier drivers.', actionItems: 'CONSIDER web-based approach: 1) For brokers, integrate Trucker Tools or similar rather than building driver app. 2) If building: web-based PWA works on any device without app store. 3) Core features: view load details, navigate to pickup/delivery, capture POD with signature. 4) Add photo capture for freight condition documentation. 5) Support location sharing for tracking (with driver consent). 6) Consider React Native if native app is needed for performance. TIMELINE: Q4+, evaluate build vs. integrate decision.' },
      { id: 'mobile-broker', name: 'Mobile broker app', description: 'App for brokers/dispatchers to manage loads, track shipments, and communicate when away from desk', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: true, expertly: 'planned', competitorAdvantages: 'MercuryGate broker app has full tender, tracking, and document capabilities. DAT app integrated with load board. Trimble shows real-time KPIs on mobile. Modern brokers expect mobile access - medium priority.', actionItems: 'MEDIUM PRIORITY: 1) Start with responsive web - our current design works on mobile. 2) Core mobile features: view loads, check tracking, respond to tenders, approve quotes. 3) Add push notifications for critical events (tender accepted, load delivered). 4) Consider PWA for app-like experience without app store. 5) If native app needed: React Native or Flutter for cross-platform. 6) Focus on high-value quick actions, not full desktop feature parity. TIMELINE: Q3-Q4, after core features stable.' },
      { id: 'responsive-web', name: 'Responsive web design', description: 'Website that works well on phones and tablets, not just desktop computers', mcleod: 'partial', trimble: 'partial', mercurygate: true, descartes: 'partial', dat: true, expertly: true, competitorAdvantages: 'MercuryGate is fully responsive with touch-optimized interface. Legacy systems (McLeod, Trimble) have partial mobile support. We\'re actually ahead here with modern web design - competitive advantage.', actionItems: 'COMPETITIVE ADVANTAGE - MAINTAIN: 1) Continue mobile-first design approach for new features. 2) Optimize touch targets for tablet/phone use. 3) Test all features on mobile devices during development. 4) Ensure critical workflows work well on mobile: view loads, tracking, approvals. 5) Consider mobile-specific UI optimizations (bottom navigation, swipe actions). 6) This is an advantage over legacy competitors - promote it in marketing.' },
      { id: 'ios-app', name: 'iOS app', description: 'Native iPhone app for better performance and user experience than mobile web', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: true, expertly: 'planned', competitorAdvantages: 'Trimble and MercuryGate have polished iOS apps with full functionality. DAT app has 4.7★ rating. Native apps provide better experience; should be part of mobile strategy.', actionItems: '1) Evaluate PWA first - may provide sufficient native-like experience. 2) If native needed: use React Native or Flutter for cross-platform (iOS + Android together). 3) Core features for iOS: load dashboard, tracking map, push notifications, quick actions. 4) Support biometric login (Face ID, Touch ID). 5) Target App Store listing with good screenshots and description. 6) Plan for ongoing maintenance (iOS updates, App Store compliance). TIMELINE: Q4+, after web mobile experience is solid.' },
      { id: 'android-app', name: 'Android app', description: 'Native Android app - important since many trucking professionals use Android devices', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: true, expertly: 'planned', competitorAdvantages: 'Same as iOS - Trimble and MercuryGate have strong Android apps. Trucking industry has high Android usage among drivers. Consider cross-platform development (React Native, Flutter).', actionItems: '1) Build alongside iOS using cross-platform framework (React Native/Flutter). 2) Android is important in trucking industry - high usage among drivers. 3) Same features as iOS: dashboard, tracking, notifications, quick actions. 4) Test on variety of Android devices (different screen sizes, OS versions). 5) Plan for Google Play Store listing. 6) Consider that carriers/drivers often use older/cheaper Android devices. TIMELINE: Same as iOS, build together for efficiency.' },
      { id: 'offline', name: 'Offline capability', description: 'Work without internet connection - important for drivers in areas with poor cell coverage', mcleod: false, trimble: 'partial', mercurygate: 'partial', descartes: false, dat: false, expertly: false, competitorAdvantages: 'Trimble driver app caches loads and allows offline POD capture. MercuryGate syncs when connection returns. Less relevant for office-based brokers who always have internet. Low priority for brokerage use case.', actionItems: 'LOWER PRIORITY for brokers: 1) Brokers work from offices with reliable internet - less need for offline. 2) For driver-facing features: cache load details for offline viewing. 3) Support offline POD capture that syncs when connection returns. 4) PWA service workers can provide basic offline capability. 5) Focus on good low-bandwidth experience rather than full offline. 6) Not a priority for initial mobile app development.' },
      { id: 'push-notifications', name: 'Push notifications', description: 'Instant alerts on phone for important events - load accepted, delivery complete, shipment at risk', mcleod: 'addon', trimble: true, mercurygate: true, descartes: 'addon', dat: true, expertly: 'planned', competitorAdvantages: 'MercuryGate has configurable notification rules per user role. Trimble sends critical alerts immediately, batches non-urgent. DAT notifies when matching loads posted. Part of mobile app strategy.', actionItems: '1) Build notification infrastructure (Firebase Cloud Messaging for cross-platform). 2) Configurable notification rules: which events, which users, what priority. 3) Critical events for immediate notification: tender accepted/declined, delivery complete, shipment at risk. 4) Batch non-urgent notifications to avoid alert fatigue. 5) Support notification preferences per user. 6) Web push notifications as first step (no app required). TIMELINE: Part of mobile app work Q3-Q4.' },
    ],
  },
  {
    id: 'ai-automation',
    name: 'AI & Automation',
    icon: Sparkles,
    features: [
      { id: 'ai-email-parsing', name: 'AI email parsing', description: 'Use AI to automatically extract shipment details from customer emails', mcleod: false, trimble: false, mercurygate: 'partial', descartes: false, dat: false, expertly: true, competitorAdvantages: 'MercuryGate has basic rules-based parsing. Our LLM-based approach is more flexible and accurate. MAINTAIN LEADERSHIP.', actionItems: 'PROTECT AND EXTEND: 1) Improve extraction accuracy to 95%+ on common fields. 2) Add support for: PDF attachments, Excel rate sheets, image-based documents. 3) Build feedback loop: when user corrects extraction, learn from it. 4) Publish extraction accuracy metrics to build trust. 5) Add multi-language support (Spanish, French). 6) Handle forwarded email chains and reply threads. This is our core differentiator - invest heavily.' },
      { id: 'ai-carrier-suggestions', name: 'AI carrier suggestions', description: 'AI recommends best carriers for each load based on performance, pricing, and availability', mcleod: false, trimble: false, mercurygate: 'partial', descartes: false, dat: 'partial', expertly: true, competitorAdvantages: 'DAT suggests carriers based on load board history. MercuryGate uses historical data. Ours uses lane history + real-time factors.', actionItems: 'EXTEND our advantage: 1) Factor in: lane history, on-time %, current location (if available), recent tender accept rate. 2) Show "why" behind recommendation: "Carrier X suggested because 98% on-time on this lane, $50 below avg rate". 3) Learn from dispatcher override: if they pick a different carrier, track outcomes. 4) Add market rate context from DAT when available. 5) Build recommendation accuracy tracking.' },
      { id: 'ai-communications', name: 'AI-drafted communications', description: 'AI writes professional emails and messages to customers and carriers', mcleod: false, trimble: false, mercurygate: false, descartes: false, dat: false, expertly: true, competitorAdvantages: 'NO competitor offers this. Unique differentiator - continue developing.', actionItems: 'UNIQUE DIFFERENTIATOR - PROTECT: 1) Expand communication types: quote responses, status updates, delay notifications, invoice reminders, carrier tenders. 2) Learn customer/carrier communication preferences over time. 3) Add tone options: professional, friendly, urgent. 4) Support one-click approval and send. 5) Build communication templates library users can customize. 6) Track communication effectiveness (response rates). NO competitor has this - major advantage.' },
      { id: 'predictive-analytics', name: 'Predictive analytics', description: 'Use data patterns to predict future outcomes - late deliveries, capacity shortages, price changes', mcleod: false, trimble: 'partial', mercurygate: 'partial', descartes: false, dat: 'partial', expertly: 'planned', competitorAdvantages: 'Trimble predicts delivery times. MercuryGate forecasts capacity constraints. DAT predicts rate trends. Opportunity to leapfrog.', actionItems: 'OPPORTUNITY TO LEAPFROG: 1) Predict late deliveries 6+ hours early using location + traffic + historical patterns. 2) Forecast rate trends by lane using historical data. 3) Predict carrier capacity constraints based on patterns. 4) Identify customers likely to churn based on activity patterns. 5) Show confidence intervals on predictions. 6) Use Claude/LLM for pattern analysis humans might miss. TIMELINE: Q3-Q4, differentiating capability.' },
      { id: 'ml-optimization', name: 'Machine learning optimization', description: 'Use ML to optimize routing, carrier selection, and pricing automatically', mcleod: false, trimble: 'partial', mercurygate: 'partial', descartes: false, dat: false, expertly: 'planned', competitorAdvantages: 'Trimble uses ML for route optimization. MercuryGate optimizes carrier selection. Advanced use cases.', actionItems: 'Advanced capability: 1) ML-optimized carrier selection: learn which carriers perform best on which lanes. 2) Dynamic pricing suggestions based on market conditions. 3) Route optimization considering traffic patterns by time of day. 4) Load consolidation optimization. Build incrementally as we gather data. TIMELINE: Q4+, requires operational data.' },
      { id: 'nlp', name: 'Natural language processing', description: 'AI understands natural language in emails and can extract meaning, not just keywords', mcleod: false, trimble: false, mercurygate: false, descartes: false, dat: false, expertly: true, competitorAdvantages: 'NO competitor uses NLP. Our AI understands context and intent from emails. Huge advantage.', actionItems: 'CORE CAPABILITY - PROTECT: 1) This powers our email extraction - maintain and improve. 2) Understand context: "same as last time" means repeat previous shipment. 3) Handle ambiguity: ask for clarification when intent unclear. 4) Detect urgency and priority from language. 5) Identify new customer inquiries vs. existing order updates. 6) Extract action items from email threads. Major competitive advantage.' },
      { id: 'chatbot', name: 'Chatbot/virtual assistant', description: 'AI assistant that answers questions and helps complete tasks through conversation', mcleod: false, trimble: false, mercurygate: false, descartes: false, dat: false, expertly: 'planned', competitorAdvantages: 'No competitor has an AI assistant. Opportunity to create industry-first conversational TMS interface.', actionItems: 'INDUSTRY FIRST OPPORTUNITY: 1) Build conversational interface: "Show me all loads picking up tomorrow in Chicago". 2) Support common tasks: "Create a quote for ABC Corp, Chicago to Dallas, dry van". 3) Answer questions: "What\'s the status of load 12345?". 4) Use Claude as the AI backbone. 5) Start with internal tool, expand to customer/carrier facing. 6) Could be major differentiator. TIMELINE: Q4+, ambitious but high-value.' },
      { id: 'auto-assign', name: 'Auto-assign loads', description: 'Automatically match loads to carriers based on rules and AI optimization', mcleod: 'partial', trimble: 'partial', mercurygate: true, descartes: 'partial', dat: false, expertly: 'planned', competitorAdvantages: 'MercuryGate has sophisticated auto-assignment based on carrier preferences, capacity, and cost. Rules-based but effective.', actionItems: '1) Build auto-assignment rules: if load matches carrier lane preference, auto-tender. 2) Support thresholds: auto-assign if rate is within X% of target. 3) Integrate with waterfall: auto-assign is first step, then waterfall to others. 4) Allow per-customer auto-assign rules. 5) Track auto-assignment success rate. 6) Use AI to improve assignment over time. TIMELINE: Part of Q2-Q3 waterfall work.' },
      { id: 'smart-exception', name: 'Smart exception detection', description: 'AI proactively identifies shipments that are at risk of problems', mcleod: 'partial', trimble: 'partial', mercurygate: true, descartes: 'partial', dat: false, expertly: true, competitorAdvantages: 'MercuryGate flags at-risk shipments proactively. We do this well with AI-enhanced detection.', actionItems: 'We do this well - EXTEND: 1) Add more exception types: carrier didn\'t confirm, no pickup update, tracking went dark. 2) Predict exceptions before they happen using ML. 3) Auto-escalate critical exceptions to managers. 4) Send proactive customer notifications for at-risk loads. 5) Track exception resolution time and outcomes. 6) Learn which exceptions lead to real problems vs. false alarms.' },
    ],
  },
  {
    id: 'platform-support',
    name: 'Platform & Support',
    icon: Server,
    features: [
      { id: 'cloud-saas', name: 'Cloud-based (SaaS)', description: 'Software runs in the cloud - access from anywhere with just a web browser, no installation needed', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'MercuryGate has been cloud-native from the start with excellent uptime (99.9%+). Trimble and McLeod have migrated to cloud from legacy on-premise roots. Our cloud architecture is modern and scalable - competitive advantage.', actionItems: 'COMPETITIVE ADVANTAGE - MAINTAIN: 1) Continue cloud-native architecture - no legacy on-premise baggage. 2) Target 99.9%+ uptime with proper monitoring and alerting. 3) Auto-scaling for load spikes (month-end, seasonal peaks). 4) Multi-region deployment for redundancy when justified. 5) SOC2 compliance for enterprise customers. 6) Promote cloud-native benefits in marketing vs. legacy competitors.' },
      { id: 'on-premise', name: 'On-premise option', description: 'Install software on your own servers - required by some companies with strict data security requirements', mcleod: true, trimble: true, mercurygate: false, descartes: true, dat: false, expertly: false, competitorAdvantages: 'McLeod and Trimble still offer on-premise for large enterprises with strict security requirements. Descartes offers hybrid options. We\'re cloud-only which is fine for modern brokers - not a priority to change.', actionItems: 'NOT A PRIORITY: 1) Cloud-only is the modern approach - MercuryGate doesn\'t offer on-premise either. 2) On-premise adds significant complexity and support burden. 3) Focus on cloud security (SOC2, encryption, access controls) to satisfy enterprise concerns. 4) Only reconsider if large enterprise customer requires it and contract justifies investment. 5) Better to invest in cloud security features than on-premise deployment.' },
      { id: 'multi-tenant', name: 'Multi-tenant', description: 'Multiple companies share the same system securely - reduces costs, automatic updates, always on latest version', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'All modern TMS are multi-tenant. MercuryGate has sophisticated tenant isolation for enterprise security. We\'re fully multi-tenant with good data separation.', actionItems: 'MAINTAIN: 1) Continue strong tenant isolation - no data leakage between customers. 2) Database-level isolation for enterprise customers if needed. 3) Audit tenant separation regularly. 4) Document tenant isolation for enterprise security reviews. 5) Consider tenant-specific customization options (branding, fields). 6) Multi-tenancy is standard - focus on doing it well.' },
      { id: 'white-label', name: 'White-label option', description: 'Rebrand the software with your company logo and colors - used by 3PLs who resell to their customers', mcleod: 'addon', trimble: 'addon', mercurygate: 'addon', descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'MercuryGate offers deep white-labeling with custom domains. McLeod allows complete rebranding for enterprise customers. Trimble white-labels customer portals. Needed for 3PLs who want to look like they have their own TMS.', actionItems: '1) Support logo and color customization at tenant level. 2) Custom domain support for customer/carrier portals (e.g., tracking.yourcompany.com). 3) Remove Expertly branding option for enterprise customers. 4) Customizable email templates with customer branding. 5) White-label customer tracking portal first (highest visibility). 6) Consider white-labeling as premium/enterprise feature. TIMELINE: Q3-Q4, needed for 3PLs and larger brokers.' },
      { id: '24-7-support', name: '24/7 support', description: 'Get help any time - important since trucking operates around the clock including nights and weekends', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: false, expertly: 'planned', competitorAdvantages: 'MercuryGate includes 24/7 support with live humans, not just voicemail. McLeod and Trimble charge premium for 24/7. Trucking is 24/7 business - dispatchers work nights and weekends. Important for customer satisfaction.', actionItems: '1) Start with extended hours support: 6am-10pm coverage. 2) Build self-service help resources (knowledge base, videos) for after-hours. 3) Consider on-call rotation for critical issues as customer base grows. 4) Partner with support service for 24/7 coverage when scale justifies. 5) Trucking is 24/7 - this is important for customer satisfaction. TIMELINE: Phase in as customer base grows; not needed initially.' },
      { id: 'phone-support', name: 'Phone support', description: 'Call and talk to a real person for help', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod is known for excellent phone support with industry-experienced staff. MercuryGate has US-based support team. Trimble support understands complex enterprise issues. We offer phone support - should ensure quality.', actionItems: '1) Ensure support staff understand trucking industry (terminology, workflows). 2) Track phone support metrics: answer time, resolution rate, satisfaction. 3) Build internal knowledge base for support team. 4) Record calls for quality and training (with consent). 5) Escalation path for complex issues to product/engineering. 6) Quality phone support builds loyalty - invest in training.' },
      { id: 'email-support', name: 'Email support', description: 'Send support requests via email for non-urgent issues or detailed questions', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'All competitors offer email support with varying response times (4-24 hours typical). MercuryGate has ticketing system with SLA tracking. Standard feature.', actionItems: '1) Use ticketing system to track all email support requests. 2) Set SLA targets: acknowledge within 1 hour, resolve within 24 hours. 3) Auto-respond confirming ticket received with expected response time. 4) Categorize tickets for routing and reporting. 5) Track resolution time and customer satisfaction. 6) Build canned responses for common questions to improve efficiency.' },
      { id: 'chat-support', name: 'Chat support', description: 'Instant messaging with support team - faster than email, more convenient than phone', mcleod: 'partial', trimble: 'partial', mercurygate: true, descartes: 'partial', dat: true, expertly: true, competitorAdvantages: 'MercuryGate has live chat integrated into the application. DAT chat is responsive. Legacy systems have limited chat. We offer chat - modern approach that users prefer.', actionItems: 'COMPETITIVE ADVANTAGE - MAINTAIN: 1) Keep in-app chat prominent and easy to access. 2) Fast response time - target <2 minutes during business hours. 3) Support chat-to-ticket escalation for complex issues. 4) Consider AI chatbot for common questions (after-hours, first-line). 5) Save chat history for context on follow-up questions. 6) Modern users prefer chat - this is an advantage over legacy competitors.' },
      { id: 'implementation', name: 'Implementation support', description: 'Help getting set up - data migration, configuration, initial training during onboarding', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: 'partial', expertly: true, competitorAdvantages: 'McLeod and Trimble charge $25K-$200K for implementation with dedicated project managers. MercuryGate includes basic implementation. Our free implementation is a major differentiator - customers love this.', actionItems: 'COMPETITIVE ADVANTAGE - PROTECT: 1) Continue free implementation - major differentiator vs. $25K-$200K competitors charge. 2) Build onboarding checklist and guided setup flow. 3) Support data migration from common TMS (CSV import at minimum). 4) Offer implementation calls to walk through setup. 5) Track time-to-value: how quickly are customers operational? 6) Promote free implementation heavily in sales process.' },
      { id: 'training', name: 'Training included', description: 'Learn how to use the system - webinars, documentation, hands-on training sessions', mcleod: 'addon', trimble: 'addon', mercurygate: true, descartes: 'addon', dat: 'partial', expertly: true, competitorAdvantages: 'McLeod charges $1K-5K per person for training. Trimble has extensive certification programs. MercuryGate includes training. Our included training is valuable - keep emphasizing this.', actionItems: 'COMPETITIVE ADVANTAGE - PROTECT: 1) Continue free training - competitors charge $1K-5K per person. 2) Build self-service training: video tutorials, interactive guides. 3) Offer live webinars for new customers (weekly or on-demand). 4) Create role-based training paths: dispatcher, accounting, manager. 5) Track training completion and correlate with user success. 6) Promote included training in sales process.' },
      { id: 'knowledge-base', name: 'Knowledge base/documentation', description: 'Self-service help articles and how-to guides for common questions', mcleod: true, trimble: true, mercurygate: true, descartes: true, dat: true, expertly: true, competitorAdvantages: 'McLeod has comprehensive documentation built over 35 years. MercuryGate has searchable knowledge base with video tutorials. We need to build out documentation as we grow.', actionItems: '1) Build searchable knowledge base with articles for all features. 2) Add video tutorials for complex workflows. 3) Include troubleshooting guides for common issues. 4) Update documentation as features change. 5) Track which articles are most viewed to prioritize improvements. 6) Allow users to rate articles and suggest improvements. 7) Documentation reduces support load - invest continuously.' },
      { id: 'community', name: 'User community/forum', description: 'Connect with other users to share tips, best practices, and get peer support', mcleod: true, trimble: true, mercurygate: 'partial', descartes: 'partial', dat: true, expertly: 'planned', competitorAdvantages: 'McLeod has annual user conference with 1,000+ attendees. Trimble has active user groups. DAT has large community from load board users. Community builds loyalty and reduces support burden. Should build as we grow.', actionItems: '1) Start with simple community: Slack channel or Discord for customers. 2) Share tips, best practices, and product updates. 3) Enable peer support - users helping users. 4) Gather feature requests and feedback from community. 5) Consider annual user conference/meetup when scale justifies. 6) Community builds loyalty and reduces support burden. TIMELINE: Start simple in Q3, grow organically.' },
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
  { platform: 'Expertly TMS', model: 'Per-user, monthly', starting: '$100/user/mo', implementation: 'Free', notes: 'No contracts, cancel anytime', highlight: true },
]

// ========================================
// Main Component
// ========================================

export default function ProductComparison() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

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
            <div className="ml-6 pl-6 border-l border-gray-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showNotes}
                  onChange={(e) => setShowNotes(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  aria-label="Show Notes"
                />
                <span className="text-sm font-medium text-gray-700">Show Notes</span>
              </label>
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
                <table className={`w-full ${showNotes ? 'min-w-[1200px]' : 'min-w-[900px]'}`}>
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left py-4 px-4 font-semibold text-gray-900 w-64">Feature</th>
                      <th className="text-center py-4 px-3 font-semibold text-gray-700 w-24">McLeod</th>
                      <th className="text-center py-4 px-3 font-semibold text-gray-700 w-24">Trimble</th>
                      <th className="text-center py-4 px-3 font-semibold text-gray-700 w-24">MercuryGate</th>
                      <th className="text-center py-4 px-3 font-semibold text-gray-700 w-24">Aljex</th>
                      <th className="text-center py-4 px-3 font-semibold text-gray-700 w-24">DAT</th>
                      <th className="text-center py-4 px-3 font-bold text-emerald-700 bg-emerald-50 w-24">Expertly</th>
                      {showNotes && (
                        <th className="text-left py-4 px-4 font-semibold text-gray-900 min-w-[300px]">Notes</th>
                      )}
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
                        {showNotes && (
                          <td className="py-3 px-4 text-sm">
                            {feature.competitorAdvantages && (
                              <div className="mb-2">
                                <span className="font-medium text-gray-700">Competitor Advantages: </span>
                                <span className="text-gray-600">{feature.competitorAdvantages}</span>
                              </div>
                            )}
                            {feature.actionItems && (
                              <div className="bg-emerald-50 border border-emerald-200 rounded p-2 mt-1">
                                <span className="font-medium text-emerald-700">Our Action Plan: </span>
                                <span className="text-emerald-800">{feature.actionItems}</span>
                              </div>
                            )}
                            {!feature.competitorAdvantages && !feature.actionItems && '-'}
                          </td>
                        )}
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
