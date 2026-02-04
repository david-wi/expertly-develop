import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ProductComparison from '../pages/ProductComparison'

describe('ProductComparison', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ProductComparison />
      </BrowserRouter>
    )
  }

  it('renders the main heading', () => {
    renderComponent()
    expect(screen.getByText('TMS Comparison: How We Stack Up')).toBeInTheDocument()
  })

  it('has Show Notes toggle checkbox', () => {
    renderComponent()
    const checkbox = screen.getByRole('checkbox', { name: /show notes/i })
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).not.toBeChecked()
  })

  it('shows Notes column when toggle is enabled', () => {
    renderComponent()
    const checkbox = screen.getByRole('checkbox', { name: /show notes/i })

    // Notes column header should not be visible initially
    expect(screen.queryAllByText('Notes').length).toBeLessThanOrEqual(1) // Only pricing table has Notes

    // Enable notes
    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()

    // Notes column headers should now appear (one per category table)
    expect(screen.getAllByText('Notes').length).toBeGreaterThan(1)
  })

  it('displays competitor advantage notes when toggle is enabled', () => {
    renderComponent()
    const checkbox = screen.getByRole('checkbox', { name: /show notes/i })

    // Enable notes
    fireEvent.click(checkbox)

    // Check that some competitor advantage notes appear (multiple may match)
    expect(screen.getAllByText(/McLeod has 35\+ years/i).length).toBeGreaterThan(0)
  })

  it('displays the subtitle with feature count', () => {
    renderComponent()
    expect(screen.getByText(/transparent, feature-by-feature comparison/i)).toBeInTheDocument()
  })

  it('renders all 15 category sections', () => {
    renderComponent()
    const categoryNames = [
      'Quote Management',
      'Order/Load Management',
      'Dispatch & Load Planning',
      'Carrier Management',
      'Tendering & Procurement',
      'Tracking & Visibility',
      'EDI & Integrations',
      'Billing & Invoicing',
      'Carrier Payables',
      'Document Management',
      'Reporting & Analytics',
      'Compliance & Safety',
      'Mobile & Accessibility',
      'AI & Automation',
      'Platform & Support',
    ]

    categoryNames.forEach((name) => {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0)
    })
  })

  it('displays competitor columns in comparison tables', () => {
    renderComponent()
    // Check that competitor names appear in table headers
    // Note: Descartes product is shown as "Aljex" in the header
    expect(screen.getAllByText('McLeod').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Trimble').length).toBeGreaterThan(0)
    expect(screen.getAllByText('MercuryGate').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Aljex').length).toBeGreaterThan(0)
    expect(screen.getAllByText('DAT').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Expertly').length).toBeGreaterThan(0)
  })

  it('renders the status legend', () => {
    renderComponent()
    expect(screen.getByText('Full support')).toBeInTheDocument()
    expect(screen.getByText('Partial/limited')).toBeInTheDocument()
    expect(screen.getByText('Paid add-on')).toBeInTheDocument()
    expect(screen.getByText('Not available')).toBeInTheDocument()
    expect(screen.getByText('Planned (Expertly)')).toBeInTheDocument()
  })

  it('renders category navigation buttons', () => {
    renderComponent()
    // Category navigation shows buttons for each category
    // These are clickable buttons to jump to sections
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
  })

  it('displays the CTA section', () => {
    renderComponent()
    expect(screen.getByText('Ready to try a modern TMS?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /start free trial/i })).toBeInTheDocument()
  })

  it('displays the pricing comparison section', () => {
    renderComponent()
    expect(screen.getByText('Pricing Comparison')).toBeInTheDocument()
    // Check for pricing table headers
    expect(screen.getByText('Pricing Model')).toBeInTheDocument()
    expect(screen.getByText('Starting Price')).toBeInTheDocument()
  })

  it('displays why choose section with key differentiators', () => {
    renderComponent()
    expect(screen.getByText('Why Choose Expertly TMS?')).toBeInTheDocument()
    expect(screen.getByText('AI-First Design')).toBeInTheDocument()
    expect(screen.getByText('Evidence-Based Extraction')).toBeInTheDocument()
  })

  it('renders features within quote management category', () => {
    renderComponent()
    // Check for specific features in the Quote Management category
    expect(screen.getByText('Manual quote creation')).toBeInTheDocument()
    expect(screen.getByText('Email-to-quote extraction')).toBeInTheDocument()
    expect(screen.getByText('AI-powered field extraction with evidence')).toBeInTheDocument()
  })

  it('renders features within carrier management category', () => {
    renderComponent()
    // Check for specific features in the Carrier Management category
    expect(screen.getByText('Carrier database')).toBeInTheDocument()
    expect(screen.getByText('MC/DOT number tracking')).toBeInTheDocument()
    expect(screen.getByText('Insurance certificate tracking')).toBeInTheDocument()
  })

  it('displays competitor summary cards', () => {
    renderComponent()
    // Check the "The Platforms" section shows all competitors
    expect(screen.getByText('The Platforms')).toBeInTheDocument()
    // Use getAllByText since names appear in multiple places (cards and pricing table)
    expect(screen.getAllByText('McLeod LoadMaster').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Trimble TMW Suite').length).toBeGreaterThan(0)
    expect(screen.getAllByText('MercuryGate TMS').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Descartes Aljex').length).toBeGreaterThan(0)
    expect(screen.getAllByText('DAT Broker TMS').length).toBeGreaterThan(0)
  })

  it('has navigation links back to landing and main app', () => {
    renderComponent()
    // Use getAllByText since there may be multiple navigation sections
    expect(screen.getAllByText('Home').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Get Started').length).toBeGreaterThan(0)
  })
})
