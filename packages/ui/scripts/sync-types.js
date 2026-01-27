#!/usr/bin/env node
/**
 * Syncs the canonical module-federation.d.ts to all apps
 *
 * Run from monorepo root:
 *   node packages/ui/scripts/sync-types.js
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../../..')

// Source file
const SOURCE = join(__dirname, '../src/types/module-federation.d.ts')

// Target apps and their type file locations
const TARGETS = [
  { app: 'admin', path: 'apps/admin/frontend/src/expertly-ui.d.ts' },
  { app: 'define', path: 'apps/define/frontend/src/expertly-ui.d.ts' },
  { app: 'develop', path: 'apps/develop/frontend/src/expertly-ui.d.ts' },
  { app: 'identity', path: 'apps/identity/frontend/src/expertly-ui.d.ts' },
  { app: 'manage', path: 'apps/manage/frontend/src/expertly-ui.d.ts' },
  { app: 'salon', path: 'apps/salon/frontend/src/expertly-ui.d.ts' },
  { app: 'today', path: 'apps/today/frontend/src/expertly-ui.d.ts' },
  { app: 'vibetest', path: 'apps/vibetest/frontend/src/expertly-ui.d.ts' },
  { app: 'vibecode', path: 'apps/vibecode/packages/client/src/expertly-ui.d.ts' },
]

// Read source
const sourceContent = readFileSync(SOURCE, 'utf-8')

// Header to add to synced files
const header = `/**
 * AUTO-GENERATED - DO NOT EDIT DIRECTLY
 *
 * This file is synced from packages/ui/src/types/module-federation.d.ts
 * To update, modify the source file and run:
 *   node packages/ui/scripts/sync-types.js
 */

`

let updated = 0
let created = 0
let unchanged = 0

for (const target of TARGETS) {
  const targetPath = join(ROOT, target.path)
  const newContent = header + sourceContent

  if (existsSync(targetPath)) {
    const currentContent = readFileSync(targetPath, 'utf-8')
    if (currentContent === newContent) {
      console.log(`  [unchanged] ${target.app}`)
      unchanged++
    } else {
      writeFileSync(targetPath, newContent)
      console.log(`  [updated]   ${target.app}`)
      updated++
    }
  } else {
    writeFileSync(targetPath, newContent)
    console.log(`  [created]   ${target.app}`)
    created++
  }
}

console.log('')
console.log(`Summary: ${created} created, ${updated} updated, ${unchanged} unchanged`)
