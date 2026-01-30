import { useState, useRef, useCallback } from 'react'
import { Upload, X, FileText, Image, Film, Music } from 'lucide-react'

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void
  accept?: string
  maxSizeMB?: number
  className?: string
  disabled?: boolean
}

export default function FileUploadZone({
  onFileSelect,
  accept = '*/*',
  maxSizeMB = 10,
  className = '',
  disabled = false,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return Image
    if (mimeType.startsWith('video/')) return Film
    if (mimeType.startsWith('audio/')) return Music
    return FileText
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const validateFile = (file: File): string | null => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File size exceeds ${maxSizeMB}MB limit`
    }
    return null
  }

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }
      setError(null)
      setSelectedFile(file)
      onFileSelect(file)
    },
    [onFileSelect, maxSizeMB]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return

      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile, disabled]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const clearSelection = useCallback(() => {
    setSelectedFile(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const FileIcon = selectedFile ? getFileIcon(selectedFile.type) : Upload

  return (
    <div className={className}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !selectedFile && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed bg-theme-bg-elevated' : 'cursor-pointer'}
          ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-theme-border hover:border-primary-400'}
          ${selectedFile ? 'border-solid border-green-500 bg-green-50' : ''}
          ${error ? 'border-red-500 bg-red-50' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />

        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <FileIcon className="w-8 h-8 text-green-600" />
            <div className="text-left">
              <p className="font-medium text-theme-text-primary truncate max-w-[200px]">
                {selectedFile.name}
              </p>
              <p className="text-sm text-theme-text-secondary">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                clearSelection()
              }}
              className="p-1 rounded hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5 text-theme-text-secondary" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 mx-auto text-theme-text-secondary mb-2" />
            <p className="text-sm text-theme-text-primary">
              Drop a file here or <span className="text-primary-600 font-medium">browse</span>
            </p>
            <p className="text-xs text-theme-text-secondary mt-1">
              Max size: {maxSizeMB}MB
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
