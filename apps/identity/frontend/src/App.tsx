import { Routes, Route, Navigate, Link } from 'react-router-dom'
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
import Changelog from './pages/Changelog'
import InvitePage from './pages/InvitePage'

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-8">Page not found</p>
        <Link
          to="/"
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Public routes (no layout) */}
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/magic-code" element={<MagicCodePage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/invite" element={<InvitePage />} />

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
        <Route path="changelog" element={<Changelog />} />
      </Route>

      {/* 404 catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
