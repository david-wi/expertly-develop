import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { useState } from 'react'
import { themesApi } from '@/services/api'
import { ColorPaletteEditor } from '@/components/themes/ColorPaletteEditor'
import { ThemePreview } from '@/components/themes/ThemePreview'
import type { ThemeColors, ThemeCreateInput } from '@/types/theme'
import { InlineVoiceTranscription } from '@expertly/ui'

// Default colors based on violet theme
const DEFAULT_COLORS: ThemeColors = {
  light: {
    primary: {
      '50': '#f5f3ff',
      '100': '#ede9fe',
      '200': '#ddd6fe',
      '300': '#c4b5fd',
      '400': '#a78bfa',
      '500': '#8b5cf6',
      '600': '#7c3aed',
      '700': '#6d28d9',
      '800': '#5b21b6',
      '900': '#4c1d95',
      '950': '#2e1065',
    },
    background: {
      default: '#f9fafb',
      surface: '#ffffff',
      elevated: '#ffffff',
    },
    text: {
      primary: '#111827',
      secondary: '#4b5563',
      muted: '#6b7280',
    },
    border: {
      default: '#e5e7eb',
      subtle: '#f3f4f6',
    },
  },
  dark: {
    primary: {
      '50': '#f5f3ff',
      '100': '#ede9fe',
      '200': '#ddd6fe',
      '300': '#c4b5fd',
      '400': '#a78bfa',
      '500': '#8b5cf6',
      '600': '#7c3aed',
      '700': '#6d28d9',
      '800': '#5b21b6',
      '900': '#4c1d95',
      '950': '#2e1065',
    },
    background: {
      default: '#111827',
      surface: '#1f2937',
      elevated: '#374151',
    },
    text: {
      primary: '#f9fafb',
      secondary: '#9ca3af',
      muted: '#6b7280',
    },
    border: {
      default: '#374151',
      subtle: '#1f2937',
    },
  },
}

export function ThemeCreate() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [colors, setColors] = useState<ThemeColors>(DEFAULT_COLORS)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light')

  const createMutation = useMutation({
    mutationFn: (data: ThemeCreateInput) => themesApi.create(data),
    onSuccess: (theme) => {
      queryClient.invalidateQueries({ queryKey: ['themes'] })
      navigate(`/themes/${theme.id}`)
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      const detail = error.response?.data?.detail
      if (detail?.includes('slug')) {
        setErrors({ slug: 'This slug is already taken' })
      } else if (detail?.includes('name')) {
        setErrors({ name: 'This name is already taken' })
      } else {
        setErrors({ general: detail || 'Failed to create theme' })
      }
    },
  })

  const handleNameChange = (value: string) => {
    setName(value)
    // Auto-generate slug from name
    const generatedSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    setSlug(generatedSlug)
    setErrors({})
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Name is required'
    if (!slug.trim()) newErrors.slug = 'Slug is required'
    if (!/^[a-z0-9-]+$/.test(slug)) newErrors.slug = 'Slug must be lowercase letters, numbers, and hyphens only'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const data: ThemeCreateInput = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
      is_default: isDefault,
      colors,
    }

    createMutation.mutate(data)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/themes"
          className="p-2 hover:bg-theme-bg-elevated rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-theme-text-secondary" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">Create New Theme</h1>
          <p className="text-theme-text-secondary">
            Design a new color theme for Expertly apps
          </p>
        </div>
      </div>

      {errors.general && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main editor area */}
          <div className="xl:col-span-2 space-y-6">
            {/* Basic info */}
            <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-6">
              <h2 className="text-lg font-semibold text-theme-text-primary mb-4">Basic Info</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-theme-text-secondary mb-1">
                    Name *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g., Sunset"
                      className={`flex-1 px-3 py-2 bg-theme-bg border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        errors.name ? 'border-red-500' : 'border-theme-border'
                      }`}
                    />
                    <InlineVoiceTranscription
                      wsUrl="wss://identity-api.ai.devintensive.com/ws/transcribe"
                      onTranscribe={(text) => handleNameChange(name ? name + ' ' + text : text)}
                      size="md"
                      className="self-center"
                    />
                  </div>
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text-secondary mb-1">
                    Slug *
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value.toLowerCase())
                      setErrors({})
                    }}
                    placeholder="e.g., sunset"
                    className={`w-full px-3 py-2 bg-theme-bg border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      errors.slug ? 'border-red-500' : 'border-theme-border'
                    }`}
                  />
                  {errors.slug && (
                    <p className="text-red-500 text-sm mt-1">{errors.slug}</p>
                  )}
                  <p className="text-theme-text-muted text-xs mt-1">
                    URL-friendly identifier (lowercase, no spaces)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text-secondary mb-1">
                    Description
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="A brief description of this theme..."
                      className="flex-1 px-3 py-2 bg-theme-bg border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <InlineVoiceTranscription
                      wsUrl="wss://identity-api.ai.devintensive.com/ws/transcribe"
                      onTranscribe={(text) => setDescription(description ? description + ' ' + text : text)}
                      size="md"
                      className="self-start mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded border-theme-border text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="isDefault" className="text-sm text-theme-text-secondary">
                    Set as default theme
                  </label>
                </div>
              </div>
            </div>

            {/* Color editor */}
            <ColorPaletteEditor
              colors={colors}
              onChange={setColors}
              activeMode={previewMode}
              onModeChange={setPreviewMode}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Preview */}
            <ThemePreview colors={colors} mode={previewMode} onModeChange={setPreviewMode} />

            {/* Submit button */}
            <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-6">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {createMutation.isPending ? 'Creating...' : 'Create Theme'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
