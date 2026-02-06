import { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, BookOpen, FolderClosed, X, Search } from 'lucide-react'
import { Playbook } from '../services/api'

interface PlaybookNode {
  playbook: Playbook
  children: PlaybookNode[]
}

interface PlaybookSelectorProps {
  playbooks: Playbook[]
  selectedPlaybookId: string | null
  onSelect: (playbook: Playbook | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  allowClear?: boolean
}

export default function PlaybookSelector({
  playbooks,
  selectedPlaybookId,
  onSelect,
  placeholder = 'Select a playbook...',
  disabled = false,
  className = '',
  allowClear = true,
}: PlaybookSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  // Build hierarchical tree with alphabetical sorting within groups
  const playbookTree = useMemo(() => {
    const rootNodes: PlaybookNode[] = []
    const nodeMap = new Map<string, PlaybookNode>()

    // Create nodes for all playbooks
    playbooks.forEach((pb) => {
      nodeMap.set(pb.id, { playbook: pb, children: [] })
    })

    // Build tree structure
    playbooks.forEach((pb) => {
      const node = nodeMap.get(pb.id)!
      if (pb.parent_id && nodeMap.has(pb.parent_id)) {
        nodeMap.get(pb.parent_id)!.children.push(node)
      } else {
        rootNodes.push(node)
      }
    })

    // Sort alphabetically within each level (groups first, then playbooks, both alphabetically)
    const sortNodes = (nodes: PlaybookNode[]) => {
      nodes.sort((a, b) => {
        // Groups come before playbooks
        const aIsGroup = a.playbook.item_type === 'group'
        const bIsGroup = b.playbook.item_type === 'group'
        if (aIsGroup !== bIsGroup) {
          return aIsGroup ? -1 : 1
        }
        // Within same type, sort alphabetically
        return a.playbook.name.localeCompare(b.playbook.name)
      })
      nodes.forEach((n) => sortNodes(n.children))
    }
    sortNodes(rootNodes)

    return rootNodes
  }, [playbooks])

  // Filter tree based on search
  const filteredTree = useMemo(() => {
    if (!search.trim()) return playbookTree

    const searchLower = search.toLowerCase()

    // Recursively filter nodes - keep a node if it matches or has matching descendants
    const filterNodes = (nodes: PlaybookNode[]): PlaybookNode[] => {
      return nodes
        .map((node) => {
          const nameMatches = node.playbook.name.toLowerCase().includes(searchLower)
          const filteredChildren = filterNodes(node.children)

          // Keep node if name matches or it has matching children
          if (nameMatches || filteredChildren.length > 0) {
            return {
              ...node,
              children: filteredChildren,
            }
          }
          return null
        })
        .filter((node): node is PlaybookNode => node !== null)
    }

    return filterNodes(playbookTree)
  }, [playbookTree, search])

  // Auto-expand groups that contain search matches
  useEffect(() => {
    if (search.trim()) {
      const groupsToExpand = new Set<string>()
      const findMatchingGroups = (nodes: PlaybookNode[], parentIds: string[] = []) => {
        nodes.forEach((node) => {
          const currentPath = [...parentIds, node.playbook.id]
          if (node.playbook.name.toLowerCase().includes(search.toLowerCase())) {
            // Expand all parent groups
            parentIds.forEach((id) => groupsToExpand.add(id))
          }
          if (node.children.length > 0) {
            findMatchingGroups(node.children, currentPath)
          }
        })
      }
      findMatchingGroups(filteredTree)
      setExpandedGroups(groupsToExpand)
    }
  }, [search, filteredTree])

  const selectedPlaybook = useMemo(() => {
    return playbooks.find((p) => p.id === selectedPlaybookId)
  }, [playbooks, selectedPlaybookId])

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const handleSelect = (playbook: Playbook) => {
    if (playbook.item_type === 'group') {
      toggleGroup(playbook.id)
      return
    }
    onSelect(playbook)
    setIsOpen(false)
    setSearch('')
  }

  const handleClear = () => {
    onSelect(null)
    setSearch('')
  }

  const renderNode = (node: PlaybookNode, depth: number = 0): React.ReactNode => {
    const isGroup = node.playbook.item_type === 'group'
    const hasChildren = node.children.length > 0
    const isExpanded = expandedGroups.has(node.playbook.id)
    const isSelected = selectedPlaybookId === node.playbook.id

    return (
      <div key={node.playbook.id}>
        <button
          type="button"
          onClick={() => handleSelect(node.playbook)}
          className={`w-full flex items-center px-3 py-2 text-sm hover:bg-gray-100 ${
            isSelected && !isGroup ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {isGroup && hasChildren && (
            <span className="mr-1 text-gray-400">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          )}
          {isGroup && <FolderClosed className="h-4 w-4 mr-2 text-gray-400" />}
          {!isGroup && <BookOpen className="h-4 w-4 mr-2 text-gray-400" />}
          <span className="truncate">{node.playbook.name}</span>
        </button>
        {isGroup && hasChildren && isExpanded && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected value display / trigger */}
      {selectedPlaybook ? (
        <div
          className={`flex items-center justify-between border border-gray-300 rounded-md px-3 py-2 bg-gray-50 ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <span className="text-gray-900 truncate">{selectedPlaybook.name}</span>
          {allowClear && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          className={`flex items-center border border-gray-300 rounded-md px-3 py-2 ${
            disabled ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'bg-white cursor-pointer'
          }`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <span className="text-gray-500">{placeholder}</span>
          <ChevronDown className="w-4 h-4 ml-auto text-gray-400" />
        </div>
      )}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Search playbooks..."
              />
            </div>
          </div>

          {/* Playbook tree */}
          <div className="max-h-64 overflow-auto">
            {filteredTree.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">No playbooks found</div>
            ) : (
              filteredTree.map((node) => renderNode(node))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
