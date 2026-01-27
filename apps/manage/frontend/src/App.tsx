import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Queues from './pages/Queues'
import Playbooks from './pages/Playbooks'
import Users from './pages/Users'
import Teams from './pages/Teams'
import RecurringTasks from './pages/RecurringTasks'
import LandingPage from './pages/LandingPage'
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
          <Route path="playbooks" element={<Playbooks />} />
          <Route path="users" element={<Users />} />
          <Route path="teams" element={<Teams />} />
          <Route path="recurring" element={<RecurringTasks />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
