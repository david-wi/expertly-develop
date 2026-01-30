import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import JobQueuePage from './pages/JobQueuePage'
import JobDetailPage from './pages/JobDetailPage'
import ArtifactsPage from './pages/ArtifactsPage'
import WalkthroughPage from './pages/WalkthroughPage'
import LandingPage from './pages/LandingPage'
import Changelog from './pages/Changelog'

function App() {
  return (
    <Routes>
      {/* Public landing page (no layout) */}
      <Route path="/landing" element={<LandingPage />} />

      {/* Authenticated app routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="jobs" element={<JobQueuePage />} />
        <Route path="jobs/:id" element={<JobDetailPage />} />
        <Route path="artifacts" element={<ArtifactsPage />} />
        <Route path="walkthroughs/new" element={<WalkthroughPage />} />
        <Route path="changelog" element={<Changelog />} />
      </Route>
    </Routes>
  )
}

export default App
