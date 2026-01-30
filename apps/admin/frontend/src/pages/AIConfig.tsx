import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bot, Server, Cpu, Settings, Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import { aiConfigApi } from '@/services/api'
import type { AIModel, AIUseCaseConfig, AIModelCreate, AIUseCaseConfigUpdate } from '@/types/ai_config'

type TabType = 'use-cases' | 'models' | 'providers'

export function AIConfig() {
  const [activeTab, setActiveTab] = useState<TabType>('use-cases')
  const [showInactive, setShowInactive] = useState(false)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-theme-text-primary">AI Configuration</h1>
        <p className="text-theme-text-secondary mt-1">
          Manage AI models and use case mappings across all Expertly applications
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-theme-border">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('use-cases')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'use-cases'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary'
            }`}
          >
            <Settings className="w-4 h-4" />
            Use Cases
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'models'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary'
            }`}
          >
            <Cpu className="w-4 h-4" />
            Models
          </button>
          <button
            onClick={() => setActiveTab('providers')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'providers'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary'
            }`}
          >
            <Server className="w-4 h-4" />
            Providers
          </button>
        </nav>
      </div>

      {/* Show inactive toggle */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-theme-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-theme-border"
          />
          Show inactive
        </label>
      </div>

      {/* Tab content */}
      {activeTab === 'use-cases' && <UseCasesTab showInactive={showInactive} />}
      {activeTab === 'models' && <ModelsTab showInactive={showInactive} />}
      {activeTab === 'providers' && <ProvidersTab showInactive={showInactive} />}
    </div>
  )
}

// Use Cases Tab
function UseCasesTab({ showInactive }: { showInactive: boolean }) {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<AIUseCaseConfigUpdate>({})

  const { data: useCasesData, isLoading: useCasesLoading } = useQuery({
    queryKey: ['ai-config-use-cases', showInactive],
    queryFn: () => aiConfigApi.listUseCases(showInactive),
  })

  const { data: modelsData } = useQuery({
    queryKey: ['ai-config-models', false],
    queryFn: () => aiConfigApi.listModels(false),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AIUseCaseConfigUpdate }) =>
      aiConfigApi.updateUseCase(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config-use-cases'] })
      setEditingId(null)
      setEditForm({})
    },
  })

  const startEdit = (uc: AIUseCaseConfig) => {
    setEditingId(uc.id)
    setEditForm({
      model_id: uc.model_id || undefined,
      max_tokens: uc.max_tokens,
      temperature: uc.temperature,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = (id: string) => {
    updateMutation.mutate({ id, data: editForm })
  }

  if (useCasesLoading) {
    return <div className="text-theme-text-muted">Loading use cases...</div>
  }

  return (
    <div className="bg-theme-bg-surface rounded-xl border border-theme-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-theme-bg-elevated border-b border-theme-border">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-theme-text-secondary">Use Case</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-theme-text-secondary">Model</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-theme-text-secondary">Provider</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-theme-text-secondary">Max Tokens</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-theme-text-secondary">Temperature</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-theme-text-secondary">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-theme-border">
          {useCasesData?.use_cases.map((uc) => (
            <tr key={uc.id} className={!uc.is_active ? 'opacity-50' : ''}>
              <td className="px-4 py-3">
                <div className="font-medium text-theme-text-primary">{uc.use_case}</div>
                <div className="text-xs text-theme-text-muted">{uc.description}</div>
              </td>
              <td className="px-4 py-3">
                {editingId === uc.id ? (
                  <select
                    value={editForm.model_id || ''}
                    onChange={(e) => setEditForm({ ...editForm, model_id: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-theme-border rounded bg-theme-bg-surface"
                  >
                    <option value="">Select model...</option>
                    {modelsData?.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.model_id} ({m.provider_name})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm text-theme-text-primary font-mono">{uc.model_name || '-'}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-theme-text-secondary">{uc.provider_name || '-'}</span>
              </td>
              <td className="px-4 py-3">
                {editingId === uc.id ? (
                  <input
                    type="number"
                    value={editForm.max_tokens || 4096}
                    onChange={(e) => setEditForm({ ...editForm, max_tokens: parseInt(e.target.value) })}
                    className="w-24 px-2 py-1 text-sm border border-theme-border rounded bg-theme-bg-surface"
                  />
                ) : (
                  <span className="text-sm text-theme-text-primary">{uc.max_tokens}</span>
                )}
              </td>
              <td className="px-4 py-3">
                {editingId === uc.id ? (
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={editForm.temperature || 0.7}
                    onChange={(e) => setEditForm({ ...editForm, temperature: parseFloat(e.target.value) })}
                    className="w-20 px-2 py-1 text-sm border border-theme-border rounded bg-theme-bg-surface"
                  />
                ) : (
                  <span className="text-sm text-theme-text-primary">{uc.temperature}</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {editingId === uc.id ? (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => saveEdit(uc.id)}
                      disabled={updateMutation.isPending}
                      className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(uc)}
                    className="p-1 text-theme-text-secondary hover:bg-theme-bg-elevated rounded"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Models Tab
function ModelsTab({ showInactive }: { showInactive: boolean }) {
  const queryClient = useQueryClient()
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [showAddModel, setShowAddModel] = useState(false)
  const [newModel, setNewModel] = useState<Partial<AIModelCreate>>({})

  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['ai-config-models', showInactive],
    queryFn: () => aiConfigApi.listModels(showInactive),
  })

  const { data: providersData } = useQuery({
    queryKey: ['ai-config-providers', false],
    queryFn: () => aiConfigApi.listProviders(false),
  })

  const createMutation = useMutation({
    mutationFn: (data: AIModelCreate) => aiConfigApi.createModel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config-models'] })
      setShowAddModel(false)
      setNewModel({})
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiConfigApi.deleteModel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config-models'] })
    },
  })

  // Group models by provider
  const modelsByProvider = modelsData?.models.reduce((acc, model) => {
    if (!acc[model.provider_name]) {
      acc[model.provider_name] = []
    }
    acc[model.provider_name].push(model)
    return acc
  }, {} as Record<string, AIModel[]>) || {}

  if (modelsLoading) {
    return <div className="text-theme-text-muted">Loading models...</div>
  }

  return (
    <div className="space-y-4">
      {/* Add Model Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddModel(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Model
        </button>
      </div>

      {/* Add Model Form */}
      {showAddModel && (
        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-4">
          <h3 className="font-medium text-theme-text-primary mb-4">Add New Model</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-theme-text-secondary mb-1">Provider</label>
              <select
                value={newModel.provider_id || ''}
                onChange={(e) => setNewModel({ ...newModel, provider_id: e.target.value })}
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-surface"
              >
                <option value="">Select provider...</option>
                {providersData?.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-theme-text-secondary mb-1">Model ID</label>
              <input
                type="text"
                value={newModel.model_id || ''}
                onChange={(e) => setNewModel({ ...newModel, model_id: e.target.value })}
                placeholder="claude-sonnet-4-0-latest"
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-surface"
              />
            </div>
            <div>
              <label className="block text-sm text-theme-text-secondary mb-1">Display Name</label>
              <input
                type="text"
                value={newModel.display_name || ''}
                onChange={(e) => setNewModel({ ...newModel, display_name: e.target.value })}
                placeholder="Claude Sonnet 4"
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-surface"
              />
            </div>
            <div>
              <label className="block text-sm text-theme-text-secondary mb-1">Capabilities (comma-separated)</label>
              <input
                type="text"
                value={newModel.capabilities?.join(', ') || ''}
                onChange={(e) =>
                  setNewModel({
                    ...newModel,
                    capabilities: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="text, vision, tools"
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-surface"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => {
                setShowAddModel(false)
                setNewModel({})
              }}
              className="px-4 py-2 text-theme-text-secondary hover:bg-theme-bg-elevated rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (newModel.provider_id && newModel.model_id && newModel.display_name) {
                  createMutation.mutate(newModel as AIModelCreate)
                }
              }}
              disabled={!newModel.provider_id || !newModel.model_id || !newModel.display_name || createMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              Add Model
            </button>
          </div>
        </div>
      )}

      {/* Models by Provider */}
      {Object.entries(modelsByProvider).map(([providerName, models]) => (
        <div key={providerName} className="bg-theme-bg-surface rounded-xl border border-theme-border overflow-hidden">
          <button
            onClick={() => setExpandedProvider(expandedProvider === providerName ? null : providerName)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-theme-bg-elevated"
          >
            <div className="flex items-center gap-3">
              <Bot className="w-5 h-5 text-primary-600" />
              <span className="font-medium text-theme-text-primary">{providerName}</span>
              <span className="text-sm text-theme-text-muted">({models.length} models)</span>
            </div>
            {expandedProvider === providerName ? (
              <ChevronUp className="w-5 h-5 text-theme-text-secondary" />
            ) : (
              <ChevronDown className="w-5 h-5 text-theme-text-secondary" />
            )}
          </button>
          {expandedProvider === providerName && (
            <div className="border-t border-theme-border divide-y divide-theme-border">
              {models.map((model) => (
                <div
                  key={model.id}
                  className={`px-4 py-3 flex items-center justify-between ${!model.is_active ? 'opacity-50' : ''}`}
                >
                  <div>
                    <div className="font-mono text-sm text-theme-text-primary">{model.model_id}</div>
                    <div className="text-xs text-theme-text-muted">{model.display_name}</div>
                    <div className="flex gap-1 mt-1">
                      {model.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to deactivate this model?')) {
                        deleteMutation.mutate(model.id)
                      }
                    }}
                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Providers Tab
function ProvidersTab({ showInactive }: { showInactive: boolean }) {
  const queryClient = useQueryClient()
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [newProvider, setNewProvider] = useState({
    name: '',
    display_name: '',
    api_key_env_var: '',
    base_url: '',
  })

  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ['ai-config-providers', showInactive],
    queryFn: () => aiConfigApi.listProviders(showInactive),
  })

  const createMutation = useMutation({
    mutationFn: aiConfigApi.createProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config-providers'] })
      setShowAddProvider(false)
      setNewProvider({ name: '', display_name: '', api_key_env_var: '', base_url: '' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: aiConfigApi.deleteProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config-providers'] })
    },
  })

  if (providersLoading) {
    return <div className="text-theme-text-muted">Loading providers...</div>
  }

  return (
    <div className="space-y-4">
      {/* Add Provider Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddProvider(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Provider
        </button>
      </div>

      {/* Add Provider Form */}
      {showAddProvider && (
        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-4">
          <h3 className="font-medium text-theme-text-primary mb-4">Add New Provider</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-theme-text-secondary mb-1">Name (slug)</label>
              <input
                type="text"
                value={newProvider.name}
                onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                placeholder="anthropic"
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-surface"
              />
            </div>
            <div>
              <label className="block text-sm text-theme-text-secondary mb-1">Display Name</label>
              <input
                type="text"
                value={newProvider.display_name}
                onChange={(e) => setNewProvider({ ...newProvider, display_name: e.target.value })}
                placeholder="Anthropic"
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-surface"
              />
            </div>
            <div>
              <label className="block text-sm text-theme-text-secondary mb-1">API Key Env Var</label>
              <input
                type="text"
                value={newProvider.api_key_env_var}
                onChange={(e) => setNewProvider({ ...newProvider, api_key_env_var: e.target.value })}
                placeholder="ANTHROPIC_API_KEY"
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-surface"
              />
            </div>
            <div>
              <label className="block text-sm text-theme-text-secondary mb-1">Base URL (optional)</label>
              <input
                type="text"
                value={newProvider.base_url}
                onChange={(e) => setNewProvider({ ...newProvider, base_url: e.target.value })}
                placeholder="https://api.anthropic.com"
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-surface"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => {
                setShowAddProvider(false)
                setNewProvider({ name: '', display_name: '', api_key_env_var: '', base_url: '' })
              }}
              className="px-4 py-2 text-theme-text-secondary hover:bg-theme-bg-elevated rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (newProvider.name && newProvider.display_name && newProvider.api_key_env_var) {
                  createMutation.mutate({
                    name: newProvider.name,
                    display_name: newProvider.display_name,
                    api_key_env_var: newProvider.api_key_env_var,
                    base_url: newProvider.base_url || undefined,
                  })
                }
              }}
              disabled={!newProvider.name || !newProvider.display_name || !newProvider.api_key_env_var || createMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              Add Provider
            </button>
          </div>
        </div>
      )}

      {/* Provider Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {providersData?.providers.map((provider) => (
          <div
            key={provider.id}
            className={`bg-theme-bg-surface rounded-xl border border-theme-border p-4 ${!provider.is_active ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <Server className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <div className="font-medium text-theme-text-primary">{provider.display_name}</div>
                  <div className="text-xs text-theme-text-muted font-mono">{provider.name}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to deactivate this provider?')) {
                    deleteMutation.mutate(provider.id)
                  }
                }}
                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-theme-text-secondary">API Key Env Var:</span>
                <span className="font-mono text-theme-text-primary">{provider.api_key_env_var}</span>
              </div>
              {provider.base_url && (
                <div className="flex justify-between">
                  <span className="text-theme-text-secondary">Base URL:</span>
                  <span className="text-theme-text-primary truncate max-w-[200px]">{provider.base_url}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
