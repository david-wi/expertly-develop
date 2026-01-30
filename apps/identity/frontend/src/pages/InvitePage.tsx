import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { Bot, UserPlus, ArrowRight, Building2 } from 'lucide-react'
import { getOrganizationId } from '../services/api'

type InviteType = 'bot' | 'user' | 'team' | 'organization' | null

export default function InvitePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [inviteType, setInviteType] = useState<InviteType>(null)
  const orgId = getOrganizationId()

  useEffect(() => {
    const type = searchParams.get('type')
    if (type === 'bot' || type === 'user' || type === 'team' || type === 'organization') {
      setInviteType(type)
    }
  }, [searchParams])

  const handleCreateBot = () => {
    if (orgId) {
      // Navigate to users page - the user can click "Add Bot" there
      navigate('/users')
    } else {
      // Need to select an org first
      navigate('/organizations')
    }
  }

  const handleCreateUser = () => {
    if (orgId) {
      navigate('/users')
    } else {
      navigate('/organizations')
    }
  }

  const getIcon = () => {
    switch (inviteType) {
      case 'bot':
        return <Bot className="w-16 h-16 text-primary-600" />
      case 'user':
        return <UserPlus className="w-16 h-16 text-blue-600" />
      case 'organization':
        return <Building2 className="w-16 h-16 text-gray-600" />
      default:
        return <UserPlus className="w-16 h-16 text-blue-600" />
    }
  }

  const getTitle = () => {
    switch (inviteType) {
      case 'bot':
        return 'Create a Bot'
      case 'user':
        return 'Join Organization'
      case 'team':
        return 'Join Team'
      case 'organization':
        return 'Create Organization'
      default:
        return 'Invitation'
    }
  }

  const getDescription = () => {
    switch (inviteType) {
      case 'bot':
        return 'Create an AI bot account for automated workflows and integrations.'
      case 'user':
        return 'You\'ve been invited to join an organization.'
      case 'team':
        return 'You\'ve been invited to join a team.'
      case 'organization':
        return 'Create a new organization to manage users and teams.'
      default:
        return 'Complete your invitation setup.'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            {getIcon()}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {getTitle()}
          </h1>

          <p className="text-gray-600 mb-8">
            {getDescription()}
          </p>

          {inviteType === 'bot' && (
            <div className="space-y-4">
              {!orgId && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 mb-4">
                  You'll need to select an organization first before creating a bot.
                </div>
              )}
              <button
                onClick={handleCreateBot}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                {orgId ? 'Go to Users & Create Bot' : 'Select Organization'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {inviteType === 'user' && (
            <div className="space-y-4">
              <button
                onClick={handleCreateUser}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {inviteType === 'organization' && (
            <div className="space-y-4">
              <Link
                to="/organizations"
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                View Organizations
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          )}

          {!inviteType && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 mb-4">
                This invitation link appears to be incomplete or invalid.
              </p>
              <Link
                to="/"
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Go to Dashboard
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100">
            <Link
              to="/"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Back to Expertly Identity
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
