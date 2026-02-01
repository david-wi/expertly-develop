/**
 * Infrastructure tests for nginx configuration files.
 *
 * These tests ensure nginx configs across all frontend apps follow best practices
 * and don't have known issues that cause problems in production.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Navigate from packages/ui/src/infrastructure to monorepo root
const MONOREPO_ROOT = join(__dirname, '../../../../')

// Find all nginx.conf files in frontend directories
function findNginxConfigs(): string[] {
  try {
    const result = execSync(
      'find apps -name "nginx.conf" -path "*/frontend/*" 2>/dev/null',
      { cwd: MONOREPO_ROOT, encoding: 'utf-8' }
    )
    return result.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

describe('nginx configuration', () => {
  const nginxConfigs = findNginxConfigs()

  it('should find nginx config files', () => {
    expect(nginxConfigs.length).toBeGreaterThan(0)
  })

  describe('cache headers', () => {
    /**
     * CRITICAL: The "expires -1" directive causes duplicate Cache-Control headers.
     *
     * When nginx has both:
     *   expires -1;
     *   add_header Cache-Control "no-store, no-cache...";
     *
     * It sends TWO Cache-Control headers:
     *   cache-control: no-cache          (from expires -1)
     *   cache-control: no-store, no-cache... (from add_header)
     *
     * This causes inconsistent browser behavior and caching issues.
     * Fix: Remove "expires -1" and use only explicit add_header directives.
     *
     * See: PR #77 for the fix that resolved this issue.
     */
    it.each(nginxConfigs)('%s should not use "expires -1" (causes duplicate Cache-Control headers)', (configPath) => {
      const fullPath = join(MONOREPO_ROOT, configPath)

      if (!existsSync(fullPath)) {
        throw new Error(`nginx.conf not found: ${fullPath}`)
      }

      const content = readFileSync(fullPath, 'utf-8')

      // Check for the problematic directive
      const hasExpiresMinus1 = /expires\s+-1/.test(content)

      expect(hasExpiresMinus1).toBe(false)
    })

    it.each(nginxConfigs)('%s should have explicit no-cache headers for HTML', (configPath) => {
      const fullPath = join(MONOREPO_ROOT, configPath)

      if (!existsSync(fullPath)) {
        throw new Error(`nginx.conf not found: ${fullPath}`)
      }

      const content = readFileSync(fullPath, 'utf-8')

      // Should have Cache-Control header for no-caching
      const hasCacheControl = /add_header\s+Cache-Control\s+["'].*no-cache/.test(content)

      expect(hasCacheControl).toBe(true)
    })
  })

  describe('SPA routing', () => {
    it.each(nginxConfigs)('%s should have SPA fallback to index.html', (configPath) => {
      const fullPath = join(MONOREPO_ROOT, configPath)

      if (!existsSync(fullPath)) {
        throw new Error(`nginx.conf not found: ${fullPath}`)
      }

      const content = readFileSync(fullPath, 'utf-8')

      // Should have try_files with index.html fallback for SPA routing
      const hasSpaFallback = /try_files\s+\$uri.*\/index\.html/.test(content)

      expect(hasSpaFallback).toBe(true)
    })
  })

  describe('static asset caching', () => {
    it.each(nginxConfigs)('%s should cache static assets with long expiry', (configPath) => {
      const fullPath = join(MONOREPO_ROOT, configPath)

      if (!existsSync(fullPath)) {
        throw new Error(`nginx.conf not found: ${fullPath}`)
      }

      const content = readFileSync(fullPath, 'utf-8')

      // Should have long cache for static assets (js, css, etc.)
      // Either via location block or general config
      const hasAssetCaching = /expires\s+1y|Cache-Control.*immutable/.test(content)

      expect(hasAssetCaching).toBe(true)
    })
  })

  describe('gzip compression', () => {
    it.each(nginxConfigs)('%s should enable gzip compression', (configPath) => {
      const fullPath = join(MONOREPO_ROOT, configPath)

      if (!existsSync(fullPath)) {
        throw new Error(`nginx.conf not found: ${fullPath}`)
      }

      const content = readFileSync(fullPath, 'utf-8')

      // Should have gzip enabled
      const hasGzip = /gzip\s+on/.test(content)

      expect(hasGzip).toBe(true)
    })
  })

  describe('API proxy configuration', () => {
    /**
     * CRITICAL: When using variables in proxy_pass, nginx does NOT perform
     * URI replacement like it does with static values.
     *
     * Example of BROKEN config (path gets truncated):
     *   set $backend_host define-backend;
     *   proxy_pass http://$backend_host:8000/api/;  # BAD: /api/v1/products -> /api/
     *
     * Example of CORRECT config (full path preserved):
     *   set $backend_host define-backend;
     *   proxy_pass http://$backend_host:8000;  # GOOD: /api/v1/products -> /api/v1/products
     *
     * When nginx sees a URI in proxy_pass (the /api/ part), it normally replaces
     * the matched location with that URI. But with variables, this replacement
     * doesn't happen, causing unexpected path truncation.
     *
     * See: PR #251 for the fix that resolved this issue in Expertly Define.
     */
    it.each(nginxConfigs)('%s should not use URI path with variable in proxy_pass (causes path truncation)', (configPath) => {
      const fullPath = join(MONOREPO_ROOT, configPath)

      if (!existsSync(fullPath)) {
        throw new Error(`nginx.conf not found: ${fullPath}`)
      }

      const content = readFileSync(fullPath, 'utf-8')

      // Find all proxy_pass directives that use variables
      // This regex matches: proxy_pass http://$variable:port/path;
      // where /path is any URI path (starts with /)
      const variableProxyPassWithUri = /proxy_pass\s+https?:\/\/\$[^;]+:\d+\/[^;]+;/g
      const matches = content.match(variableProxyPassWithUri)

      // If there are matches, they're problematic
      if (matches) {
        // Filter out matches that are just trailing slashes with no real path
        // e.g., http://$host:8000; is fine (no URI)
        // e.g., http://$host:8000/api/; is problematic (has URI path)
        const problematicMatches = matches.filter(m => {
          // Extract the path part after port
          const pathMatch = m.match(/:\d+(\/[^;]+)/)
          if (!pathMatch) return false
          const path = pathMatch[1]
          // A single trailing slash is borderline, but any path like /api/ is bad
          return path.length > 1
        })

        expect(problematicMatches).toEqual([])
      }
    })
  })
})
