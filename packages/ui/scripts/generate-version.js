#!/usr/bin/env node

/**
 * Generates version.json with current git commit info.
 * Run this during build to create the version file.
 */

import { execSync } from 'child_process'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outputDir = join(__dirname, '..', 'public')
const outputFile = join(outputDir, 'version.json')

function getGitInfo() {
  try {
    const commit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim()
    const timestamp = Date.now()

    return { commit, branch, timestamp }
  } catch (error) {
    console.warn('Warning: Could not get git info:', error.message)
    return {
      commit: process.env.GIT_COMMIT || 'unknown',
      branch: process.env.GIT_BRANCH || 'unknown',
      timestamp: Date.now(),
    }
  }
}

function main() {
  const versionInfo = getGitInfo()

  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true })

  // Write version.json
  writeFileSync(outputFile, JSON.stringify(versionInfo, null, 2))

  console.log('Generated version.json:')
  console.log(JSON.stringify(versionInfo, null, 2))
}

main()
