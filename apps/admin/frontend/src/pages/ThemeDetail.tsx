import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { themesApi } from '@/services/api'
import { ColorPaletteEditor } from '@/components/themes/ColorPaletteEditor'
import { ThemePreview } from '@/components/themes/ThemePreview'
import { VersionHistory } from '@/components/themes/VersionHistory'
import type { ThemeColors, ThemeUpdateInput } from '@/types/theme'

export function ThemeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [colors, setColors] = useState<ThemeColors | null>(null)
  const [changeSummary, setChangeSummary] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  const { data: theme, isLoading, error } = useQuery({
    queryKey: ['theme', id],
    queryFn: () => themesApi.get(id!),
    enabled: !!id,
  })

  // Initialize form when theme loads
  if (theme && !colors) {
    setName(theme.name)
    setDescription(theme.description || '')
    setColors(theme.colors)
  }

  const updateMutation = useMutation({
    mutationFn: (data: ThemeUpdateInput) => themesApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theme', id] })
      queryClient.invalidateQueries({ queryKey: ['themes'] })
      queryClient.invalidateQueries({ queryKey: ['theme-versions', id] })
      setHasChanges(false)
      setChangeSummary('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => themesApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] })
      navigate('/themes')
    },
  })

  const handleSave = () => {
    if (!colors) return

    const data: ThemeUpdateInput = {
      name,
      description: description || undefined,
      colors,
      change_summary: changeSummary || 'Updated theme',
      changed_by: 'admin',
    }

    updateMutation.mutate(data)
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this theme? This will deactivate it.')) {
      deleteMutation.mutate()
    }
  }

  const handleColorsChange = (newColors: ThemeColors) => {
    setColors(newColors)
    setHasChanges(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-theme-text-muted">Loading theme...</div>
      </div>
    )
  }

  if (error || !theme) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-red-500 mb-4">Theme not found</div>
        <Link to="/themes" className="text-primary-600 hover:underline">
          Back to themes
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/themes"
            className="p-2 hover:bg-theme-bg-elevated rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-theme-text-secondary" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-theme-text-primary">{theme.name}</h1>
            <p className="text-theme-text-secondary">
              Version {theme.current_version} - {theme.slug}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending || !hasChanges}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-2">
        {theme.is_default && (
          <span className="text-xs bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-2 py-1 rounded">
            Default Theme
          </span>
        )}
        {!theme.is_active && (
          <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-2 py-1 rounded">
            Inactive
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main editor area */}
        <div className="xl:col-span-2 space-y-6">
          {/* Basic info */}
          <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-6">
            <h2 className="text-lg font-semibold text-theme-text-primary mb-4">Basic Info</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setHasChanges(true)
                  }}
                  className="w-full px-3 py-2 bg-theme-bg border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    setHasChanges(true)
                  }}
                  rows={2}
                  className="w-full px-3 py-2 bg-theme-bg border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-1">
                  Change Summary
                </label>
                <input
                  type="text"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="Describe your changes..."
                  className="w-full px-3 py-2 bg-theme-bg border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Color editor */}
          {colors && (
            <ColorPaletteEditor
              colors={colors}
              onChange={handleColorsChange}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Preview */}
          {colors && <ThemePreview colors={colors} />}

          {/* Version history */}
          <VersionHistory themeId={id!} currentVersion={theme.current_version} />
        </div>
      </div>
    </div>
  )
}
