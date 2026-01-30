import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Modal, ModalFooter } from '@expertly/ui'
import { api, Connection, ConnectionProvider } from '../services/api'

export default function Connections() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [connections, setConnections] = useState<Connection[]>([])
  const [providers, setProviders] = useState<ConnectionProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<ConnectionProvider | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Toast/notification state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    // Handle OAuth callback results
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success) {
      setNotification({ type: 'success', message: 'Connection added successfully!' })
      // Clear the URL params
      setSearchParams({})
    } else if (error) {
      setNotification({ type: 'error', message: error })
      setSearchParams({})
    }

    loadData()
  }, [searchParams, setSearchParams])

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const loadData = async () => {
    setLoading(true)
    try {
      const [connectionsData, providersData] = await Promise.all([
        api.getConnections(),
        api.getConnectionProviders(),
      ])
      setConnections(connectionsData)
      setProviders(providersData)
    } catch (error) {
      console.error('Failed to load connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (providerId: string) => {
    setConnecting(true)
    try {
      const result = await api.startOAuthFlow(providerId)
      // Redirect to the OAuth provider
      window.location.href = result.auth_url
    } catch (error) {
      console.error('Failed to start OAuth flow:', error)
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to start connection',
      })
      setConnecting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedConnection) return

    setDeleting(true)
    try {
      await api.deleteConnection(selectedConnection.id)
      await loadData()
      setShowDeleteConfirm(false)
      setSelectedConnection(null)
      setNotification({ type: 'success', message: 'Connection removed successfully' })
    } catch (error) {
      console.error('Failed to delete connection:', error)
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to remove connection',
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleRefresh = async (connection: Connection) => {
    try {
      await api.refreshConnection(connection.id)
      await loadData()
      setNotification({ type: 'success', message: 'Connection refreshed successfully' })
    } catch (error) {
      console.error('Failed to refresh connection:', error)
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to refresh connection',
      })
    }
  }

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )
      case 'slack':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#E01E5A"/>
          </svg>
        )
      case 'microsoft':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M0 0h11.377v11.377H0V0zm12.623 0H24v11.377H12.623V0zM0 12.623h11.377V24H0V12.623zm12.623 0H24V24H12.623V12.623z" fill="#00A4EF"/>
          </svg>
        )
      default:
        return (
          <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-xs font-bold">
            {provider.charAt(0).toUpperCase()}
          </div>
        )
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        )
      case 'expired':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            Expired
          </span>
        )
      case 'revoked':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
            Revoked
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        )
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Check which providers are already connected
  const connectedProviders = new Set(connections.map((c) => c.provider))

  return (
    <div className="space-y-4">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-md shadow-lg ${
            notification.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? (
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Connections</h2>
          <p className="text-sm text-gray-500 mt-1">
            Connect external services to use with your tasks
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 transition-colors"
        >
          Add Connection
        </button>
      </div>

      {/* Connections List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : connections.length === 0 ? (
          <div className="p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No connections</h3>
            <p className="mt-1 text-sm text-gray-500">
              Connect external services like Google, Slack, or Microsoft.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
            >
              Add your first connection
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Connected
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {connections.map((connection) => (
                <tr key={connection.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-3">
                      {getProviderIcon(connection.provider)}
                      <span className="font-medium text-gray-900 capitalize">
                        {connection.provider}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">
                      {connection.provider_email || 'Unknown account'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(connection.status)}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">
                      {formatDate(connection.connected_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {connection.status === 'expired' && (
                      <button
                        onClick={() => handleRefresh(connection)}
                        className="text-blue-600 hover:text-blue-800 text-sm mr-2"
                      >
                        Refresh
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedConnection(connection)
                        setShowDeleteConfirm(true)
                      }}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Scopes info for existing connections */}
      {connections.length > 0 && (
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Permissions</h3>
          <div className="space-y-3">
            {connections.map((connection) => (
              <div key={connection.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center space-x-2 mb-1">
                  {getProviderIcon(connection.provider)}
                  <span className="text-sm font-medium capitalize">{connection.provider}</span>
                </div>
                <div className="flex flex-wrap gap-1 ml-8">
                  {connection.scopes.map((scope) => {
                    // Clean up scope names for display
                    const displayScope = scope
                      .replace('https://www.googleapis.com/auth/', '')
                      .replace('.readonly', ' (read)')
                      .replace('.send', ' (send)')
                    return (
                      <span
                        key={scope}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600"
                      >
                        {displayScope}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Connection Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Connection"
      >
        <p className="text-gray-500 mb-4">
          Select a service to connect. You'll be redirected to authorize access.
        </p>
        <div className="space-y-2">
          {providers.map((provider) => {
            const isConnected = connectedProviders.has(provider.id as Connection['provider'])
            const isConfigured = provider.configured
            return (
              <button
                key={provider.id}
                onClick={() => {
                  if (isConnected) return
                  if (!isConfigured) {
                    setSelectedProvider(provider)
                    setShowAddModal(false)
                    setShowSetupModal(true)
                  } else {
                    setShowAddModal(false)
                    handleConnect(provider.id)
                  }
                }}
                disabled={connecting || isConnected}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                  isConnected
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                    : !isConfigured
                      ? 'border-amber-200 bg-amber-50 hover:border-amber-300'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                {getProviderIcon(provider.id)}
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900">{provider.name}</p>
                  <p className="text-sm text-gray-500">{provider.description}</p>
                </div>
                {isConnected ? (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Connected
                  </span>
                ) : !isConfigured ? (
                  <span className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded">
                    Setup Required
                  </span>
                ) : connecting ? (
                  <span className="text-sm text-gray-500">Connecting...</span>
                ) : (
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </button>
            )
          })}
          {providers.length === 0 && (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-2">Loading providers...</p>
            </div>
          )}
        </div>
        <ModalFooter>
          <button
            onClick={() => setShowAddModal(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
        </ModalFooter>
      </Modal>

      {/* Setup Instructions Modal */}
      <Modal
        isOpen={showSetupModal && !!selectedProvider}
        onClose={() => {
          setShowSetupModal(false)
          setSelectedProvider(null)
        }}
        title={`Setup ${selectedProvider?.name} Connection`}
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-medium text-amber-800">Configuration Required</p>
                <p className="text-sm text-amber-700 mt-1">
                  OAuth credentials need to be configured on the server before you can connect to {selectedProvider?.name}.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Setup Steps:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              {selectedProvider?.setup?.steps.map((step, index) => (
                <li key={index} className="pl-1">{step}</li>
              ))}
            </ol>
          </div>

          {selectedProvider?.setup?.console_url && (
            <div className="flex space-x-3">
              <a
                href={selectedProvider.setup.console_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Developer Console
              </a>
              {selectedProvider?.setup?.docs_url && (
                <a
                  href={selectedProvider.setup.docs_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  View Documentation
                </a>
              )}
            </div>
          )}
        </div>
        <ModalFooter>
          <button
            onClick={() => {
              setShowSetupModal(false)
              setSelectedProvider(null)
            }}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Close
          </button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm && !!selectedConnection}
        onClose={() => setShowDeleteConfirm(false)}
        title="Remove Connection?"
        size="sm"
      >
        <p className="text-gray-500 mb-4">
          Are you sure you want to remove your {selectedConnection?.provider} connection
          {selectedConnection?.provider_email && ` (${selectedConnection.provider_email})`}?
          You'll need to reconnect to use this service again.
        </p>
        <ModalFooter>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {deleting ? 'Removing...' : 'Remove'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
