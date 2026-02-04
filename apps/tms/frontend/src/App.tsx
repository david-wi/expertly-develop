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
import MarginDashboard from './pages/MarginDashboard'
import CarrierPerformance from './pages/CarrierPerformance'
import LandingPage from './pages/LandingPage'
import ProductComparison from './pages/ProductComparison'
import Layout from './components/layout/Layout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="quote-requests" element={<QuoteRequests />} />
          <Route path="quotes/:id" element={<QuoteBuilder />} />
          <Route path="shipments" element={<Shipments />} />
          <Route path="shipments/:id" element={<ShipmentDetail />} />
          <Route path="dispatch" element={<DispatchBoard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="carriers" element={<Carriers />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="margins" element={<MarginDashboard />} />
          <Route path="carrier-performance" element={<CarrierPerformance />} />
          <Route path="settings" element={<Settings />} />
          <Route path="compare" element={<ProductComparison />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
