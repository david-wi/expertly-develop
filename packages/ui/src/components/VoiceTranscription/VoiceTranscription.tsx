import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { VoiceTranscriptionButton } from './VoiceTranscriptionButton'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'
import { useDeepgramWebSocket } from '../../hooks/useDeepgramWebSocket'
import { useActiveElement } from '../../hooks/useActiveElement'
import { cn } from '../../utils/cn'
import type { VoiceTranscriptionProps, VoiceTranscriptionStatus, TranscriptMessage } from './types'
const positionStyles = { 'bottom-right': 'bottom-0 right-0', 'bottom-left': 'bottom-0 left-0', 'top-right': 'top-0 right-0', 'top-left': 'top-0 left-0' } as const
export function VoiceTranscription({ wsUrl, position = 'bottom-right', offset = { x: 24, y: 24 }, autoInject = true, shortcut, onTranscriptionComplete, onInterimTranscript, onError, onStatusChange, className, disabled }: VoiceTranscriptionProps) {
  const [status, setStatus] = useState<VoiceTranscriptionStatus>('idle'); const interimTextRef = useRef<string>(''); const { injectText, replaceInterim } = useActiveElement()
  const updateStatus = useCallback((s: VoiceTranscriptionStatus) => { setStatus(s); onStatusChange?.(s) }, [onStatusChange])
  const handleTranscript = useCallback((m: TranscriptMessage) => { const t = m.transcript.trim(); if (!t) return; if (m.is_final) { if (autoInject && interimTextRef.current) replaceInterim(interimTextRef.current, t); else if (autoInject) injectText(t); onTranscriptionComplete?.(t); interimTextRef.current = '' } else { if (autoInject) { if (interimTextRef.current) replaceInterim(interimTextRef.current, t); else injectText(t); interimTextRef.current = t }; onInterimTranscript?.(t) } }, [autoInject, injectText, replaceInterim, onTranscriptionComplete, onInterimTranscript])
  const { isConnected, isConnecting, connect, disconnect, sendAudio, error: wsError } = useDeepgramWebSocket({ url: wsUrl, onTranscript: handleTranscript, onError: (e) => { updateStatus('error'); onError?.(e) } })
  const { isRecording, startRecording, stopRecording, error: recErr } = useAudioRecorder({ onAudioData: sendAudio, chunkInterval: 250 })
  useEffect(() => { if (wsError || recErr) updateStatus('error'); else if (isRecording && isConnected) updateStatus('listening'); else if (isConnecting) updateStatus('connecting'); else updateStatus('idle') }, [isRecording, isConnected, isConnecting, wsError, recErr, updateStatus])
  const handleClick = useCallback(async () => { if (status === 'listening') { stopRecording(); disconnect() } else { interimTextRef.current = ''; connect() } }, [status, stopRecording, disconnect, connect])
  useEffect(() => { if (isConnected && !isRecording && status === 'connecting') startRecording() }, [isConnected, isRecording, status, startRecording])
  useEffect(() => { if (!shortcut) return; const h = (e: KeyboardEvent) => { const p = shortcut.toLowerCase().split('+'), k = p[p.length - 1]; if (e.key.toLowerCase() === k && e.ctrlKey === p.includes('ctrl') && e.shiftKey === p.includes('shift') && e.altKey === p.includes('alt') && e.metaKey === (p.includes('meta') || p.includes('cmd'))) { e.preventDefault(); handleClick() } }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h) }, [shortcut, handleClick])
  useEffect(() => { return () => { stopRecording(); disconnect() } }, [stopRecording, disconnect])
  const offStyle = useMemo(() => ({ ...(position.includes('right') ? { right: offset.x } : { left: offset.x }), ...(position.includes('bottom') ? { bottom: offset.y } : { top: offset.y }) }), [position, offset])
  return <div className={cn('fixed z-50', positionStyles[position])} style={offStyle}><VoiceTranscriptionButton status={status} onClick={handleClick} disabled={disabled} className={className} /></div>
}
