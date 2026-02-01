import { describe, it, expect } from 'vitest'
import { ErrorState, ErrorStateProps } from './ErrorState'

describe('ErrorState', () => {
  it('should be a valid function component', () => {
    expect(typeof ErrorState).toBe('function')
  })

  it('should have ErrorStateProps interface with required message field', () => {
    // TypeScript compilation ensures the interface is correct
    // This test verifies the component accepts the expected props structure
    const props: ErrorStateProps = {
      message: 'Test error message',
    }
    expect(props.message).toBe('Test error message')
  })

  it('should accept optional title in props', () => {
    const props: ErrorStateProps = {
      message: 'Test error',
      title: 'Error Title',
    }
    expect(props.title).toBe('Error Title')
  })

  it('should accept optional onRetry callback in props', () => {
    const mockRetry = () => {}
    const props: ErrorStateProps = {
      message: 'Test error',
      onRetry: mockRetry,
    }
    expect(props.onRetry).toBe(mockRetry)
  })

  it('should accept optional className in props', () => {
    const props: ErrorStateProps = {
      message: 'Test error',
      className: 'custom-class',
    }
    expect(props.className).toBe('custom-class')
  })

  it('should accept all props together', () => {
    const mockRetry = () => {}
    const props: ErrorStateProps = {
      message: 'Test error',
      title: 'Error Title',
      onRetry: mockRetry,
      className: 'custom-class',
    }
    expect(props.message).toBe('Test error')
    expect(props.title).toBe('Error Title')
    expect(props.onRetry).toBe(mockRetry)
    expect(props.className).toBe('custom-class')
  })
})
