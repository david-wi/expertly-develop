import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import QuickStart from './pages/QuickStart'
import TestRun from './pages/TestRun'
import EnvironmentSetup from './pages/EnvironmentSetup'
import Login from './pages/Login'
import Register from './pages/Register'
import LandingPage from './pages/LandingPage'

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <Layout>
                <Projects />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId"
          element={
            <ProtectedRoute>
              <Layout>
                <ProjectDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/runs/:runId"
          element={
            <ProtectedRoute>
              <Layout>
                <TestRun />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/environments"
          element={
            <ProtectedRoute>
              <Layout>
                <EnvironmentSetup />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quick-start"
          element={
            <ProtectedRoute>
              <Layout>
                <QuickStart />
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  )
}

export default App
