import { describe, it, expect, vi } from 'vitest'
import { createDefaultUserMenu, type UserMenuItem, type UserMenuConfig } from './UserMenu'

describe('createDefaultUserMenu', () => {
  const mockOnLogout = vi.fn()

  it('should create a menu config with required sections', () => {
    const config = createDefaultUserMenu({ onLogout: mockOnLogout })

    expect(config.sections).toBeDefined()
    expect(config.sections.length).toBeGreaterThan(0)
  })

  it('should include profile section by default', () => {
    const config = createDefaultUserMenu({ onLogout: mockOnLogout })

    const profileItem = config.sections
      .flatMap(s => s.items)
      .find(item => item.id === 'profile')

    expect(profileItem).toBeDefined()
    expect(profileItem?.type).toBe('link')
    expect(profileItem?.href).toContain('identity.ai.devintensive.com')
    expect(profileItem?.external).toBe(true)
  })

  it('should exclude profile section when includeProfile is false', () => {
    const config = createDefaultUserMenu({
      onLogout: mockOnLogout,
      includeProfile: false,
    })

    const profileItem = config.sections
      .flatMap(s => s.items)
      .find(item => item.id === 'profile')

    expect(profileItem).toBeUndefined()
  })

  it('should include Developer Tools submenu', () => {
    const config = createDefaultUserMenu({ onLogout: mockOnLogout })

    const devTools = config.sections
      .flatMap(s => s.items)
      .find(item => item.id === 'developer-tools')

    expect(devTools).toBeDefined()
    expect(devTools?.type).toBe('submenu')
    expect(devTools?.children).toBeDefined()
    expect(devTools?.children?.length).toBeGreaterThan(0)
  })

  it('should have Error Logs as a child of Developer Tools', () => {
    const config = createDefaultUserMenu({ onLogout: mockOnLogout })

    const devTools = config.sections
      .flatMap(s => s.items)
      .find(item => item.id === 'developer-tools')

    const errorLogs = devTools?.children?.find(item => item.id === 'error-logs')
    expect(errorLogs).toBeDefined()
    expect(errorLogs?.type).toBe('link')
    expect(errorLogs?.href).toContain('admin.ai.devintensive.com/error-logs')
    expect(errorLogs?.external).toBe(true)
  })

  it('should have Backlog as a child of Developer Tools', () => {
    const config = createDefaultUserMenu({ onLogout: mockOnLogout })

    const devTools = config.sections
      .flatMap(s => s.items)
      .find(item => item.id === 'developer-tools')

    const backlog = devTools?.children?.find(item => item.id === 'backlog')
    expect(backlog).toBeDefined()
    expect(backlog?.type).toBe('link')
    expect(backlog?.href).toContain('manage.ai.devintensive.com/backlog')
    expect(backlog?.external).toBe(true)
  })

  it('should have Idea Backlog as a child of Developer Tools', () => {
    const config = createDefaultUserMenu({ onLogout: mockOnLogout })

    const devTools = config.sections
      .flatMap(s => s.items)
      .find(item => item.id === 'developer-tools')

    const ideaBacklog = devTools?.children?.find(item => item.id === 'idea-backlog')
    expect(ideaBacklog).toBeDefined()
    expect(ideaBacklog?.type).toBe('link')
    expect(ideaBacklog?.href).toContain('manage.ai.devintensive.com/idea-backlog')
    expect(ideaBacklog?.external).toBe(true)
  })

  it('should have Change Log as an internal link', () => {
    const config = createDefaultUserMenu({ onLogout: mockOnLogout })

    const devTools = config.sections
      .flatMap(s => s.items)
      .find(item => item.id === 'developer-tools')

    const changeLog = devTools?.children?.find(item => item.id === 'changelog')
    expect(changeLog).toBeDefined()
    expect(changeLog?.type).toBe('link')
    expect(changeLog?.href).toBe('/changelog')
    expect(changeLog?.external).toBe(false)
  })

  it('should include logout callback', () => {
    const config = createDefaultUserMenu({ onLogout: mockOnLogout })

    const logoutItem = config.sections
      .flatMap(s => s.items)
      .find(item => item.id === 'logout')

    expect(logoutItem).toBeDefined()
    expect(logoutItem?.type).toBe('callback')
    expect(logoutItem?.onClick).toBe(mockOnLogout)
  })

  it('should include version info when buildTimestamp is provided', () => {
    const config = createDefaultUserMenu({
      onLogout: mockOnLogout,
      buildTimestamp: '2026-01-29',
    })

    expect(config.versionInfo).toBeDefined()
    expect(config.versionInfo?.buildTime).toBe('2026-01-29')
  })

  it('should include version info when gitCommit is provided', () => {
    const config = createDefaultUserMenu({
      onLogout: mockOnLogout,
      gitCommit: 'abc123def456',
    })

    expect(config.versionInfo).toBeDefined()
    expect(config.versionInfo?.commit).toBe('abc123def456')
  })

  it('should not include version info when neither buildTimestamp nor gitCommit is provided', () => {
    const config = createDefaultUserMenu({ onLogout: mockOnLogout })

    expect(config.versionInfo).toBeUndefined()
  })
})

describe('UserMenuItem types', () => {
  it('should support link type with href', () => {
    const item: UserMenuItem = {
      id: 'test-link',
      label: 'Test Link',
      type: 'link',
      href: '/test',
    }
    expect(item.type).toBe('link')
    expect(item.href).toBe('/test')
  })

  it('should support callback type with onClick', () => {
    const onClick = vi.fn()
    const item: UserMenuItem = {
      id: 'test-callback',
      label: 'Test Callback',
      type: 'callback',
      onClick,
    }
    expect(item.type).toBe('callback')
    expect(item.onClick).toBe(onClick)
  })

  it('should support divider type', () => {
    const item: UserMenuItem = {
      id: 'test-divider',
      label: '',
      type: 'divider',
    }
    expect(item.type).toBe('divider')
  })

  it('should support submenu type with children', () => {
    const item: UserMenuItem = {
      id: 'test-submenu',
      label: 'Test Submenu',
      type: 'submenu',
      children: [
        {
          id: 'child-1',
          label: 'Child 1',
          type: 'link',
          href: '/child-1',
        },
      ],
    }
    expect(item.type).toBe('submenu')
    expect(item.children).toBeDefined()
    expect(item.children?.length).toBe(1)
    expect(item.children?.[0].id).toBe('child-1')
  })

  it('should support external links', () => {
    const item: UserMenuItem = {
      id: 'external-link',
      label: 'External',
      type: 'link',
      href: 'https://example.com',
      external: true,
    }
    expect(item.external).toBe(true)
  })
})

describe('UserMenuConfig structure', () => {
  it('should support multiple sections', () => {
    const config: UserMenuConfig = {
      sections: [
        {
          title: 'Section 1',
          items: [{ id: 'item-1', label: 'Item 1', type: 'link', href: '/1' }],
        },
        {
          title: 'Section 2',
          items: [{ id: 'item-2', label: 'Item 2', type: 'link', href: '/2' }],
        },
      ],
    }
    expect(config.sections.length).toBe(2)
    expect(config.sections[0].title).toBe('Section 1')
    expect(config.sections[1].title).toBe('Section 2')
  })

  it('should support sections without titles', () => {
    const config: UserMenuConfig = {
      sections: [
        {
          items: [{ id: 'item-1', label: 'Item 1', type: 'link', href: '/1' }],
        },
      ],
    }
    expect(config.sections[0].title).toBeUndefined()
  })
})
