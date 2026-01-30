import { Link } from 'react-router-dom'
import { FolderKanban, ChevronRight } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export default function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  if (items.length === 0) return null

  return (
    <nav className={`flex items-center text-sm ${className}`}>
      <FolderKanban className="w-4 h-4 text-theme-text-secondary mr-2" />
      {items.map((item, index) => (
        <span key={index} className="flex items-center">
          {index > 0 && (
            <ChevronRight className="w-4 h-4 text-theme-text-secondary mx-1" />
          )}
          {item.href ? (
            <Link
              to={item.href}
              className="text-primary-600 hover:text-primary-800 hover:underline"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-theme-text-primary font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

// Helper to build breadcrumb items from project ancestry
export interface ProjectLike {
  _id?: string
  id: string
  name: string
  parent_project_id?: string | null
}

export function buildProjectBreadcrumbs(
  currentProject: ProjectLike,
  allProjects: ProjectLike[]
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = []
  const projectMap = new Map<string, ProjectLike>()

  for (const p of allProjects) {
    projectMap.set(p._id || p.id, p)
  }

  // Build ancestry chain
  const chain: ProjectLike[] = []
  let current: ProjectLike | undefined = currentProject

  while (current) {
    chain.unshift(current)
    if (current.parent_project_id) {
      current = projectMap.get(current.parent_project_id)
    } else {
      break
    }
  }

  // Add "Projects" as the root
  items.push({ label: 'Projects', href: '/projects' })

  // Add all ancestors (except the current project)
  for (let i = 0; i < chain.length - 1; i++) {
    const project = chain[i]
    items.push({
      label: project.name,
      href: `/projects/${project._id || project.id}`,
    })
  }

  // Add current project without a link
  items.push({ label: currentProject.name })

  return items
}
