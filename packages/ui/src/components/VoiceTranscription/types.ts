export type VoiceTranscriptionStatus = 'idle' | 'connecting' | 'listening' | 'error'
export type VoiceTranscriptionPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
export interface PositionOffset { x: number; y: number }
export interface VoiceTranscriptionError { code: 'microphone_denied' | 'websocket_error' | 'browser_unsupported' | 'unknown'; message: string }
export interface TranscriptMessage { transcript: string; is_final: boolean; confidence?: number; speech_final?: boolean }
export interface VoiceTranscriptionProps { wsUrl: string; position?: VoiceTranscriptionPosition; offset?: PositionOffset; autoInject?: boolean; shortcut?: string; onTranscriptionComplete?: (text: string) => void; onInterimTranscript?: (text: string) => void; onError?: (error: VoiceTranscriptionError) => void; onStatusChange?: (status: VoiceTranscriptionStatus) => void; className?: string; disabled?: boolean }
export interface VoiceTranscriptionButtonProps { status: VoiceTranscriptionStatus; onClick: () => void; disabled?: boolean; className?: string }
export interface UseAudioRecorderReturn { isRecording: boolean; startRecording: () => Promise<void>; stopRecording: () => void; error: VoiceTranscriptionError | null }
export interface UseAudioRecorderOptions { onAudioData: (data: Blob) => void; chunkInterval?: number }
export interface UseDeepgramWebSocketReturn { isConnected: boolean; isConnecting: boolean; connect: () => void; disconnect: () => void; sendAudio: (data: Blob) => void; error: VoiceTranscriptionError | null }
export interface UseDeepgramWebSocketOptions { url: string; onTranscript: (transcript: TranscriptMessage) => void; onError?: (error: VoiceTranscriptionError) => void }
export interface UseActiveElementReturn { activeElement: HTMLElement | null; injectText: (text: string) => void; replaceInterim: (oldText: string, newText: string) => void }
