import { useState, useEffect } from 'react'
import { User as UserIcon, Users, Globe } from 'lucide-react'
import { api, User, Team, Queue } from '../services/api'

export type ApproverType = 'user' | 'team' | 'anyone'

interface ApproverSelectorProps {
  approverType: ApproverType | null
  approverId: string | null
  approverQueueId: string | null
  onChange: (type: ApproverType | null, id: string | null, queueId: string | null) => void
  disabled?: boolean
  className?: string
}

export default function ApproverSelector({
  approverType,
  approverId,
  approverQueueId,
  onChange,
  disabled = false,
  className = '',
}: ApproverSelectorProps) {
  const [users, setUsers] = useState<User[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [queues, setQueues] = useState<Queue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersData, teamsData, queuesData] = await Promise.all([
          api.getUsers(),
          api.getTeams(),
          api.getQueues(),
        ])
        setUsers(usersData)
        setTeams(teamsData)
        setQueues(queuesData)
      } catch (err) {
        console.error('Failed to fetch approver data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleTypeChange = (type: ApproverType | null) => {
    if (type === null) {
      onChange(null, null, null)
    } else if (type === 'anyone') {
      // For "anyone", we don't need a specific ID
      const anyoneQueues = queues.filter(q => q.scope_type === 'organization' && q.system_type === 'approvals')
      onChange(type, null, anyoneQueues[0]?.id || anyoneQueues[0]?._id || null)
    } else {
      onChange(type, null, null)
    }
  }

  const handleIdChange = (id: string) => {
    // Find the approvals queue for this user/team
    const relevantQueues = queues.filter(q => {
      if (approverType === 'user') {
        return q.scope_type === 'user' && q.scope_id === id && q.system_type === 'approvals'
      }
      if (approverType === 'team') {
        return q.scope_type === 'team' && q.scope_id === id && q.system_type === 'approvals'
      }
      return false
    })
    onChange(approverType, id, relevantQueues[0]?.id || relevantQueues[0]?._id || null)
  }

  if (loading) {
    return <div className="text-sm text-theme-text-secondary">Loading...</div>
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Type selector */}
      <div>
        <label className="block text-sm font-medium text-theme-text-primary mb-2">
          Approver Type
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleTypeChange(approverType === null ? 'user' : null)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors
              ${approverType === null
                ? 'bg-theme-bg-elevated border-theme-border text-theme-text-secondary'
                : 'border-theme-border text-theme-text-secondary hover:bg-theme-bg-elevated'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            No Approval
          </button>
        </div>

        {approverType !== null && (
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleTypeChange('user')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors
                ${approverType === 'user'
                  ? 'bg-primary-50 border-primary-500 text-primary-700'
                  : 'border-theme-border text-theme-text-secondary hover:bg-theme-bg-elevated'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <UserIcon className="w-4 h-4" />
              User
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleTypeChange('team')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors
                ${approverType === 'team'
                  ? 'bg-primary-50 border-primary-500 text-primary-700'
                  : 'border-theme-border text-theme-text-secondary hover:bg-theme-bg-elevated'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <Users className="w-4 h-4" />
              Team
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleTypeChange('anyone')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors
                ${approverType === 'anyone'
                  ? 'bg-primary-50 border-primary-500 text-primary-700'
                  : 'border-theme-border text-theme-text-secondary hover:bg-theme-bg-elevated'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <Globe className="w-4 h-4" />
              Anyone
            </button>
          </div>
        )}
      </div>

      {/* ID selector (for user or team) */}
      {approverType && approverType !== 'anyone' && (
        <div>
          <label className="block text-sm font-medium text-theme-text-primary mb-2">
            Select {approverType === 'user' ? 'User' : 'Team'}
          </label>
          <select
            value={approverId || ''}
            onChange={(e) => handleIdChange(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 text-sm border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Select {approverType === 'user' ? 'a user' : 'a team'}...</option>
            {approverType === 'user' &&
              users.map((user) => (
                <option key={user.id || user._id} value={user.id || user._id}>
                  {user.name} ({user.email})
                </option>
              ))}
            {approverType === 'team' &&
              teams.map((team) => (
                <option key={team.id || team._id} value={team.id || team._id}>
                  {team.name}
                </option>
              ))}
          </select>
        </div>
      )}

      {/* Show selected approvals queue info */}
      {approverQueueId && (
        <div className="text-xs text-theme-text-secondary">
          Approval tasks will be sent to the approvals queue
        </div>
      )}
    </div>
  )
}
