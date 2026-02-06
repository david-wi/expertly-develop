import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RichTextEditor, { htmlToPlainText, isRichTextEmpty } from './RichTextEditor'

describe('RichTextEditor', () => {
  it('renders with placeholder when empty', () => {
    render(
      <RichTextEditor
        value=""
        onChange={() => {}}
        placeholder="Test placeholder"
      />
    )
    expect(screen.getByText('Test placeholder')).toBeInTheDocument()
  })

  it('renders formatting buttons', () => {
    render(<RichTextEditor value="" onChange={() => {}} />)
    expect(screen.getByTitle('Bold (Ctrl+B)')).toBeInTheDocument()
    expect(screen.getByTitle('Italic (Ctrl+I)')).toBeInTheDocument()
    expect(screen.getByTitle('Add Link (Ctrl+K)')).toBeInTheDocument()
  })

  it('calls onChange when content is edited', () => {
    const onChange = vi.fn()
    const { container } = render(
      <RichTextEditor value="" onChange={onChange} />
    )
    const editor = container.querySelector('[contenteditable="true"]')
    expect(editor).toBeInTheDocument()

    if (editor) {
      fireEvent.input(editor, { target: { innerHTML: 'Hello' } })
      expect(onChange).toHaveBeenCalled()
    }
  })

  it('disables editor when disabled prop is true', () => {
    const { container } = render(
      <RichTextEditor value="" onChange={() => {}} disabled />
    )
    const editor = container.querySelector('[contenteditable="false"]')
    expect(editor).toBeInTheDocument()
  })
})

describe('htmlToPlainText', () => {
  it('converts HTML to plain text', () => {
    expect(htmlToPlainText('<b>Hello</b> <i>World</i>')).toBe('Hello World')
    expect(htmlToPlainText('<a href="test">Link</a>')).toBe('Link')
  })

  it('handles empty string', () => {
    expect(htmlToPlainText('')).toBe('')
  })
})

describe('isRichTextEmpty', () => {
  it('returns true for empty content', () => {
    expect(isRichTextEmpty('')).toBe(true)
    expect(isRichTextEmpty('<br>')).toBe(true)
    expect(isRichTextEmpty('<div><br></div>')).toBe(true)
    expect(isRichTextEmpty('   ')).toBe(true)
  })

  it('returns false for non-empty content', () => {
    expect(isRichTextEmpty('Hello')).toBe(false)
    expect(isRichTextEmpty('<b>Hello</b>')).toBe(false)
  })
})
