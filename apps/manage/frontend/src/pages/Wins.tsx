import { useEffect, useState, useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import { api, Task, User as UserType, Team, Playbook } from '../services/api'
import { Trophy, Star, TrendingUp, Users, User, Users2, BookOpen, ChevronDown, ChevronRight, BotMessageSquare, X } from 'lucide-react'

type TimeFilter = 'today' | 'week' | 'month'
type GroupBy = 'none' | 'user' | 'queue' | 'team'
type UserTypeFilter = 'all' | 'human' | 'virtual'

interface PlaybookNode {
  playbook: Playbook
  children: PlaybookNode[]
}

export default function Wins() {
  const { user, queues, tasks, loading, fetchUser, fetchQueues, fetchTasks } = useAppStore()
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')

  // New filter states
  const [userTypeFilter, setUserTypeFilter] = useState<UserTypeFilter>('all')
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null)

  // Data for filters
  const [allUsers, setAllUsers] = useState<UserType[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])

  // Dropdown states
  const [showPlaybookDropdown, setShowPlaybookDropdown] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchUser()
    fetchQueues()
    fetchTasks()

    // Fetch additional data for filters
    const fetchFilterData = async () => {
      try {
        const [usersData, teamsData, playbooksData] = await Promise.all([
          api.getUsers(),
          api.getTeams(),
          api.getPlaybooks(),
        ])
        setAllUsers(usersData)
        setTeams(teamsData)
        setPlaybooks(playbooksData)
      } catch (error) {
        console.error('Failed to fetch filter data:', error)
      }
    }
    fetchFilterData()
  }, [fetchUser, fetchQueues, fetchTasks])

  // Build hierarchical playbook structure
  const playbookTree = useMemo(() => {
    const rootNodes: PlaybookNode[] = []
    const nodeMap = new Map<string, PlaybookNode>()

    // Create nodes for all playbooks
    playbooks.forEach(pb => {
      nodeMap.set(pb.id, { playbook: pb, children: [] })
    })

    // Build tree structure
    playbooks.forEach(pb => {
      const node = nodeMap.get(pb.id)!
      if (pb.parent_id && nodeMap.has(pb.parent_id)) {
        nodeMap.get(pb.parent_id)!.children.push(node)
      } else {
        rootNodes.push(node)
      }
    })

    // Sort by order_index
    const sortNodes = (nodes: PlaybookNode[]) => {
      nodes.sort((a, b) => a.playbook.order_index - b.playbook.order_index)
      nodes.forEach(n => sortNodes(n.children))
    }
    sortNodes(rootNodes)

    return rootNodes
  }, [playbooks])

  // Create a map of user ID to user for lookups
  const userMap = useMemo(() => {
    const map = new Map<string, UserType>()
    allUsers.forEach(u => map.set(u.id, u))
    return map
  }, [allUsers])

  // Create a map of user ID to team(s) for lookups
  const userTeamMap = useMemo(() => {
    const map = new Map<string, Team[]>()
    teams.forEach(team => {
      team.member_ids.forEach(memberId => {
        if (!map.has(memberId)) {
          map.set(memberId, [])
        }
        map.get(memberId)!.push(team)
      })
    })
    return map
  }, [teams])

  const getDateRange = (filter: TimeFilter): { start: Date; end: Date } => {
    const now = new Date()
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)

    const start = new Date(now)
    start.setHours(0, 0, 0, 0)

    if (filter === 'week') {
      const dayOfWeek = start.getDay()
      start.setDate(start.getDate() - dayOfWeek)
    } else if (filter === 'month') {
      start.setDate(1)
    }

    return { start, end }
  }

  const { start, end } = getDateRange(timeFilter)

  // Apply all filters to tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Status filter
      if (t.status !== 'completed') return false

      // Time filter
      const completedDate = new Date(t.updated_at)
      if (completedDate < start || completedDate > end) return false

      // User type filter
      if (userTypeFilter !== 'all' && t.assigned_to_id) {
        const assignedUser = userMap.get(t.assigned_to_id)
        if (assignedUser && assignedUser.user_type !== userTypeFilter) return false
      }

      // Team filter
      if (selectedTeamId && t.assigned_to_id) {
        const userTeams = userTeamMap.get(t.assigned_to_id) || []
        if (!userTeams.some(team => team.id === selectedTeamId)) return false
      }

      // Playbook filter - filter by task.playbook_id
      if (selectedPlaybookId && t.playbook_id !== selectedPlaybookId) return false

      return true
    })
  }, [tasks, start, end, userTypeFilter, selectedTeamId, userMap, userTeamMap])

  const groupTasks = (tasksToGroup: Task[]): Map<string, Task[]> => {
    const grouped = new Map<string, Task[]>()

    if (groupBy === 'none') {
      grouped.set('all', tasksToGroup)
      return grouped
    }

    tasksToGroup.forEach((task) => {
      let key: string
      if (groupBy === 'user') {
        const assignedUser = task.assigned_to_id ? userMap.get(task.assigned_to_id) : null
        key = assignedUser?.name || task.assigned_to_id || 'Unassigned'
      } else if (groupBy === 'team') {
        if (task.assigned_to_id) {
          const userTeams = userTeamMap.get(task.assigned_to_id) || []
          key = userTeams.length > 0 ? userTeams[0].name : 'No Team'
        } else {
          key = 'Unassigned'
        }
      } else {
        const queue = queues.find((q) => (q._id || q.id) === task.queue_id)
        key = queue?.purpose || 'Unknown Queue'
      }

      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(task)
    })

    return grouped
  }

  const groupedTasks = groupTasks(filteredTasks)

  const getTimeFilterLabel = (filter: TimeFilter): string => {
    switch (filter) {
      case 'today':
        return 'Today'
      case 'week':
        return 'This Week'
      case 'month':
        return 'This Month'
    }
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const renderPlaybookNode = (node: PlaybookNode, depth: number = 0): React.ReactNode => {
    const isGroup = node.playbook.item_type === 'group'
    const hasChildren = node.children.length > 0
    const isExpanded = expandedGroups.has(node.playbook.id)
    const isSelected = selectedPlaybookId === node.playbook.id

    return (
      <div key={node.playbook.id}>
        <button
          onClick={() => {
            if (isGroup && hasChildren) {
              toggleGroupExpanded(node.playbook.id)
            }
            setSelectedPlaybookId(node.playbook.id)
            if (!isGroup || !hasChildren) {
              setShowPlaybookDropdown(false)
            }
          }}
          className={`w-full flex items-center px-3 py-2 text-sm hover:bg-gray-100 ${
            isSelected ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {isGroup && hasChildren && (
            <span className="mr-1">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          )}
          {!isGroup && <BookOpen className="h-4 w-4 mr-2 text-gray-400" />}
          {isGroup && <span className="mr-2 text-gray-400">📁</span>}
          <span className="truncate">{node.playbook.name}</span>
        </button>
        {isGroup && hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderPlaybookNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const getSelectedPlaybookName = (): string => {
    if (!selectedPlaybookId) return 'All Playbooks'
    const pb = playbooks.find(p => p.id === selectedPlaybookId)
    return pb?.name || 'All Playbooks'
  }

  const clearFilters = () => {
    setUserTypeFilter('all')
    setSelectedTeamId(null)
    setSelectedPlaybookId(null)
  }

  const hasActiveFilters = userTypeFilter !== 'all' || selectedTeamId !== null || selectedPlaybookId !== null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Trophy className="h-8 w-8 text-yellow-500" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Wins</h2>
            <p className="text-sm text-gray-500">Celebrate what you've accomplished</p>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => setTimeFilter('today')}
          className={`bg-white shadow rounded-lg p-4 cursor-pointer transition-all ${
            timeFilter === 'today' ? 'ring-2 ring-yellow-400' : 'hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Today</p>
              <p className="text-3xl font-bold text-green-600">
                {tasks.filter((t) => {
                  if (t.status !== 'completed') return false
                  const today = new Date().toDateString()
                  return new Date(t.updated_at).toDateString() === today
                }).length}
              </p>
            </div>
            <Star className="h-8 w-8 text-gray-300" />
          </div>
        </div>
        <div
          onClick={() => setTimeFilter('week')}
          className={`bg-white shadow rounded-lg p-4 cursor-pointer transition-all ${
            timeFilter === 'week' ? 'ring-2 ring-yellow-400' : 'hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">This Week</p>
              <p className="text-3xl font-bold text-green-600">
                {tasks.filter((t) => {
                  if (t.status !== 'completed') return false
                  const now = new Date()
                  const weekStart = new Date(now)
                  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
                  weekStart.setHours(0, 0, 0, 0)
                  return new Date(t.updated_at) >= weekStart
                }).length}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-gray-300" />
          </div>
        </div>
        <div
          onClick={() => setTimeFilter('month')}
          className={`bg-white shadow rounded-lg p-4 cursor-pointer transition-all ${
            timeFilter === 'month' ? 'ring-2 ring-yellow-400' : 'hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">This Month</p>
              <p className="text-3xl font-bold text-green-600">
                {tasks.filter((t) => {
                  if (t.status !== 'completed') return false
                  const now = new Date()
                  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
                  return new Date(t.updated_at) >= monthStart
                }).length}
              </p>
            </div>
            <Trophy className="h-8 w-8 text-gray-300" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4 space-y-4">
        {/* Group By */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Group by:</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button
                onClick={() => setGroupBy('none')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  groupBy === 'none'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setGroupBy('user')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 flex items-center space-x-1 ${
                  groupBy === 'user'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <User className="h-4 w-4" />
                <span>By Person</span>
              </button>
              <button
                onClick={() => setGroupBy('team')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 flex items-center space-x-1 ${
                  groupBy === 'team'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Users2 className="h-4 w-4" />
                <span>By Team</span>
              </button>
              <button
                onClick={() => setGroupBy('queue')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 flex items-center space-x-1 ${
                  groupBy === 'queue'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>By Queue</span>
              </button>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Showing <span className="font-medium text-gray-900">{filteredTasks.length}</span> completed tasks for {getTimeFilterLabel(timeFilter).toLowerCase()}
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center flex-wrap gap-3 pt-2 border-t border-gray-100">
          <span className="text-sm font-medium text-gray-700">Filter:</span>

          {/* User Type Filter */}
          <select
            value={userTypeFilter}
            onChange={(e) => setUserTypeFilter(e.target.value as UserTypeFilter)}
            className={`px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              userTypeFilter !== 'all' ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-white'
            }`}
          >
            <option value="all">All Types</option>
            <option value="human">Humans Only</option>
            <option value="virtual">Bots Only</option>
          </select>

          {/* Team Filter */}
          <select
            value={selectedTeamId || ''}
            onChange={(e) => setSelectedTeamId(e.target.value || null)}
            className={`px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              selectedTeamId ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-white'
            }`}
          >
            <option value="">All Teams</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>

          {/* Playbook Filter (Hierarchical) */}
          <div className="relative">
            <button
              onClick={() => setShowPlaybookDropdown(!showPlaybookDropdown)}
              className={`px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 flex items-center space-x-2 ${
                selectedPlaybookId ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-white'
              }`}
            >
              <BookOpen className="h-4 w-4 text-gray-400" />
              <span className="max-w-32 truncate">{getSelectedPlaybookName()}</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {showPlaybookDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowPlaybookDropdown(false)}
                />
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedPlaybookId(null)
                      setShowPlaybookDropdown(false)
                    }}
                    className={`w-full flex items-center px-3 py-2 text-sm hover:bg-gray-100 ${
                      !selectedPlaybookId ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                    }`}
                  >
                    All Playbooks
                  </button>
                  <div className="border-t border-gray-100">
                    {playbookTree.map(node => renderPlaybookNode(node))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1"
            >
              <X className="h-4 w-4" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Wins List */}
      <div className="space-y-4">
        {loading.tasks ? (
          <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
            Loading your wins...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No completed tasks {getTimeFilterLabel(timeFilter).toLowerCase()}</p>
            <p className="text-sm text-gray-400 mt-1">
              {hasActiveFilters ? 'Try adjusting your filters' : 'Complete some tasks to see your wins here!'}
            </p>
          </div>
        ) : (
          Array.from(groupedTasks.entries()).map(([groupName, groupTasksList]) => (
            <div key={groupName} className="bg-white shadow rounded-lg overflow-hidden">
              {groupBy !== 'none' && (
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">{groupName}</h3>
                    <span className="text-sm text-gray-500">{groupTasksList.length} win{groupTasksList.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}
              <ul className="divide-y divide-gray-200">
                {groupTasksList.map((task) => {
                  const queue = queues.find((q) => (q._id || q.id) === task.queue_id)
                  const assignedUser = task.assigned_to_id ? userMap.get(task.assigned_to_id) : null
                  const isBot = assignedUser?.user_type === 'virtual'
                  return (
                    <li key={task._id || task.id} className="px-4 py-4 hover:bg-green-50 transition-colors">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100">
                            <Trophy className="h-3.5 w-3.5 text-green-600" />
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{task.title}</p>
                          {task.description && (
                            <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-400">
                            <span>Completed {formatDate(task.updated_at)}</span>
                            {queue && <span>• {queue.purpose}</span>}
                            {assignedUser && groupBy !== 'user' && (
                              <span className="flex items-center">
                                • {isBot && <BotMessageSquare className="h-3 w-3 mr-1" />}
                                {assignedUser.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* Motivation Footer */}
      {filteredTasks.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-green-50 rounded-lg p-6 text-center">
          <p className="text-lg font-medium text-gray-800">
            {filteredTasks.length === 1
              ? "Great job completing a task!"
              : filteredTasks.length < 5
              ? "You're making progress!"
              : filteredTasks.length < 10
              ? "Excellent work!"
              : "You're on fire! Amazing productivity!"}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Keep up the momentum {user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
          </p>
        </div>
      )}
    </div>
  )
}
