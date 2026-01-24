import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'expertly-define.db');
const sqlite = new Database(dbPath);

// Enable foreign keys
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

// Initialize database tables if they don't exist
export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requirements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      parent_id TEXT REFERENCES requirements(id) ON DELETE CASCADE,
      stable_key TEXT NOT NULL,
      title TEXT NOT NULL,
      what_this_does TEXT,
      why_this_exists TEXT,
      not_included TEXT,
      acceptance_criteria TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      priority TEXT NOT NULL DEFAULT 'medium',
      tags TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      current_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requirement_versions (
      id TEXT PRIMARY KEY,
      requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      snapshot TEXT NOT NULL,
      change_summary TEXT,
      changed_by TEXT,
      changed_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS code_links (
      id TEXT PRIMARY KEY,
      requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'up_to_date',
      last_checked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS test_links (
      id TEXT PRIMARY KEY,
      requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
      test_path TEXT NOT NULL,
      test_type TEXT NOT NULL DEFAULT 'unit',
      description TEXT,
      status TEXT NOT NULL DEFAULT 'not_run',
      last_run_at TEXT
    );

    CREATE TABLE IF NOT EXISTS delivery_links (
      id TEXT PRIMARY KEY,
      requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
      external_id TEXT NOT NULL,
      external_system TEXT NOT NULL DEFAULT 'jira',
      intent TEXT NOT NULL DEFAULT 'implements',
      title TEXT,
      url TEXT
    );

    CREATE TABLE IF NOT EXISTS release_snapshots (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      version_name TEXT NOT NULL,
      description TEXT,
      requirements_snapshot TEXT NOT NULL,
      stats TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      released_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_requirements_product ON requirements(product_id);
    CREATE INDEX IF NOT EXISTS idx_requirements_parent ON requirements(parent_id);
    CREATE INDEX IF NOT EXISTS idx_requirement_versions_requirement ON requirement_versions(requirement_id);
    CREATE INDEX IF NOT EXISTS idx_code_links_requirement ON code_links(requirement_id);
    CREATE INDEX IF NOT EXISTS idx_test_links_requirement ON test_links(requirement_id);
    CREATE INDEX IF NOT EXISTS idx_delivery_links_requirement ON delivery_links(requirement_id);
    CREATE INDEX IF NOT EXISTS idx_release_snapshots_product ON release_snapshots(product_id);
  `);
}

// Initialize on module load
initializeDatabase();
