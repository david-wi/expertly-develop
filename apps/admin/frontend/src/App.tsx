import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { Themes } from './pages/Themes'
import { ThemeDetail } from './pages/ThemeDetail'
import { ThemeCreate } from './pages/ThemeCreate'
import { Monitoring } from './pages/Monitoring'
import { Monitor } from './pages/Monitor'
import { ErrorLogs } from './pages/ErrorLogs'
import { AIConfig } from './pages/AIConfig'
import LandingPage from './pages/LandingPage'
import { Changelog } from './pages/Changelog'
import { TestScenarios } from './pages/TestScenarios'
import { KnownIssues } from './pages/KnownIssues'

function App() {
  return (
    <Routes>
      {/* Public landing page (no layout) */}
      <Route path="/landing" element={<LandingPage />} />

      {/* App routes */}
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/themes" element={<Themes />} />
        <Route path="/themes/new" element={<ThemeCreate />} />
        <Route path="/themes/:id" element={<ThemeDetail />} />
        <Route path="/error-logs" element={<ErrorLogs />} />
        <Route path="/known-issues" element={<KnownIssues />} />
        <Route path="/test-scenarios" element={<TestScenarios />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="/monitor" element={<Monitor />} />
        <Route path="/ai-config" element={<AIConfig />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
