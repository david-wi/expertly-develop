import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import UsersPage from './pages/UsersPage'
import TeamsPage from './pages/TeamsPage'
import OrganizationsPage from './pages/OrganizationsPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'

export default function App() {
  return (
    <Routes>
      {/* Public routes (no layout) */}
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* App routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/users" replace />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="organizations" element={<OrganizationsPage />} />
      </Route>
    </Routes>
  )
}
