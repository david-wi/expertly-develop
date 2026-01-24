import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import JobQueuePage from './pages/JobQueuePage'
import ArtifactsPage from './pages/ArtifactsPage'
import WalkthroughPage from './pages/WalkthroughPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="jobs" element={<JobQueuePage />} />
        <Route path="artifacts" element={<ArtifactsPage />} />
        <Route path="walkthroughs/new" element={<WalkthroughPage />} />
      </Route>
    </Routes>
  )
}

export default App
