import { describe, it, expect } from 'vitest'
import { render, screen } from '../../test/test-utils'
import { Card, CardHeader, CardContent } from './Card'

describe('Card', () => {
  it('renders children correctly', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('renders with title', () => {
    render(<Card title="Card Title">Content</Card>)
    expect(screen.getByText('Card Title')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('renders with action', () => {
    render(<Card action={<button>Action</button>}>Content</Card>)
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('renders with both title and action', () => {
    render(
      <Card title="Title" action={<button>Action</button>}>
        Content
      </Card>
    )
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('does not render header when no title or action', () => {
    const { container } = render(<Card>Content only</Card>)
    // Header has border-b class
    expect(container.querySelector('.border-b')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>)
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('applies base styles', () => {
    const { container } = render(<Card>Content</Card>)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('bg-white')
    expect(card.className).toContain('rounded-lg')
    expect(card.className).toContain('shadow-sm')
  })
})

describe('CardHeader', () => {
  it('renders children correctly', () => {
    render(<CardHeader>Header Content</CardHeader>)
    expect(screen.getByText('Header Content')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <CardHeader className="custom-header">Header</CardHeader>
    )
    expect(container.firstChild).toHaveClass('custom-header')
  })

  it('applies base styles', () => {
    const { container } = render(<CardHeader>Header</CardHeader>)
    const header = container.firstChild as HTMLElement
    expect(header.className).toContain('px-4')
    expect(header.className).toContain('py-3')
    expect(header.className).toContain('border-b')
  })
})

describe('CardContent', () => {
  it('renders children correctly', () => {
    render(<CardContent>Content Here</CardContent>)
    expect(screen.getByText('Content Here')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <CardContent className="custom-content">Content</CardContent>
    )
    expect(container.firstChild).toHaveClass('custom-content')
  })

  it('applies base styles', () => {
    const { container } = render(<CardContent>Content</CardContent>)
    const content = container.firstChild as HTMLElement
    expect(content.className).toContain('p-4')
  })
})
