import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Building2, ChevronRight, ArrowLeft } from 'lucide-react'
import { industriesApi, companiesApi } from '../services/api'
import { SignalBadge } from '../components/SignalBadge'
import { EmptyState } from '../components/EmptyState'
import type { IndustryTreeNode, Company } from '../types'
import * as LucideIcons from 'lucide-react'

function getIcon(iconName: string): React.ComponentType<{ className?: string }> {
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>
  return icons[iconName] || Building2
}

export function Industries() {
  const [selectedSector, setSelectedSector] = useState<IndustryTreeNode | null>(null)
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryTreeNode | null>(null)
  const [selectedSubIndustry, setSelectedSubIndustry] = useState<IndustryTreeNode | null>(null)

  const { data: tree, isLoading } = useQuery({
    queryKey: ['industries', 'tree'],
    queryFn: industriesApi.tree,
  })

  // Load companies when viewing a specific industry
  const viewingId = selectedSubIndustry?.id || selectedIndustry?.id || null
  const { data: companies } = useQuery({
    queryKey: ['companies', 'by-industry', viewingId],
    queryFn: () => companiesApi.list({ industry_id: viewingId! }),
    enabled: !!viewingId && !(selectedIndustry && !selectedSubIndustry && selectedIndustry.children.length > 0),
  })

  const breadcrumbs = []
  if (selectedSector) breadcrumbs.push({ label: selectedSector.name, onClick: () => { setSelectedSector(null); setSelectedIndustry(null); setSelectedSubIndustry(null) } })
  if (selectedIndustry) breadcrumbs.push({ label: selectedIndustry.name, onClick: () => { setSelectedIndustry(null); setSelectedSubIndustry(null) } })
  if (selectedSubIndustry) breadcrumbs.push({ label: selectedSubIndustry.name, onClick: () => setSelectedSubIndustry(null) })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Industries</h1>
        <p className="text-gray-500 mt-1">Browse companies by sector, industry, and sub-industry</p>
      </div>

      {breadcrumbs.length > 0 && (
        <div className="flex items-center gap-2 mb-6 text-sm">
          <button
            onClick={() => { setSelectedSector(null); setSelectedIndustry(null); setSelectedSubIndustry(null) }}
            className="text-violet-600 hover:text-violet-800 flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            All Sectors
          </button>
          {breadcrumbs.map((bc, i) => (
            <span key={i} className="flex items-center gap-2">
              <ChevronRight className="w-3 h-3 text-gray-400" />
              <button onClick={bc.onClick} className="text-violet-600 hover:text-violet-800">{bc.label}</button>
            </span>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading industries...</div>
      ) : !selectedSector ? (
        // Show sectors
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tree?.map(sector => {
            const Icon = getIcon(sector.icon)
            return (
              <button
                key={sector.id}
                onClick={() => setSelectedSector(sector)}
                className="bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-violet-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600 group-hover:bg-violet-100">
                    <Icon className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-violet-400" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{sector.name}</h3>
                <p className="text-xs text-gray-500 line-clamp-2">{sector.description}</p>
                <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                  <span>{sector.children.length} industries</span>
                  <span className="text-gray-300">|</span>
                  <span>{sector.company_count} companies</span>
                </div>
              </button>
            )
          })}
        </div>
      ) : !selectedIndustry ? (
        // Show industries in sector
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedSector.children.map(ind => {
            const Icon = getIcon(ind.icon)
            return (
              <button
                key={ind.id}
                onClick={() => setSelectedIndustry(ind)}
                className="bg-white rounded-lg border border-gray-200 p-5 text-left hover:border-violet-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Icon className="w-5 h-5 text-violet-500" />
                  <h3 className="font-medium text-gray-900">{ind.name}</h3>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-violet-400" />
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{ind.description}</p>
                <div className="text-xs text-gray-400 mt-2">
                  {ind.children.length > 0 ? `${ind.children.length} sub-industries` : `${ind.company_count} companies`}
                </div>
              </button>
            )
          })}
          {selectedSector.children.length === 0 && (
            <div className="col-span-full">
              <EmptyState icon={Building2} title="No industries" description="No industries in this sector yet." />
            </div>
          )}
        </div>
      ) : !selectedSubIndustry && selectedIndustry.children.length > 0 ? (
        // Show sub-industries
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedIndustry.children.map(sub => {
            const Icon = getIcon(sub.icon)
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedSubIndustry(sub)}
                className="bg-white rounded-lg border border-gray-200 p-5 text-left hover:border-violet-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Icon className="w-5 h-5 text-violet-500" />
                  <h3 className="font-medium text-gray-900">{sub.name}</h3>
                </div>
                <p className="text-xs text-gray-500">{sub.description}</p>
                <div className="text-xs text-gray-400 mt-2">{sub.company_count} companies</div>
              </button>
            )
          })}
        </div>
      ) : (
        // Show companies
        <CompanyList companies={companies} />
      )}
    </div>
  )
}

function CompanyList({ companies }: { companies?: Company[] }) {
  if (!companies || companies.length === 0) {
    return <EmptyState icon={Building2} title="No companies" description="No companies tracked in this industry yet." />
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Ticker</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Signal</th>
            <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">P/E</th>
            <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Market Cap</th>
          </tr>
        </thead>
        <tbody>
          {companies.map(c => (
            <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-6 py-3">
                <Link to={`/companies/${c.id}`} className="text-sm font-medium text-violet-600 hover:text-violet-800">{c.name}</Link>
              </td>
              <td className="px-6 py-3 text-sm text-gray-600 font-mono">{c.ticker}</td>
              <td className="px-6 py-3"><SignalBadge signal={c.latest_signal} /></td>
              <td className="px-6 py-3 text-sm text-gray-700 text-right font-mono">{c.current_pe?.toFixed(1) ?? '-'}</td>
              <td className="px-6 py-3 text-sm text-gray-700 text-right">
                {c.market_cap ? (c.market_cap >= 1e12 ? `$${(c.market_cap / 1e12).toFixed(1)}T` : c.market_cap >= 1e9 ? `$${(c.market_cap / 1e9).toFixed(1)}B` : `$${(c.market_cap / 1e6).toFixed(0)}M`) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
