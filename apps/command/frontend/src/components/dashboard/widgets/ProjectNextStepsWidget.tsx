import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { api, Project } from '../../../services/api'
import ReactMarkdown from 'react-markdown'

export function ProjectNextStepsWidget({ widgetId, config }: WidgetProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!config.projectId) {
      setError('No project selected')
      setLoading(false)
      return
    }

    const fetchProject = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await api.getProject(config.projectId!)
        setProject(data)
      } catch (err) {
        setError('Failed to load project')
        console.error('Failed to load project:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [config.projectId])

  const getWidgetTitle = (): string => {
    if (config.widgetTitle) return config.widgetTitle
    return project ? `${project.name} - Next Steps` : 'Project Next Steps'
  }

  const headerAction = project ? (
    <Link
      to={`/projects/${project._id || project.id}`}
      className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
    >
      View Project
      <ExternalLink className="w-3 h-3" />
    </Link>
  ) : null

  return (
    <WidgetWrapper widgetId={widgetId} title={getWidgetTitle()} headerAction={headerAction}>
      <div className="p-3 h-full overflow-auto">
        {loading ? (
          <div className="text-xs text-gray-500">Loading...</div>
        ) : error ? (
          <div className="text-xs text-red-500">{error}</div>
        ) : !project ? (
          <div className="text-xs text-gray-500">Project not found</div>
        ) : !project.next_steps ? (
          <div className="text-xs text-gray-500 italic">No next steps defined for this project</div>
        ) : (
          <div className="prose prose-sm max-w-none text-gray-700">
            <ReactMarkdown>{project.next_steps}</ReactMarkdown>
          </div>
        )}
      </div>
    </WidgetWrapper>
  )
}
