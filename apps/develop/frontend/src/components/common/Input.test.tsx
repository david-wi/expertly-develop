import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { Input, Textarea, Select } from './Input'

describe('Input', () => {
  it('renders input element', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    render(<Input label="Email Address" />)
    expect(screen.getByText('Email Address')).toBeInTheDocument()
  })

  it('does not render label when not provided', () => {
    render(<Input placeholder="No label" />)
    expect(screen.queryByRole('label')).not.toBeInTheDocument()
  })

  it('renders error message when provided', () => {
    render(<Input error="This field is required" />)
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  it('applies error styling when error is provided', () => {
    render(<Input error="Error message" data-testid="input" />)
    const input = screen.getByTestId('input')
    expect(input.className).toContain('border-red-300')
  })

  it('does not apply error styling when no error', () => {
    render(<Input data-testid="input" />)
    const input = screen.getByTestId('input')
    expect(input.className).toContain('border-theme-border')
    expect(input.className).not.toContain('border-red-300')
  })

  it('handles user input', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Input onChange={handleChange} />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'Hello')
    expect(handleChange).toHaveBeenCalled()
  })

  it('is disabled when disabled prop is true', () => {
    render(<Input disabled data-testid="input" />)
    expect(screen.getByTestId('input')).toBeDisabled()
  })

  it('applies custom className', () => {
    render(<Input className="custom-input" data-testid="input" />)
    const input = screen.getByTestId('input')
    expect(input.className).toContain('custom-input')
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<Input ref={ref} />)
    expect(ref).toHaveBeenCalled()
  })

  it('passes through additional HTML attributes', () => {
    render(<Input type="email" name="email" required data-testid="input" />)
    const input = screen.getByTestId('input')
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('name', 'email')
    expect(input).toBeRequired()
  })
})

describe('Textarea', () => {
  it('renders textarea element', () => {
    render(<Textarea placeholder="Enter description" />)
    expect(screen.getByPlaceholderText('Enter description')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    render(<Textarea label="Description" />)
    expect(screen.getByText('Description')).toBeInTheDocument()
  })

  it('renders error message when provided', () => {
    render(<Textarea error="Description is required" />)
    expect(screen.getByText('Description is required')).toBeInTheDocument()
  })

  it('applies error styling when error is provided', () => {
    render(<Textarea error="Error" data-testid="textarea" />)
    const textarea = screen.getByTestId('textarea')
    expect(textarea.className).toContain('border-red-300')
  })

  it('handles user input', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Textarea onChange={handleChange} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Test input')
    expect(handleChange).toHaveBeenCalled()
  })

  it('is disabled when disabled prop is true', () => {
    render(<Textarea disabled data-testid="textarea" />)
    expect(screen.getByTestId('textarea')).toBeDisabled()
  })

  it('applies custom className', () => {
    render(<Textarea className="custom-textarea" data-testid="textarea" />)
    const textarea = screen.getByTestId('textarea')
    expect(textarea.className).toContain('custom-textarea')
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<Textarea ref={ref} />)
    expect(ref).toHaveBeenCalled()
  })

  it('accepts rows attribute', () => {
    render(<Textarea rows={5} data-testid="textarea" />)
    const textarea = screen.getByTestId('textarea')
    expect(textarea).toHaveAttribute('rows', '5')
  })
})

describe('Select', () => {
  const options = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ]

  it('renders select element with options', () => {
    render(<Select options={options} />)
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(screen.getByText('Option 1')).toBeInTheDocument()
    expect(screen.getByText('Option 2')).toBeInTheDocument()
    expect(screen.getByText('Option 3')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    render(<Select label="Choose Option" options={options} />)
    expect(screen.getByText('Choose Option')).toBeInTheDocument()
  })

  it('renders error message when provided', () => {
    render(<Select options={options} error="Selection required" />)
    expect(screen.getByText('Selection required')).toBeInTheDocument()
  })

  it('applies error styling when error is provided', () => {
    render(<Select options={options} error="Error" data-testid="select" />)
    const select = screen.getByTestId('select')
    expect(select.className).toContain('border-red-300')
  })

  it('handles selection change', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Select options={options} onChange={handleChange} />)

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'option2')
    expect(handleChange).toHaveBeenCalled()
  })

  it('is disabled when disabled prop is true', () => {
    render(<Select options={options} disabled data-testid="select" />)
    expect(screen.getByTestId('select')).toBeDisabled()
  })

  it('applies custom className', () => {
    render(<Select options={options} className="custom-select" data-testid="select" />)
    const select = screen.getByTestId('select')
    expect(select.className).toContain('custom-select')
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<Select options={options} ref={ref} />)
    expect(ref).toHaveBeenCalled()
  })

  it('renders correct option values', () => {
    render(<Select options={options} data-testid="select" />)
    const optionElements = screen.getAllByRole('option')
    expect(optionElements).toHaveLength(3)
    expect(optionElements[0]).toHaveValue('option1')
    expect(optionElements[1]).toHaveValue('option2')
    expect(optionElements[2]).toHaveValue('option3')
  })

  it('selects the correct value', () => {
    render(<Select options={options} value="option2" data-testid="select" />)
    const select = screen.getByTestId('select')
    expect(select).toHaveValue('option2')
  })
})
