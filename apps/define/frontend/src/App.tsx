import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import RequirementDetail from './pages/RequirementDetail'
import Releases from './pages/Releases'
import ReleaseDetail from './pages/ReleaseDetail'
import Changelog from './pages/Changelog'
import LandingPage from './pages/LandingPage'

function App() {
  return (
    <Routes>
      <Route path="/landing" element={<LandingPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/products/:id/artifacts" element={<ProductDetail />} />
        <Route path="/requirements/:id" element={<RequirementDetail />} />
        <Route path="/releases" element={<Releases />} />
        <Route path="/releases/:id" element={<ReleaseDetail />} />
        <Route path="/changelog" element={<Changelog />} />
      </Route>
    </Routes>
  )
}

export default App
