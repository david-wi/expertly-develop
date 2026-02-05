import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Modal, ModalFooter } from '@expertly/ui'
import {
  api,
  Monitor,
  MonitorEvent,
  CreateMonitorRequest,
  UpdateMonitorRequest,
  Connection,
  Playbook,
  Queue,
  Project,
  MonitorProviderType,
  SlackConfig,
  GmailConfig,
  OutlookConfig,
} from '../services/api'

const PROVIDER_LABELS: Record<MonitorProviderType, string> = {
  slack: 'Slack',
  google_drive: 'Google Drive',
  gmail: 'Gmail',
  outlook: 'Outlook',
  teamwork: 'Teamwork',
  github: 'GitHub',
}

const POLL_INTERVAL_OPTIONS = [
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
]

// Slack Events API Setup Guide Component
const SlackEventsSetupGuide = ({ isExpanded, onToggle }: { isExpanded: boolean; onToggle: () => void }) => {
  const [copiedUrl, setCopiedUrl] = useState(false)
  const webhookUrl = 'https://manage.ai.devintensive.com/api/v1/webhooks/slack'

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  return (
    <div className="mt-3 border border-amber-200 bg-amber-50 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-amber-100 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium text-amber-800">One-time Slack App Setup Required</span>
        </div>
        <svg
          className={`w-5 h-5 text-amber-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-sm text-amber-700">
            To receive real-time notifications when you're @mentioned, configure your Slack app's Events API:
          </p>

          {/* Step 1 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">Open your Slack App settings</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Go to{' '}
                  <a
                    href="https://api.slack.com/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    api.slack.com/apps
                  </a>{' '}
                  and select your app
                </p>
                {/* Visual mockup */}
                <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <div className="bg-[#4A154B] px-3 py-2 flex items-center space-x-2">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z"/>
                    </svg>
                    <span className="text-white text-sm font-medium">Slack API</span>
                  </div>
                  <div className="p-3">
                    <div className="flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded cursor-pointer hover:bg-gray-50">
                      <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center text-purple-600 font-bold text-xs">
                        EM
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">Expertly Manage</div>
                        <div className="text-xs text-gray-500">Your App</div>
                      </div>
                      <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">Navigate to Event Subscriptions</h4>
                <p className="text-sm text-gray-600 mt-1">
                  In the left sidebar, click <strong>"Event Subscriptions"</strong>
                </p>
                {/* Visual mockup */}
                <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <div className="flex">
                    <div className="w-48 bg-[#1a1d21] p-3 border-r border-gray-700">
                      <div className="space-y-1">
                        <div className="text-gray-400 text-xs px-2 py-1">Features</div>
                        <div className="text-gray-300 text-sm px-2 py-1.5 rounded hover:bg-gray-700">OAuth & Permissions</div>
                        <div className="text-white text-sm px-2 py-1.5 rounded bg-blue-600 flex items-center">
                          <span>Event Subscriptions</span>
                          <svg className="w-3 h-3 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="text-gray-300 text-sm px-2 py-1.5 rounded hover:bg-gray-700">Interactivity</div>
                      </div>
                    </div>
                    <div className="flex-1 p-3 bg-white">
                      <div className="text-lg font-medium text-gray-900">Event Subscriptions</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">Enable Events and set Request URL</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Toggle "Enable Events" to <strong>On</strong>, then paste this URL:
                </p>
                {/* Webhook URL copy box */}
                <div className="mt-2 flex items-center space-x-2">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono text-gray-800 border border-gray-200">
                    {webhookUrl}
                  </code>
                  <button
                    type="button"
                    onClick={copyWebhookUrl}
                    className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                      copiedUrl
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {copiedUrl ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
                {/* Visual mockup */}
                <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden bg-white p-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-gray-900">Enable Events</span>
                    <div className="w-12 h-6 bg-green-500 rounded-full relative">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">Request URL</label>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-50 border border-gray-300 rounded px-3 py-2 text-sm text-gray-600 font-mono truncate">
                        https://manage.ai.devintensive.com/api/v1/webhooks/slack
                      </div>
                      <span className="text-green-600 text-sm font-medium flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Verified
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                4
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">Subscribe to the app_mention event</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Scroll down to <strong>"Subscribe to bot events"</strong>, click "Add Bot User Event", and add:
                </p>
                {/* Visual mockup */}
                <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden bg-white p-3">
                  <div className="text-sm font-medium text-gray-900 mb-2">Subscribe to bot events</div>
                  <div className="bg-gray-50 border border-gray-200 rounded p-2">
                    <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded">
                      <div>
                        <div className="font-medium text-gray-900 text-sm">app_mention</div>
                        <div className="text-xs text-gray-500">Subscribe to only the message events that mention your app or bot</div>
                      </div>
                      <button type="button" className="text-red-500 hover:text-red-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <button type="button" className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
                    + Add Bot User Event
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                5
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">Save Changes</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Click the green <strong>"Save Changes"</strong> button at the bottom of the page. You're all set!
                </p>
                <div className="mt-3 flex items-center space-x-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Once configured, @mentions will create tasks instantly — no polling delay!</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const PROVIDER_ICONS: Record<MonitorProviderType, React.ReactNode> = {
  slack: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#E01E5A"/>
    </svg>
  ),
  gmail: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
  outlook: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 0h11.377v11.377H0V0zm12.623 0H24v11.377H12.623V0zM0 12.623h11.377V24H0V12.623zm12.623 0H24V24H12.623V12.623z" fill="#0078D4"/>
    </svg>
  ),
  google_drive: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
  teamwork: (
    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
      TW
    </div>
  ),
  github: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  ),
}

interface MonitorFormData {
  name: string
  description: string
  provider: MonitorProviderType
  connection_id: string
  playbook_id: string
  queue_id: string
  project_id: string
  poll_interval_seconds: number
  // Slack config
  slack_channel_ids: string
  slack_workspace_wide: boolean
  slack_my_mentions: boolean
  slack_keywords: string
  slack_context_messages: number
  // Gmail config
  gmail_folders: string
  gmail_from_addresses: string
  gmail_subject_contains: string
  gmail_unread_only: boolean
  // Outlook config
  outlook_folders: string
  outlook_from_addresses: string
  outlook_subject_contains: string
  outlook_unread_only: boolean
}

const defaultFormData: MonitorFormData = {
  name: '',
  description: '',
  provider: 'slack',
  connection_id: '',
  playbook_id: '',
  queue_id: '',
  project_id: '',
  poll_interval_seconds: 300,
  slack_channel_ids: '',
  slack_workspace_wide: false,
  slack_my_mentions: false,
  slack_keywords: '',
  slack_context_messages: 5,
  gmail_folders: 'INBOX',
  gmail_from_addresses: '',
  gmail_subject_contains: '',
  gmail_unread_only: true,
  outlook_folders: 'Inbox',
  outlook_from_addresses: '',
  outlook_subject_contains: '',
  outlook_unread_only: true,
}

export default function Monitors() {
  const [searchParams] = useSearchParams()
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [queues, setQueues] = useState<Queue[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEventsModal, setShowEventsModal] = useState(false)
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null)
  const [events, setEvents] = useState<MonitorEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)

  const [formData, setFormData] = useState<MonitorFormData>(defaultFormData)
  const [saving, setSaving] = useState(false)
  const [polling, setPolling] = useState<string | null>(null)
  const [showSlackSetupGuide, setShowSlackSetupGuide] = useState(false)

  // Notification state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const monitorId = searchParams.get('id')
    if (monitorId) {
      const monitor = monitors.find((m) => (m._id || m.id) === monitorId)
      if (monitor) setSelectedMonitor(monitor)
    }
  }, [searchParams, monitors])

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const loadData = async () => {
    setLoading(true)
    try {
      const [monitorsData, connectionsData, playbooksData, queuesData, projectsData] = await Promise.all([
        api.getMonitors(),
        api.getConnections(),
        api.getPlaybooks(),
        api.getQueues(),
        api.getProjects(),
      ])
      setMonitors(monitorsData)
      setConnections(connectionsData)
      setPlaybooks(playbooksData)
      setQueues(queuesData)
      setProjects(projectsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadEvents = async (monitorId: string) => {
    setLoadingEvents(true)
    try {
      const eventsData = await api.getMonitorEvents(monitorId, 50)
      setEvents(eventsData)
    } catch (error) {
      console.error('Failed to load events:', error)
    } finally {
      setLoadingEvents(false)
    }
  }

  const buildProviderConfig = (): SlackConfig | GmailConfig | OutlookConfig | Record<string, unknown> => {
    if (formData.provider === 'slack') {
      return {
        channel_ids: formData.slack_channel_ids
          ? formData.slack_channel_ids.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        workspace_wide: formData.slack_workspace_wide || formData.slack_my_mentions,
        my_mentions: formData.slack_my_mentions,
        keywords: formData.slack_keywords
          ? formData.slack_keywords.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        context_messages: formData.slack_context_messages,
      }
    }
    if (formData.provider === 'gmail') {
      return {
        folders: formData.gmail_folders
          ? formData.gmail_folders.split(',').map((s) => s.trim()).filter(Boolean)
          : ['INBOX'],
        from_addresses: formData.gmail_from_addresses
          ? formData.gmail_from_addresses.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        subject_contains: formData.gmail_subject_contains
          ? formData.gmail_subject_contains.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        unread_only: formData.gmail_unread_only,
      }
    }
    if (formData.provider === 'outlook') {
      return {
        folders: formData.outlook_folders
          ? formData.outlook_folders.split(',').map((s) => s.trim()).filter(Boolean)
          : ['Inbox'],
        from_addresses: formData.outlook_from_addresses
          ? formData.outlook_from_addresses.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        subject_contains: formData.outlook_subject_contains
          ? formData.outlook_subject_contains.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        unread_only: formData.outlook_unread_only,
      }
    }
    return {}
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setNotification({ type: 'error', message: 'Please enter a name for the monitor' })
      return
    }
    if (!formData.connection_id) {
      setNotification({ type: 'error', message: 'Please select a connection' })
      return
    }

    setSaving(true)
    try {
      const request: CreateMonitorRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        provider: formData.provider,
        connection_id: formData.connection_id,
        provider_config: buildProviderConfig(),
        playbook_id: formData.playbook_id || undefined,
        queue_id: formData.queue_id || undefined,
        project_id: formData.project_id || undefined,
        poll_interval_seconds: formData.poll_interval_seconds,
      }
      await api.createMonitor(request)
      await loadData()
      setShowCreateModal(false)
      setFormData(defaultFormData)
      setNotification({ type: 'success', message: 'Monitor created successfully' })
    } catch (error) {
      console.error('Failed to create monitor:', error)
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create monitor',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMonitor || !formData.name.trim()) return

    const monitorId = selectedMonitor._id || selectedMonitor.id
    setSaving(true)
    try {
      const request: UpdateMonitorRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        provider_config: buildProviderConfig(),
        playbook_id: formData.playbook_id || undefined,
        queue_id: formData.queue_id || undefined,
        project_id: formData.project_id || undefined,
        poll_interval_seconds: formData.poll_interval_seconds,
      }
      await api.updateMonitor(monitorId, request)
      await loadData()
      setShowEditModal(false)
      setSelectedMonitor(null)
      setNotification({ type: 'success', message: 'Monitor updated successfully' })
    } catch (error) {
      console.error('Failed to update monitor:', error)
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update monitor',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedMonitor) return

    const monitorId = selectedMonitor._id || selectedMonitor.id
    setSaving(true)
    try {
      await api.deleteMonitor(monitorId)
      await loadData()
      setShowDeleteConfirm(false)
      setSelectedMonitor(null)
      setNotification({ type: 'success', message: 'Monitor deleted successfully' })
    } catch (error) {
      console.error('Failed to delete monitor:', error)
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete monitor',
      })
    } finally {
      setSaving(false)
    }
  }

  const handlePoll = async (monitor: Monitor) => {
    const monitorId = monitor._id || monitor.id
    setPolling(monitorId)
    try {
      const result = await api.pollMonitor(monitorId)
      await loadData()
      setNotification({
        type: 'success',
        message: `Poll complete: ${result.events_found} events found, ${result.playbooks_triggered} playbooks triggered`,
      })
    } catch (error) {
      console.error('Failed to poll monitor:', error)
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to poll monitor',
      })
    } finally {
      setPolling(null)
    }
  }

  const handlePauseResume = async (monitor: Monitor) => {
    const monitorId = monitor._id || monitor.id
    try {
      if (monitor.status === 'active') {
        await api.pauseMonitor(monitorId)
        setNotification({ type: 'success', message: 'Monitor paused' })
      } else {
        await api.resumeMonitor(monitorId)
        setNotification({ type: 'success', message: 'Monitor resumed' })
      }
      await loadData()
    } catch (error) {
      console.error('Failed to pause/resume monitor:', error)
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update monitor status',
      })
    }
  }

  const openEditModal = (monitor: Monitor) => {
    setSelectedMonitor(monitor)
    const slackConfig = monitor.provider_config as SlackConfig
    const gmailConfig = monitor.provider_config as GmailConfig
    const outlookConfig = monitor.provider_config as OutlookConfig
    setFormData({
      name: monitor.name,
      description: monitor.description || '',
      provider: monitor.provider,
      connection_id: monitor.connection_id,
      playbook_id: monitor.playbook_id || '',
      queue_id: monitor.queue_id || '',
      project_id: monitor.project_id || '',
      poll_interval_seconds: monitor.poll_interval_seconds,
      // Slack
      slack_channel_ids: slackConfig?.channel_ids?.join(', ') || '',
      slack_workspace_wide: slackConfig?.workspace_wide || false,
      slack_my_mentions: slackConfig?.my_mentions || false,
      slack_keywords: slackConfig?.keywords?.join(', ') || '',
      slack_context_messages: slackConfig?.context_messages || 5,
      // Gmail
      gmail_folders: gmailConfig?.folders?.join(', ') || 'INBOX',
      gmail_from_addresses: gmailConfig?.from_addresses?.join(', ') || '',
      gmail_subject_contains: gmailConfig?.subject_contains?.join(', ') || '',
      gmail_unread_only: gmailConfig?.unread_only ?? true,
      // Outlook
      outlook_folders: outlookConfig?.folders?.join(', ') || 'Inbox',
      outlook_from_addresses: outlookConfig?.from_addresses?.join(', ') || '',
      outlook_subject_contains: outlookConfig?.subject_contains?.join(', ') || '',
      outlook_unread_only: outlookConfig?.unread_only ?? true,
    })
    setShowEditModal(true)
  }

  const openEventsModal = async (monitor: Monitor) => {
    setSelectedMonitor(monitor)
    setShowEventsModal(true)
    await loadEvents(monitor._id || monitor.id)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        )
      case 'paused':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            Paused
          </span>
        )
      case 'error':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
            Error
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getConnectionLabel = (connectionId: string, includeProvider = false) => {
    const connection = connections.find((c) => c.id === connectionId)
    if (!connection) return 'Unknown'
    // Build label with account name or email
    const accountLabel = connection.provider_account_name || connection.provider_email || connection.provider
    if (includeProvider) {
      const providerName = connection.provider.charAt(0).toUpperCase() + connection.provider.slice(1)
      return `${providerName} / ${accountLabel}`
    }
    return accountLabel
  }

  const getPlaybookLabel = (playbookId?: string) => {
    if (!playbookId) return 'Direct to inbox'
    const playbook = playbooks.find((p) => p.id === playbookId)
    return playbook?.name || 'Unknown'
  }

  // Filter connections by selected provider
  const filteredConnections = connections.filter((c) => {
    if (formData.provider === 'slack') return c.provider === 'slack'
    if (formData.provider === 'google_drive' || formData.provider === 'gmail') return c.provider === 'google'
    if (formData.provider === 'outlook') return c.provider === 'microsoft'
    if (formData.provider === 'teamwork') return c.provider === 'teamwork'
    return true
  })

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
            <button onClick={() => setNotification(null)} className="ml-2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--theme-text-heading)]">Monitors</h2>
          <p className="text-sm text-gray-500 mt-1">
            Watch external services and trigger playbooks when events are detected
          </p>
        </div>
        {connections.length > 0 ? (
          <button
            onClick={() => {
              setFormData(defaultFormData)
              setShowCreateModal(true)
            }}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 transition-colors"
          >
            New Monitor
          </button>
        ) : (
          <a
            href="/connections"
            className="inline-flex items-center px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Connection First
          </a>
        )}
      </div>

      {/* Monitors List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : monitors.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No monitors</h3>
            {connections.length > 0 ? (
              <>
                <p className="mt-1 text-sm text-gray-500">
                  Create a monitor to watch Slack, email, or other services for events.
                </p>
                <button
                  onClick={() => {
                    setFormData(defaultFormData)
                    setShowCreateModal(true)
                  }}
                  className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                >
                  Create your first monitor
                </button>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-gray-500">
                  You need to add a connection before you can create monitors.
                </p>
                <a
                  href="/connections"
                  className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add your first connection
                </a>
              </>
            )}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monitor
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Event
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Events
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {monitors.map((monitor) => {
                const monitorId = monitor._id || monitor.id
                return (
                  <tr key={monitorId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{monitor.name}</p>
                        {monitor.description && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">{monitor.description}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          Triggers: {getPlaybookLabel(monitor.playbook_id)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-700">{PROVIDER_LABELS[monitor.provider]}</span>
                        <p className="text-xs text-gray-500">{getConnectionLabel(monitor.connection_id)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {getStatusBadge(monitor.status)}
                        {monitor.last_error && (
                          <p className="text-xs text-red-500 mt-1 truncate max-w-xs" title={monitor.last_error}>
                            {monitor.last_error}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500">{formatDate(monitor.last_event_at)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openEventsModal(monitor)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        {monitor.events_detected}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handlePoll(monitor)}
                        disabled={polling === monitorId || monitor.status === 'paused'}
                        className="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
                      >
                        {polling === monitorId ? 'Polling...' : 'Poll'}
                      </button>
                      <button
                        onClick={() => handlePauseResume(monitor)}
                        className="text-yellow-600 hover:text-yellow-800 text-sm"
                      >
                        {monitor.status === 'active' ? 'Pause' : 'Resume'}
                      </button>
                      <button onClick={() => openEditModal(monitor)} className="text-gray-600 hover:text-gray-800 text-sm">
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setSelectedMonitor(monitor)
                          setShowDeleteConfirm(true)
                        }}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal || showEditModal}
        onClose={() => {
          setShowCreateModal(false)
          setShowEditModal(false)
          setSelectedMonitor(null)
          setShowSlackSetupGuide(false)
        }}
        title={showCreateModal ? 'Create Monitor' : 'Edit Monitor'}
      >
        <form onSubmit={showCreateModal ? handleCreate : handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g., Slack Support Requests"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
              placeholder="What does this monitor watch for?"
            />
          </div>

          {showCreateModal && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Provider *</label>
              <div className="grid grid-cols-3 gap-3">
                {(Object.entries(PROVIDER_LABELS) as [MonitorProviderType, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData({ ...formData, provider: value, connection_id: '' })}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                      formData.provider === value
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={formData.provider === value ? 'text-blue-600' : 'text-gray-600'}>
                      {PROVIDER_ICONS[value]}
                    </div>
                    <span className={`mt-2 text-xs font-medium ${
                      formData.provider === value ? 'text-blue-700' : 'text-gray-700'
                    }`}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Connection *</label>
            <select
              value={formData.connection_id}
              onChange={(e) => setFormData({ ...formData, connection_id: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={!showCreateModal}
            >
              <option value="">Select a connection</option>
              {filteredConnections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {getConnectionLabel(conn.id, true)}
                </option>
              ))}
            </select>
            {filteredConnections.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No {PROVIDER_LABELS[formData.provider]} connections found.{' '}
                <a href="/connections" className="underline">
                  Add one first
                </a>
              </p>
            )}
          </div>

          {/* Slack-specific config */}
          {formData.provider === 'slack' && (
            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Slack Settings</h4>

              <div className="flex items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <input
                  type="checkbox"
                  id="my_mentions"
                  checked={formData.slack_my_mentions}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      slack_my_mentions: e.target.checked,
                      // Auto-clear channel filters when my_mentions is enabled
                      slack_channel_ids: e.target.checked ? '' : formData.slack_channel_ids,
                    })
                    // Auto-expand setup guide when enabling my_mentions
                    if (e.target.checked) {
                      setShowSlackSetupGuide(true)
                    }
                  }}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <div className="ml-2">
                  <label htmlFor="my_mentions" className="text-sm font-medium text-blue-800">
                    Monitor my @mentions (recommended)
                  </label>
                  <p className="text-xs text-blue-600">
                    Real-time notifications when someone mentions you — no polling delay!
                  </p>
                </div>
              </div>

              {/* Slack Events API Setup Guide */}
              {formData.slack_my_mentions && (
                <SlackEventsSetupGuide
                  isExpanded={showSlackSetupGuide}
                  onToggle={() => setShowSlackSetupGuide(!showSlackSetupGuide)}
                />
              )}

              {!formData.slack_my_mentions && (
                <>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Channel IDs (comma-separated)</label>
                    <input
                      type="text"
                      value={formData.slack_channel_ids}
                      onChange={(e) => setFormData({ ...formData, slack_channel_ids: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="C01234567, C07654321"
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave empty if watching all channels</p>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="workspace_wide"
                      checked={formData.slack_workspace_wide}
                      onChange={(e) => setFormData({ ...formData, slack_workspace_wide: e.target.checked })}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <label htmlFor="workspace_wide" className="ml-2 text-sm text-gray-700">
                      Monitor all channels (workspace-wide)
                    </label>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm text-gray-700 mb-1">Keywords (comma-separated)</label>
                <input
                  type="text"
                  value={formData.slack_keywords}
                  onChange={(e) => setFormData({ ...formData, slack_keywords: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="help, support, urgent"
                />
                <p className="text-xs text-gray-500 mt-1">Only capture messages containing these keywords</p>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Context messages</label>
                <input
                  type="number"
                  value={formData.slack_context_messages}
                  onChange={(e) => setFormData({ ...formData, slack_context_messages: parseInt(e.target.value) || 0 })}
                  className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm"
                  min={0}
                  max={20}
                />
                <p className="text-xs text-gray-500 mt-1">Number of surrounding messages to capture</p>
              </div>
            </div>
          )}

          {/* Gmail-specific config */}
          {formData.provider === 'gmail' && (
            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Gmail Settings</h4>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Folders/Labels (comma-separated)</label>
                <input
                  type="text"
                  value={formData.gmail_folders}
                  onChange={(e) => setFormData({ ...formData, gmail_folders: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="INBOX, Important, Work"
                />
                <p className="text-xs text-gray-500 mt-1">Gmail folders or labels to monitor</p>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">From addresses (comma-separated)</label>
                <input
                  type="text"
                  value={formData.gmail_from_addresses}
                  onChange={(e) => setFormData({ ...formData, gmail_from_addresses: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="client@example.com, alerts@service.com"
                />
                <p className="text-xs text-gray-500 mt-1">Only capture emails from these senders</p>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Subject keywords (comma-separated)</label>
                <input
                  type="text"
                  value={formData.gmail_subject_contains}
                  onChange={(e) => setFormData({ ...formData, gmail_subject_contains: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="urgent, help, support"
                />
                <p className="text-xs text-gray-500 mt-1">Only capture emails with subjects containing these keywords</p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="gmail_unread_only"
                  checked={formData.gmail_unread_only}
                  onChange={(e) => setFormData({ ...formData, gmail_unread_only: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="gmail_unread_only" className="ml-2 text-sm text-gray-700">
                  Only monitor unread emails
                </label>
              </div>
            </div>
          )}

          {/* Outlook-specific config */}
          {formData.provider === 'outlook' && (
            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Outlook Settings</h4>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Folders (comma-separated)</label>
                <input
                  type="text"
                  value={formData.outlook_folders}
                  onChange={(e) => setFormData({ ...formData, outlook_folders: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="Inbox, Archive, Work"
                />
                <p className="text-xs text-gray-500 mt-1">Outlook folders to monitor (Inbox, Sent, Drafts, etc.)</p>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">From addresses (comma-separated)</label>
                <input
                  type="text"
                  value={formData.outlook_from_addresses}
                  onChange={(e) => setFormData({ ...formData, outlook_from_addresses: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="client@example.com, alerts@service.com"
                />
                <p className="text-xs text-gray-500 mt-1">Only capture emails from these senders</p>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Subject keywords (comma-separated)</label>
                <input
                  type="text"
                  value={formData.outlook_subject_contains}
                  onChange={(e) => setFormData({ ...formData, outlook_subject_contains: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="urgent, help, support"
                />
                <p className="text-xs text-gray-500 mt-1">Only capture emails with subjects containing these keywords</p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="outlook_unread_only"
                  checked={formData.outlook_unread_only}
                  onChange={(e) => setFormData({ ...formData, outlook_unread_only: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="outlook_unread_only" className="ml-2 text-sm text-gray-700">
                  Only monitor unread emails
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Playbook to Trigger (optional)</label>
            <select
              value={formData.playbook_id}
              onChange={(e) => setFormData({ ...formData, playbook_id: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">None - create tasks directly</option>
              {playbooks.map((pb) => (
                <option key={pb.id} value={pb.id}>
                  {pb.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to create tasks directly in your inbox without running a playbook
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Queue (optional)</label>
              <select
                value={formData.queue_id}
                onChange={(e) => setFormData({ ...formData, queue_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Default queue</option>
                {queues.map((q) => (
                  <option key={q._id || q.id} value={q._id || q.id}>
                    {q.purpose}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project (optional)</label>
              <select
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p._id || p.id} value={p._id || p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Poll Interval</label>
            <select
              value={formData.poll_interval_seconds}
              onChange={(e) => setFormData({ ...formData, poll_interval_seconds: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              {POLL_INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <ModalFooter>
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false)
                setShowEditModal(false)
                setSelectedMonitor(null)
                setShowSlackSetupGuide(false)
              }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => showCreateModal ? handleCreate(e) : handleUpdate(e)}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : showCreateModal ? 'Create' : 'Save'}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Events Modal */}
      <Modal
        isOpen={showEventsModal && !!selectedMonitor}
        onClose={() => {
          setShowEventsModal(false)
          setSelectedMonitor(null)
          setEvents([])
        }}
        title={`Events - ${selectedMonitor?.name}`}
        size="lg"
      >
        {loadingEvents ? (
          <div className="p-4 text-gray-500">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="p-4 text-gray-500">No events detected yet</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(event.provider_timestamp || event.created_at)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">{event.event_type}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 max-w-xs truncate">
                      {JSON.stringify(event.event_data).substring(0, 100)}...
                    </td>
                    <td className="px-3 py-2">
                      {event.processed ? (
                        <span className="text-xs text-green-600">Processed</span>
                      ) : (
                        <span className="text-xs text-gray-500">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ModalFooter>
          <button
            onClick={() => {
              setShowEventsModal(false)
              setSelectedMonitor(null)
              setEvents([])
            }}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Close
          </button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm && !!selectedMonitor}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Monitor?"
        size="sm"
      >
        <p className="text-gray-500 mb-4">
          Are you sure you want to delete "{selectedMonitor?.name}"? This will stop monitoring and remove all
          event history.
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
            disabled={saving}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Deleting...' : 'Delete'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
