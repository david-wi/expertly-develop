import { describe, it, expect } from 'vitest'
import { render, screen } from '../../test/test-utils'
import { Card, CardHeader, CardContent } from './Card'

describe('Card', () => {
  it('renders children correctly', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies default styling', () => {
    render(<Card data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card.className).toContain('bg-theme-bg-surface')
    expect(card.className).toContain('rounded-xl')
    expect(card.className).toContain('shadow-sm')
    expect(card.className).toContain('border')
    expect(card.className).toContain('border-theme-border')
  })

  it('applies custom className', () => {
    render(<Card className="custom-class" data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card.className).toContain('custom-class')
  })

  it('passes through additional HTML attributes', () => {
    render(<Card data-testid="test-card" id="my-card">Content</Card>)
    const card = screen.getByTestId('test-card')
    expect(card).toHaveAttribute('id', 'my-card')
  })
})

describe('CardHeader', () => {
  it('renders children correctly', () => {
    render(<CardHeader>Header content</CardHeader>)
    expect(screen.getByText('Header content')).toBeInTheDocument()
  })

  it('applies default styling', () => {
    render(
      <CardHeader>
        <span data-testid="child">Header</span>
      </CardHeader>
    )
    // Get the child element and then its parent (the CardHeader div)
    const child = screen.getByTestId('child')
    const header = child.parentElement!
    expect(header.className).toContain('px-6')
    expect(header.className).toContain('py-4')
    expect(header.className).toContain('border-b')
    expect(header.className).toContain('border-theme-border')
  })

  it('applies custom className', () => {
    render(
      <CardHeader className="custom-header">
        <span data-testid="child">Header</span>
      </CardHeader>
    )
    const child = screen.getByTestId('child')
    const header = child.parentElement!
    expect(header.className).toContain('custom-header')
  })
})

describe('CardContent', () => {
  it('renders children correctly', () => {
    render(<CardContent>Content area</CardContent>)
    expect(screen.getByText('Content area')).toBeInTheDocument()
  })

  it('applies default styling', () => {
    render(
      <CardContent>
        <span data-testid="child">Content</span>
      </CardContent>
    )
    const child = screen.getByTestId('child')
    const content = child.parentElement!
    expect(content.className).toContain('px-6')
    expect(content.className).toContain('py-4')
  })

  it('applies custom className', () => {
    render(
      <CardContent className="custom-content">
        <span data-testid="child">Content</span>
      </CardContent>
    )
    const child = screen.getByTestId('child')
    const content = child.parentElement!
    expect(content.className).toContain('custom-content')
  })
})

describe('Card composition', () => {
  it('renders Card with CardHeader and CardContent', () => {
    render(
      <Card>
        <CardHeader>My Header</CardHeader>
        <CardContent>My Content</CardContent>
      </Card>
    )
    expect(screen.getByText('My Header')).toBeInTheDocument()
    expect(screen.getByText('My Content')).toBeInTheDocument()
  })
})
