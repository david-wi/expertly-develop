import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { Hypotheses } from './pages/Hypotheses'
import { Industries } from './pages/Industries'
import { CompanyDetail } from './pages/CompanyDetail'
import { ResearchReports } from './pages/ResearchReports'
import { ReportView } from './pages/ReportView'
import { Queue } from './pages/Queue'
import { Settings } from './pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/hypotheses" element={<Hypotheses />} />
            <Route path="/industries" element={<Industries />} />
            <Route path="/industries/:id" element={<Industries />} />
            <Route path="/companies/:id" element={<CompanyDetail />} />
            <Route path="/reports" element={<ResearchReports />} />
            <Route path="/reports/:id" element={<ReportView />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
