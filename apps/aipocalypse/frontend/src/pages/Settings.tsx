import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, TestTube, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react'
import { settingsApi } from '../services/api'

export function Settings() {
  const queryClient = useQueryClient()
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [userAgent, setUserAgent] = useState('')
  const [batchSize, setBatchSize] = useState(5)
  const [defaultModel, setDefaultModel] = useState('claude-sonnet-4-20250514')

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  })

  useEffect(() => {
    if (settings) {
      setUserAgent(settings.sec_edgar_user_agent)
      setBatchSize(settings.queue_batch_size)
      setDefaultModel(settings.default_model)
    }
  }, [settings])

  const updateMutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setApiKey('')
    },
  })

  const testClaudeMutation = useMutation({
    mutationFn: settingsApi.testClaude,
  })

  const testSecMutation = useMutation({
    mutationFn: settingsApi.testSec,
  })

  const handleSave = () => {
    const data: Record<string, string | number> = {}
    if (apiKey) data.anthropic_api_key = apiKey
    if (userAgent !== settings?.sec_edgar_user_agent) data.sec_edgar_user_agent = userAgent
    if (batchSize !== settings?.queue_batch_size) data.queue_batch_size = batchSize
    if (defaultModel !== settings?.default_model) data.default_model = defaultModel
    if (Object.keys(data).length > 0) {
      updateMutation.mutate(data)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure API keys and research parameters</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Claude API Key */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Claude API Key</h2>
          <p className="text-sm text-gray-500 mb-4">Required for generating research reports. Get one at console.anthropic.com.</p>

          <div className="flex items-center gap-2 mb-3">
            <div className="text-sm">
              Status: {settings?.anthropic_api_key_set ? (
                <span className="text-green-600 font-medium">Configured</span>
              ) : (
                <span className="text-red-600 font-medium">Not set</span>
              )}
            </div>
          </div>

          <div className="relative mb-3">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={settings?.anthropic_api_key_set ? 'Enter new key to replace...' : 'sk-ant-...'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-10 font-mono"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={() => testClaudeMutation.mutate()}
            disabled={testClaudeMutation.isPending}
            className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800"
          >
            {testClaudeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
            Test Connection
          </button>
          {testClaudeMutation.data && (
            <div className={`mt-2 text-sm flex items-center gap-1.5 ${testClaudeMutation.data.success ? 'text-green-600' : 'text-red-600'}`}>
              {testClaudeMutation.data.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {testClaudeMutation.data.message}
            </div>
          )}
        </div>

        {/* SEC EDGAR */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">SEC EDGAR</h2>
          <p className="text-sm text-gray-500 mb-4">User-Agent string required by SEC. Format: "Company Name email@example.com"</p>

          <input
            type="text"
            value={userAgent}
            onChange={e => setUserAgent(e.target.value)}
            placeholder="Aipocalypse Fund research@yourcompany.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
          />

          <button
            onClick={() => testSecMutation.mutate()}
            disabled={testSecMutation.isPending}
            className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800"
          >
            {testSecMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
            Test Connection
          </button>
          {testSecMutation.data && (
            <div className={`mt-2 text-sm flex items-center gap-1.5 ${testSecMutation.data.success ? 'text-green-600' : 'text-red-600'}`}>
              {testSecMutation.data.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {testSecMutation.data.message}
            </div>
          )}
        </div>

        {/* Queue Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Queue Settings</h2>
          <p className="text-sm text-gray-500 mb-4">Configure batch processing parameters.</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch Size</label>
              <input
                type="number"
                min={1}
                max={20}
                value={batchSize}
                onChange={e => setBatchSize(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Model</label>
              <select
                value={defaultModel}
                onChange={e => setDefaultModel(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                <option value="claude-opus-4-6">Claude Opus 4.6</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium disabled:opacity-50"
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
