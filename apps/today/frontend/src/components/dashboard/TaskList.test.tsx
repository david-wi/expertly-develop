import { describe, it, expect } from 'vitest'
import { render, screen } from '../../test/test-utils'
import { TaskList } from './TaskList'
import type { Task } from '../../types'

const mockTasks: Task[] = [
  {
    id: '1',
    tenant_id: 'tenant-1',
    project_id: null,
    title: 'Task One',
    description: 'Description for task one',
    priority: 1,
    status: 'queued',
    assignee: 'claude',
    due_date: null,
    blocking_question_id: null,
    context: {},
    output: null,
    source: null,
    tags: [],
    created_at: '2026-01-22T10:00:00Z',
    updated_at: '2026-01-22T10:00:00Z',
    started_at: null,
    completed_at: null,
  },
  {
    id: '2',
    tenant_id: 'tenant-1',
    project_id: null,
    title: 'Task Two',
    description: null,
    priority: 3,
    status: 'working',
    assignee: 'user',
    due_date: null,
    blocking_question_id: null,
    context: {},
    output: null,
    source: null,
    tags: [],
    created_at: '2026-01-22T11:00:00Z',
    updated_at: '2026-01-22T11:00:00Z',
    started_at: '2026-01-22T11:30:00Z',
    completed_at: null,
  },
]

describe('TaskList', () => {
  it('renders with default title', () => {
    render(<TaskList tasks={mockTasks} />)
    expect(screen.getByText('Tasks')).toBeInTheDocument()
  })

  it('renders with custom title', () => {
    render(<TaskList tasks={mockTasks} title="Today's Priorities" />)
    expect(screen.getByText("Today's Priorities")).toBeInTheDocument()
  })

  it('displays tasks', () => {
    render(<TaskList tasks={mockTasks} />)

    expect(screen.getByText('Task One')).toBeInTheDocument()
    expect(screen.getByText('Task Two')).toBeInTheDocument()
  })

  it('displays task descriptions when present', () => {
    render(<TaskList tasks={mockTasks} />)

    expect(screen.getByText('Description for task one')).toBeInTheDocument()
  })

  it('displays task status badges', () => {
    render(<TaskList tasks={mockTasks} />)

    expect(screen.getByText('queued')).toBeInTheDocument()
    expect(screen.getByText('working')).toBeInTheDocument()
  })

  it('displays priority badges', () => {
    render(<TaskList tasks={mockTasks} />)

    expect(screen.getByText('Urgent')).toBeInTheDocument() // Priority 1
    expect(screen.getByText('Medium')).toBeInTheDocument() // Priority 3
  })

  it('shows Claude indicator for claude-assigned tasks', () => {
    render(<TaskList tasks={mockTasks} />)

    // Task 1 is assigned to claude
    expect(screen.getByText('Claude')).toBeInTheDocument()
  })

  it('displays empty message when no tasks', () => {
    render(<TaskList tasks={[]} />)
    expect(screen.getByText('No tasks')).toBeInTheDocument()
  })

  it('displays custom empty message', () => {
    render(<TaskList tasks={[]} emptyMessage="Nothing to do today!" />)
    expect(screen.getByText('Nothing to do today!')).toBeInTheDocument()
  })

  it('renders task links with correct href', () => {
    render(<TaskList tasks={mockTasks} />)

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/tasks/1')
    expect(links[1]).toHaveAttribute('href', '/tasks/2')
  })
})
