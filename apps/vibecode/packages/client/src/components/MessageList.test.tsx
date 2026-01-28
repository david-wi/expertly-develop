import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MessageList from './MessageList'
import type { ChatMessage } from '../store/dashboard-store'

describe('MessageList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state when no messages', () => {
    render(<MessageList messages={[]} />)

    expect(screen.getByText('No messages yet')).toBeInTheDocument()
  })

  it('renders user messages correctly', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello Claude',
        timestamp: Date.now(),
      },
    ]

    render(<MessageList messages={messages} />)

    expect(screen.getByText('Hello Claude')).toBeInTheDocument()
  })

  it('renders assistant messages correctly', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Hello! How can I help you?',
        timestamp: Date.now(),
      },
    ]

    render(<MessageList messages={messages} showStreaming={false} />)

    expect(screen.getByText('Hello! How can I help you?')).toBeInTheDocument()
  })

  it('renders system messages correctly', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'system',
        content: 'System notification',
        timestamp: Date.now(),
      },
    ]

    render(<MessageList messages={messages} />)

    expect(screen.getByText('System notification')).toBeInTheDocument()
  })

  it('renders tool use messages', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Running command...',
        timestamp: Date.now(),
        toolUse: {
          name: 'run_command',
          input: { command: 'ls -la' },
        },
      },
    ]

    render(<MessageList messages={messages} />)

    expect(screen.getByText('run_command')).toBeInTheDocument()
  })

  it('hides streaming messages when showStreaming is false and busy', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: Date.now() - 2000,
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Working on it...',
        timestamp: Date.now(),
      },
    ]

    render(<MessageList messages={messages} showStreaming={false} isBusy={true} />)

    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.queryByText('Working on it...')).not.toBeInTheDocument()
    expect(screen.getByText(/Processing.../)).toBeInTheDocument()
  })

  it('shows all messages when showStreaming is true', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: Date.now() - 2000,
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Working on it...',
        timestamp: Date.now(),
      },
    ]

    render(<MessageList messages={messages} showStreaming={true} isBusy={true} />)

    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Working on it...')).toBeInTheDocument()
  })

  it('formats timestamps correctly', () => {
    const timestamp = new Date()
    timestamp.setHours(14, 30)
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Test message',
        timestamp: timestamp.getTime(),
      },
    ]

    render(<MessageList messages={messages} />)

    // Should show formatted time
    const timeRegex = /\d{1,2}:\d{2}\s*(AM|PM)?/i
    const timeElement = screen.getByText(timeRegex)
    expect(timeElement).toBeInTheDocument()
  })

  it('renders images when present', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Check this image',
        timestamp: Date.now(),
        images: [
          {
            id: 'img-1',
            data: 'base64encodeddata',
            mediaType: 'image/png',
            name: 'test-image.png',
          },
        ],
      },
    ]

    render(<MessageList messages={messages} />)

    const image = screen.getByAltText('test-image.png')
    expect(image).toBeInTheDocument()
  })
})
