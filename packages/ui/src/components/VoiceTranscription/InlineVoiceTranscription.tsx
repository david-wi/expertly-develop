import { useState, useCallback, useRef, useEffect } from 'react'
import { Mic, Loader2, MicOff } from 'lucide-react'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'
import { useDeepgramWebSocket } from '../../hooks/useDeepgramWebSocket'
import { cn } from '../../utils/cn'
import type { VoiceTranscriptionStatus, VoiceTranscriptionError, TranscriptMessage } from './types'

export interface InlineVoiceTranscriptionProps {
  /** Token URL for Deepgram transcription (REST endpoint that returns temporary token) */
  tokenUrl: string
  /** Callback when transcription text should be added to the field */
  onTranscribe: (text: string) => void
  /** Callback for interim (non-final) transcripts */
  onInterimTranscript?: (text: string) => void
  /** Called on errors */
  onError?: (error: VoiceTranscriptionError) => void
  /** Additional class names */
  className?: string
  /** Disable the button */
  disabled?: boolean
  /** Size variant */
  size?: 'sm' | 'md'
}

export function InlineVoiceTranscription({
  tokenUrl,
  onTranscribe,
  onInterimTranscript,
  onError,
  className,
  disabled,
  size = 'md',
}: InlineVoiceTranscriptionProps) {
  const [status, setStatus] = useState<VoiceTranscriptionStatus>('idle')
  const interimTextRef = useRef<string>('')
  const accumulatedTextRef = useRef<string>('')

  const handleTranscript = useCallback(
    (message: TranscriptMessage) => {
      const text = message.transcript.trim()
      if (!text) return

      if (message.is_final) {
        // Add space between accumulated text and new text
        if (accumulatedTextRef.current) {
          accumulatedTextRef.current += ' ' + text
        } else {
          accumulatedTextRef.current = text
        }
        onTranscribe(accumulatedTextRef.current)
        interimTextRef.current = ''
      } else {
        // Show interim with accumulated
        const interim = accumulatedTextRef.current
          ? accumulatedTextRef.current + ' ' + text
          : text
        onInterimTranscript?.(interim)
        interimTextRef.current = text
      }
    },
    [onTranscribe, onInterimTranscript]
  )

  const {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    sendAudio,
    error: wsError,
  } = useDeepgramWebSocket({
    tokenUrl,
    onTranscript: handleTranscript,
    onError: (error) => {
      setStatus('error')
      onError?.(error)
    },
  })

  const {
    isRecording,
    startRecording,
    stopRecording,
    error: recorderError,
  } = useAudioRecorder({
    onAudioData: sendAudio,
    chunkInterval: 250,
  })

  // Update status based on state
  useEffect(() => {
    if (wsError || recorderError) {
      setStatus('error')
    } else if (isRecording && isConnected) {
      setStatus('listening')
    } else if (isConnecting) {
      setStatus('connecting')
    } else {
      setStatus('idle')
    }
  }, [isRecording, isConnected, isConnecting, wsError, recorderError])

  // Start recording once connected
  useEffect(() => {
    if (isConnected && !isRecording && status === 'connecting') {
      startRecording()
    }
  }, [isConnected, isRecording, status, startRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording()
      disconnect()
    }
  }, [stopRecording, disconnect])

  const handleClick = useCallback(() => {
    if (status === 'listening') {
      stopRecording()
      disconnect()
      // Final transcription already sent via onTranscribe
      accumulatedTextRef.current = ''
      interimTextRef.current = ''
    } else {
      accumulatedTextRef.current = ''
      interimTextRef.current = ''
      connect()
    }
  }, [status, stopRecording, disconnect, connect])

  const isListening = status === 'listening'
  const isLoading = status === 'connecting'
  const isError = status === 'error'

  const sizeClasses = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8'
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-label={
        isListening
          ? 'Stop recording'
          : isLoading
            ? 'Connecting...'
            : isError
              ? 'Retry transcription'
              : 'Start voice transcription'
      }
      title={
        isListening
          ? 'Click to stop recording'
          : 'Click to start voice transcription'
      }
      className={cn(
        'flex items-center justify-center rounded-md transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        sizeClasses,
        isListening && 'bg-red-500 text-white hover:bg-red-600 animate-pulse',
        isLoading && 'bg-blue-100 text-blue-600 cursor-wait',
        isError && 'bg-red-100 text-red-600 hover:bg-red-200',
        !isListening &&
          !isLoading &&
          !isError &&
          'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {isLoading ? (
        <Loader2 className={cn(iconSize, 'animate-spin')} />
      ) : isError ? (
        <MicOff className={iconSize} />
      ) : (
        <Mic className={iconSize} />
      )}
    </button>
  )
}
