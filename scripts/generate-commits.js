#!/usr/bin/env node

/**
 * Generate commits.json for each app's changelog page
 *
 * This script runs during deployment to extract git history for each app
 * and write it to the frontend's public folder for client-side fetching.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// App configurations with their paths
const apps = [
  { name: 'admin', path: 'apps/admin', output: 'apps/admin/frontend/public' },
  { name: 'define', path: 'apps/define', output: 'apps/define/frontend/public' },
  { name: 'develop', path: 'apps/develop', output: 'apps/develop/frontend/public' },
  { name: 'identity', path: 'apps/identity', output: 'apps/identity/frontend/public' },
  { name: 'manage', path: 'apps/manage', output: 'apps/manage/frontend/public' },
  { name: 'salon', path: 'apps/salon', output: 'apps/salon/frontend/public' },
  { name: 'today', path: 'apps/today', output: 'apps/today/frontend/public' },
  { name: 'vibetest', path: 'apps/vibetest', output: 'apps/vibetest/frontend/public' },
  { name: 'vibecode', path: 'apps/vibecode', output: 'apps/vibecode/packages/client/public' },
]

const MAX_COMMITS = 50

function getCommitsForApp(appPath) {
  try {
    // Get git log for files in this app's directory
    // Format: short_hash|iso_date|subject
    const gitOutput = execSync(
      `git log --pretty=format:"%h|%ai|%s" -n ${MAX_COMMITS} -- ${appPath}/`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    )

    if (!gitOutput.trim()) {
      return []
    }

    return gitOutput.trim().split('\n').map(line => {
      const [hash, datetime, ...messageParts] = line.split('|')
      const message = messageParts.join('|') // In case commit message has |
      const date = datetime.split(' ')[0] // Extract YYYY-MM-DD from ISO datetime
      return { hash, date, message }
    })
  } catch (error) {
    console.error(`  Warning: Could not get commits for ${appPath}: ${error.message}`)
    return []
  }
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function main() {
  console.log('Generating commits.json for each app...\n')

  for (const app of apps) {
    console.log(`Processing ${app.name}...`)

    const commits = getCommitsForApp(app.path)
    const outputPath = path.join(app.output, 'commits.json')

    ensureDirectoryExists(app.output)
    fs.writeFileSync(outputPath, JSON.stringify(commits, null, 2))

    console.log(`  Written ${commits.length} commits to ${outputPath}`)
  }

  console.log('\nDone!')
}

main()
