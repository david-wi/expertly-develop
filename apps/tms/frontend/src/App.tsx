import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Inbox from './pages/Inbox'
import QuoteRequests from './pages/QuoteRequests'
import QuoteBuilder from './pages/QuoteBuilder'
import Shipments from './pages/Shipments'
import ShipmentDetail from './pages/ShipmentDetail'
import DispatchBoard from './pages/DispatchBoard'
import Customers from './pages/Customers'
import Carriers from './pages/Carriers'
import Invoices from './pages/Invoices'
import Settings from './pages/Settings'
import DeskManagement from './pages/DeskManagement'
import MarginDashboard from './pages/MarginDashboard'
import CarrierPerformance from './pages/CarrierPerformance'
import DocumentReview from './pages/DocumentReview'
import LoadBoards from './pages/LoadBoards'
import LandingPage from './pages/LandingPage'
import ProductComparison from './pages/ProductComparison'
import TrackingPortal from './pages/TrackingPortal'
import ApprovalCenter from './pages/ApprovalCenter'
import OperationsMetrics from './pages/OperationsMetrics'
import LaneIntelligence from './pages/LaneIntelligence'
import AutomationBuilder from './pages/AutomationBuilder'
import CustomerDetail from './pages/CustomerDetail'
import CarrierDetail from './pages/CarrierDetail'
import DocumentInbox from './pages/DocumentInbox'
import BillingQueue from './pages/BillingQueue'
import EDIManager from './pages/EDIManager'
import RateManagement from './pages/RateManagement'
import Communications from './pages/Communications'
import RoleManagement from './pages/RoleManagement'
import DriverLogin from './pages/DriverLogin'
import DriverApp from './pages/DriverApp'
import DriverLoadDetail from './pages/DriverLoadDetail'
import GlobalSearch from './pages/GlobalSearch'
import Layout from './components/layout/Layout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public tracking portal (no auth required) */}
        <Route path="/track/:token" element={<TrackingPortal />} />
        <Route path="/landing" element={<LandingPage />} />
        {/* Driver mobile app (separate layout, no sidebar) */}
        <Route path="/driver/login" element={<DriverLogin />} />
        <Route path="/driver" element={<DriverApp />} />
        <Route path="/driver/load/:id" element={<DriverLoadDetail />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="quote-requests" element={<QuoteRequests />} />
          <Route path="quotes/:id" element={<QuoteBuilder />} />
          <Route path="shipments" element={<Shipments />} />
          <Route path="shipments/:id" element={<ShipmentDetail />} />
          <Route path="dispatch" element={<DispatchBoard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="carriers" element={<Carriers />} />
          <Route path="carriers/:id" element={<CarrierDetail />} />
          <Route path="document-inbox" element={<DocumentInbox />} />
          <Route path="billing" element={<BillingQueue />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="margins" element={<MarginDashboard />} />
          <Route path="carrier-performance" element={<CarrierPerformance />} />
          <Route path="document-review" element={<DocumentReview />} />
          <Route path="loadboards" element={<LoadBoards />} />
          <Route path="settings" element={<Settings />} />
          <Route path="desks" element={<DeskManagement />} />
          <Route path="approvals" element={<ApprovalCenter />} />
          <Route path="operations-metrics" element={<OperationsMetrics />} />
          <Route path="lane-intelligence" element={<LaneIntelligence />} />
          <Route path="automations" element={<AutomationBuilder />} />
          <Route path="edi" element={<EDIManager />} />
          <Route path="rate-tables" element={<RateManagement />} />
          <Route path="communications" element={<Communications />} />
          <Route path="roles" element={<RoleManagement />} />
          <Route path="search" element={<GlobalSearch />} />
          <Route path="compare" element={<ProductComparison />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
