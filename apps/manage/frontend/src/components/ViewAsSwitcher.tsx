import { useState, useEffect, useRef } from 'react'
import { ChevronDown, User, Users2, X } from 'lucide-react'
import { api, User as UserType, Team } from '../services/api'

export type ViewAsMode = 'default' | 'user' | 'team'

export interface ViewAsState {
  mode: ViewAsMode
  userId?: string
  teamId?: string
  userName?: string
  teamName?: string
}

const VIEW_AS_STORAGE_KEY = 'expertly-manage-view-as'

export function getViewAsState(): ViewAsState {
  const stored = localStorage.getItem(VIEW_AS_STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return { mode: 'default' }
    }
  }
  return { mode: 'default' }
}

export function setViewAsState(state: ViewAsState) {
  localStorage.setItem(VIEW_AS_STORAGE_KEY, JSON.stringify(state))
}

export function clearViewAsState() {
  localStorage.removeItem(VIEW_AS_STORAGE_KEY)
}

interface ViewAsSwitcherProps {
  onViewChange?: (state: ViewAsState) => void
}

export default function ViewAsSwitcher({ onViewChange }: ViewAsSwitcherProps) {
  const [users, setUsers] = useState<UserType[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [viewAs, setViewAs] = useState<ViewAsState>(getViewAsState())
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const userDropdownRef = useRef<HTMLDivElement>(null)
  const teamDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersData, teamsData] = await Promise.all([
          api.getUsers(),
          api.getTeams(),
        ])
        setUsers(usersData)
        setTeams(teamsData)
      } catch (error) {
        console.error('Failed to fetch users/teams:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false)
      }
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(event.target as Node)) {
        setIsTeamDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectUser = (user: UserType) => {
    const newState: ViewAsState = {
      mode: 'user',
      userId: user.id,
      userName: user.name,
    }
    setViewAs(newState)
    setViewAsState(newState)
    setIsUserDropdownOpen(false)
    onViewChange?.(newState)
  }

  const handleSelectTeam = (team: Team) => {
    const newState: ViewAsState = {
      mode: 'team',
      teamId: team.id,
      teamName: team.name,
    }
    setViewAs(newState)
    setViewAsState(newState)
    setIsTeamDropdownOpen(false)
    onViewChange?.(newState)
  }

  const handleClearView = () => {
    const newState: ViewAsState = { mode: 'default' }
    setViewAs(newState)
    clearViewAsState()
    onViewChange?.(newState)
  }

  if (loading) {
    return (
      <div className="px-3 py-2">
        <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="px-3 py-2 space-y-2">
      {/* Current View Indicator */}
      {viewAs.mode !== 'default' && (
        <div className="flex items-center justify-between px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg text-sm">
          <div className="flex items-center gap-2 text-primary-700">
            {viewAs.mode === 'user' ? (
              <>
                <User className="w-4 h-4" />
                <span className="font-medium">Viewing as {viewAs.userName}</span>
              </>
            ) : (
              <>
                <Users2 className="w-4 h-4" />
                <span className="font-medium">Viewing as {viewAs.teamName}</span>
              </>
            )}
          </div>
          <button
            onClick={handleClearView}
            className="p-1 hover:bg-primary-100 rounded transition-colors"
            title="Clear view"
          >
            <X className="w-4 h-4 text-primary-600" />
          </button>
        </div>
      )}

      {/* View as User Dropdown */}
      <div className="relative" ref={userDropdownRef}>
        <button
          onClick={() => {
            setIsUserDropdownOpen(!isUserDropdownOpen)
            setIsTeamDropdownOpen(false)
          }}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            viewAs.mode === 'user'
              ? 'bg-primary-100 text-primary-700 border border-primary-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>View as User or Bot</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isUserDropdownOpen && (
          <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
            {users.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No users found</div>
            ) : (
              users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${
                    viewAs.userId === user.id ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                  }`}
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <span className="truncate">{user.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* View as Team Dropdown */}
      <div className="relative" ref={teamDropdownRef}>
        <button
          onClick={() => {
            setIsTeamDropdownOpen(!isTeamDropdownOpen)
            setIsUserDropdownOpen(false)
          }}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            viewAs.mode === 'team'
              ? 'bg-primary-100 text-primary-700 border border-primary-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users2 className="w-4 h-4" />
            <span>View as Team</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${isTeamDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isTeamDropdownOpen && (
          <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
            {teams.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No teams found</div>
            ) : (
              teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => handleSelectTeam(team)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${
                    viewAs.teamId === team.id ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                  }`}
                >
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users2 className="w-3 h-3 text-blue-600" />
                  </div>
                  <span className="truncate">{team.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
