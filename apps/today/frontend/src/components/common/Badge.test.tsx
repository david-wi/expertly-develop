import { describe, it, expect } from 'vitest'
import { render, screen } from '../../test/test-utils'
import { Badge, TaskStatusBadge, QuestionStatusBadge, PriorityBadge } from './Badge'

describe('Badge', () => {
  it('renders children correctly', () => {
    render(<Badge>Test Badge</Badge>)
    expect(screen.getByText('Test Badge')).toBeInTheDocument()
  })

  it('applies default variant styles', () => {
    render(<Badge>Default</Badge>)
    const badge = screen.getByText('Default')
    expect(badge.className).toContain('bg-gray-100')
    expect(badge.className).toContain('text-gray-700')
  })

  describe('variants', () => {
    it('applies success variant', () => {
      render(<Badge variant="success">Success</Badge>)
      const badge = screen.getByText('Success')
      expect(badge.className).toContain('bg-green-100')
      expect(badge.className).toContain('text-green-700')
    })

    it('applies warning variant', () => {
      render(<Badge variant="warning">Warning</Badge>)
      const badge = screen.getByText('Warning')
      expect(badge.className).toContain('bg-yellow-100')
      expect(badge.className).toContain('text-yellow-700')
    })

    it('applies error variant', () => {
      render(<Badge variant="error">Error</Badge>)
      const badge = screen.getByText('Error')
      expect(badge.className).toContain('bg-red-100')
      expect(badge.className).toContain('text-red-700')
    })

    it('applies info variant', () => {
      render(<Badge variant="info">Info</Badge>)
      const badge = screen.getByText('Info')
      expect(badge.className).toContain('bg-blue-100')
      expect(badge.className).toContain('text-blue-700')
    })

    it('applies purple variant', () => {
      render(<Badge variant="purple">Purple</Badge>)
      const badge = screen.getByText('Purple')
      expect(badge.className).toContain('bg-purple-100')
      expect(badge.className).toContain('text-purple-700')
    })
  })

  it('applies custom className', () => {
    render(<Badge className="custom-class">Custom</Badge>)
    expect(screen.getByText('Custom').className).toContain('custom-class')
  })
})

describe('TaskStatusBadge', () => {
  it('renders queued status with default variant', () => {
    render(<TaskStatusBadge status="queued" />)
    const badge = screen.getByText('queued')
    expect(badge.className).toContain('bg-gray-100')
  })

  it('renders working status with info variant', () => {
    render(<TaskStatusBadge status="working" />)
    const badge = screen.getByText('working')
    expect(badge.className).toContain('bg-blue-100')
  })

  it('renders blocked status with warning variant', () => {
    render(<TaskStatusBadge status="blocked" />)
    const badge = screen.getByText('blocked')
    expect(badge.className).toContain('bg-yellow-100')
  })

  it('renders completed status with success variant', () => {
    render(<TaskStatusBadge status="completed" />)
    const badge = screen.getByText('completed')
    expect(badge.className).toContain('bg-green-100')
  })

  it('renders cancelled status with error variant', () => {
    render(<TaskStatusBadge status="cancelled" />)
    const badge = screen.getByText('cancelled')
    expect(badge.className).toContain('bg-red-100')
  })

  it('renders unknown status with default variant', () => {
    render(<TaskStatusBadge status="unknown" />)
    const badge = screen.getByText('unknown')
    expect(badge.className).toContain('bg-gray-100')
  })
})

describe('QuestionStatusBadge', () => {
  it('renders unanswered status with warning variant', () => {
    render(<QuestionStatusBadge status="unanswered" />)
    const badge = screen.getByText('unanswered')
    expect(badge.className).toContain('bg-yellow-100')
  })

  it('renders answered status with success variant', () => {
    render(<QuestionStatusBadge status="answered" />)
    const badge = screen.getByText('answered')
    expect(badge.className).toContain('bg-green-100')
  })

  it('renders dismissed status with default variant', () => {
    render(<QuestionStatusBadge status="dismissed" />)
    const badge = screen.getByText('dismissed')
    expect(badge.className).toContain('bg-gray-100')
  })
})

describe('PriorityBadge', () => {
  it('renders priority 1 as Urgent with error variant', () => {
    render(<PriorityBadge priority={1} />)
    const badge = screen.getByText('Urgent')
    expect(badge.className).toContain('bg-red-100')
  })

  it('renders priority 2 as High with warning variant', () => {
    render(<PriorityBadge priority={2} />)
    const badge = screen.getByText('High')
    expect(badge.className).toContain('bg-yellow-100')
  })

  it('renders priority 3 as Medium with default variant', () => {
    render(<PriorityBadge priority={3} />)
    const badge = screen.getByText('Medium')
    expect(badge.className).toContain('bg-gray-100')
  })

  it('renders priority 4 as Low', () => {
    render(<PriorityBadge priority={4} />)
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('renders priority 5 as Lowest', () => {
    render(<PriorityBadge priority={5} />)
    expect(screen.getByText('Lowest')).toBeInTheDocument()
  })

  it('renders unknown priority as P# format', () => {
    render(<PriorityBadge priority={10} />)
    expect(screen.getByText('P10')).toBeInTheDocument()
  })
})
