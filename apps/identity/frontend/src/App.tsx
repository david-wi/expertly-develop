import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import UsersPage from './pages/UsersPage'
import UserProfilePage from './pages/UserProfilePage'
import TeamsPage from './pages/TeamsPage'
import OrganizationsPage from './pages/OrganizationsPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import MagicCodePage from './pages/MagicCodePage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import ProfilePage from './pages/ProfilePage'

export default function App() {
  return (
    <Routes>
      {/* Public routes (no layout) */}
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/magic-code" element={<MagicCodePage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* App routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/users" replace />} />
        <Route path="users" element={<UsersPage defaultFilter="all" />} />
        <Route path="users/:userId" element={<UserProfilePage />} />
        <Route path="bots" element={<Navigate to="/users" replace />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="change-password" element={<ChangePasswordPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Routes>
  )
}
