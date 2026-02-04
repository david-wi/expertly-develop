import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Queues from './pages/Queues'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Playbooks from './pages/Playbooks'
import Users from './pages/Users'
import Teams from './pages/Teams'
import RecurringTasks from './pages/RecurringTasks'
import Wins from './pages/Wins'
import Backlog from './pages/Backlog'
import IdeaBacklog from './pages/IdeaBacklog'
import Connections from './pages/Connections'
import Changelog from './pages/Changelog'
import LandingPage from './pages/LandingPage'
import Monitors from './pages/Monitors'
import Bots from './pages/Bots'
import Notifications from './pages/Notifications'
import Expertise from './pages/Expertise'
import Layout from './components/Layout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="queues" element={<Queues />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="playbooks" element={<Playbooks />} />
          <Route path="expertise" element={<Expertise />} />
          <Route path="users" element={<Users />} />
          <Route path="teams" element={<Teams />} />
          <Route path="recurring" element={<RecurringTasks />} />
          <Route path="monitors" element={<Monitors />} />
          <Route path="bots" element={<Bots />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="wins" element={<Wins />} />
          <Route path="backlog" element={<Backlog />} />
          <Route path="idea-backlog" element={<IdeaBacklog />} />
          <Route path="connections" element={<Connections />} />
          <Route path="changelog" element={<Changelog />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
