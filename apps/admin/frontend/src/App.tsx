import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { Themes } from './pages/Themes'
import { ThemeDetail } from './pages/ThemeDetail'
import { ThemeCreate } from './pages/ThemeCreate'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/themes" element={<Themes />} />
          <Route path="/themes/new" element={<ThemeCreate />} />
          <Route path="/themes/:id" element={<ThemeDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
