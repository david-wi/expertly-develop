import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { projectsApi } from '../api/client'
import { Project } from '../types'
import {
  FolderKanban,
  Zap,
  Plus,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'

export default function Dashboard() {
  const { t } = useTranslation()

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.welcome')}</h1>
        <p className="text-gray-600">{t('dashboard.subtitle')}</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          to="/quick-start"
          className="flex items-center gap-4 p-4 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
        >
          <div className="p-3 bg-primary-600 rounded-lg">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-primary-900">
              {t('dashboard.startQuickTest')}
            </h3>
            <p className="text-sm text-primary-700">
              Point at a URL and generate tests
            </p>
          </div>
        </Link>

        <Link
          to="/projects"
          className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="p-3 bg-gray-100 rounded-lg">
            <Plus className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {t('dashboard.createProject')}
            </h3>
            <p className="text-sm text-gray-600">
              Start a new testing project
            </p>
          </div>
        </Link>

        <Link
          to="/projects"
          className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="p-3 bg-gray-100 rounded-lg">
            <FolderKanban className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {t('dashboard.viewAllProjects')}
            </h3>
            <p className="text-sm text-gray-600">
              Manage your test projects
            </p>
          </div>
        </Link>
      </div>

      {/* Recent Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('dashboard.recentProjects')}
          </h2>
          <Link
            to="/projects"
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 bg-gray-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : projects?.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <FolderKanban className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('projects.noProjects')}
            </h3>
            <p className="text-gray-600 mb-4">{t('projects.createFirst')}</p>
            <Link
              to="/quick-start"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Zap className="w-4 h-4" />
              {t('dashboard.startQuickTest')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(projects as Project[])?.slice(0, 6).map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="p-4 bg-white border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all"
              >
                <h3 className="font-semibold text-gray-900 mb-2">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {project.description}
                  </p>
                )}
                {project.stats && (
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {project.stats.passed_runs}
                    </span>
                    <span className="flex items-center gap-1 text-gray-600">
                      <XCircle className="w-4 h-4 text-red-500" />
                      {project.stats.failed_runs}
                    </span>
                    <span className="flex items-center gap-1 text-gray-600">
                      <Clock className="w-4 h-4" />
                      {project.stats.total_tests} tests
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
