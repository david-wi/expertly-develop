import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi, environmentsApi } from '../api/client'
import { Environment, Project } from '../types'
import Breadcrumbs from '../components/Breadcrumbs'
import {
  Plus,
  Check,
  Trash2,
  Globe,
  Lock,
  Unlock,
  ChevronDown,
} from 'lucide-react'
import clsx from 'clsx'

const ENVIRONMENT_TYPES = [
  { value: 'production', label: 'Production' },
  { value: 'staging', label: 'Staging' },
  { value: 'qa', label: 'QA' },
  { value: 'development', label: 'Development' },
]

interface EnvironmentFormData {
  name: string
  type: string
  base_url: string
  is_read_only: boolean
  notes: string
  credentials?: {
    username?: string
    password?: string
    login_url?: string
  }
}

export default function EnvironmentSetup() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  useTranslation()
  const queryClient = useQueryClient()

  const [showForm, setShowForm] = useState(true)
  const [formData, setFormData] = useState<EnvironmentFormData>({
    name: 'Production',
    type: 'production',
    base_url: '',
    is_read_only: false,
    notes: '',
  })
  const [typeSearch, setTypeSearch] = useState('')
  const [showTypeDropdown, setShowTypeDropdown] = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)
  const typeInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: environments } = useQuery({
    queryKey: ['environments', projectId],
    queryFn: () => environmentsApi.list(projectId!),
    enabled: !!projectId,
  })

  const createMutation = useMutation({
    mutationFn: (data: EnvironmentFormData) =>
      environmentsApi.create(projectId!, {
        name: data.name,
        type: data.type,
        base_url: data.base_url,
        is_read_only: data.is_read_only,
        is_default: (environments as Environment[])?.length === 0,
        notes: data.notes || undefined,
        credentials: data.credentials,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments', projectId] })
      setFormData({
        name: '',
        type: 'staging',
        base_url: '',
        is_read_only: false,
        notes: '',
      })
      setShowForm(false)
      setShowCredentials(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (environmentId: string) =>
      environmentsApi.delete(projectId!, environmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments', projectId] })
    },
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTypeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredTypes = ENVIRONMENT_TYPES.filter((type) =>
    type.label.toLowerCase().includes(typeSearch.toLowerCase())
  )

  const handleTypeSelect = (value: string, label: string) => {
    setFormData({ ...formData, type: value, name: label })
    setTypeSearch('')
    setShowTypeDropdown(false)
  }

  const handleCustomType = () => {
    if (typeSearch.trim()) {
      setFormData({ ...formData, type: typeSearch.toLowerCase(), name: typeSearch })
      setShowTypeDropdown(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.name && formData.base_url) {
      createMutation.mutate(formData)
    }
  }

  const projectData = project as Project

  if (projectLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-4 w-48 bg-gray-200 rounded" />
        <div className="h-8 w-64 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-200 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Projects', href: '/projects' },
          { label: projectData?.name || 'Project', href: `/projects/${projectId}` },
          { label: 'Setup Environments' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Set Up Environments</h1>
        <p className="text-gray-600 mt-1">
          Add the environments where your tests will run. Start with your primary environment.
        </p>
      </div>

      {/* Existing environments */}
      {(environments as Environment[])?.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-700">Added Environments</h2>
          <div className="space-y-2">
            {(environments as Environment[])?.map((env) => (
              <div
                key={env.id}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{env.name}</span>
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                        {env.type}
                      </span>
                      {env.is_read_only && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
                          <Lock className="w-3 h-3" /> View only
                        </span>
                      )}
                      {env.is_default && (
                        <span className="px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{env.base_url}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Delete this environment?')) {
                      deleteMutation.mutate(env.id)
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add environment form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">
            {(environments as Environment[])?.length === 0
              ? 'Add Your Primary Environment'
              : 'Add Another Environment'}
          </h2>

          {/* Environment Type with Typeahead */}
          <div ref={dropdownRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Environment Type
            </label>
            <div className="relative">
              <input
                ref={typeInputRef}
                type="text"
                value={showTypeDropdown ? typeSearch : formData.name}
                onChange={(e) => {
                  setTypeSearch(e.target.value)
                  setShowTypeDropdown(true)
                }}
                onFocus={() => setShowTypeDropdown(true)}
                placeholder="Production, Staging, QA..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {showTypeDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                {filteredTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => handleTypeSelect(type.value, type.label)}
                    className={clsx(
                      'w-full px-4 py-2 text-left hover:bg-gray-50',
                      formData.type === type.value && 'bg-primary-50 text-primary-700'
                    )}
                  >
                    {type.label}
                  </button>
                ))}
                {typeSearch && !filteredTypes.some((t) => t.label.toLowerCase() === typeSearch.toLowerCase()) && (
                  <button
                    type="button"
                    onClick={handleCustomType}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 text-primary-600"
                  >
                    Create "{typeSearch}"
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL
            </label>
            <input
              type="url"
              value={formData.base_url}
              onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
              placeholder="https://app.example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          {/* Read/Write Mode */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_read_only: !formData.is_read_only })}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors',
                formData.is_read_only
                  ? 'border-yellow-300 bg-yellow-50 text-yellow-700'
                  : 'border-green-300 bg-green-50 text-green-700'
              )}
            >
              {formData.is_read_only ? (
                <>
                  <Lock className="w-4 h-4" />
                  View only - won't change data
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  Can modify data
                </>
              )}
            </button>
          </div>

          {/* Credentials toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowCredentials(!showCredentials)}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {showCredentials ? 'Hide login credentials' : 'Add login credentials (optional)'}
            </button>
          </div>

          {showCredentials && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.credentials?.username || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        credentials: { ...formData.credentials, username: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.credentials?.password || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        credentials: { ...formData.credentials, password: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Login URL (if different from base URL)
                </label>
                <input
                  type="url"
                  value={formData.credentials?.login_url || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      credentials: { ...formData.credentials, login_url: e.target.value },
                    })
                  }
                  placeholder="https://app.example.com/login"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Any notes about this environment..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="flex justify-end gap-3">
            {(environments as Environment[])?.length > 0 && (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Adding...' : 'Add Environment'}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Another Environment
        </button>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Check className="w-4 h-4" />
          Done
        </button>
      </div>
    </div>
  )
}
