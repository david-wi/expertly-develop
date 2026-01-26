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
      prefix TEXT NOT NULL DEFAULT 'REQ',
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

    CREATE TABLE IF NOT EXISTS jira_settings (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      jira_host TEXT NOT NULL,
      jira_email TEXT NOT NULL,
      jira_api_token TEXT NOT NULL,
      default_project_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jira_story_drafts (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      requirement_id TEXT REFERENCES requirements(id) ON DELETE SET NULL,
      summary TEXT NOT NULL,
      description TEXT,
      issue_type TEXT NOT NULL DEFAULT 'Story',
      priority TEXT NOT NULL DEFAULT 'Medium',
      labels TEXT,
      story_points INTEGER,
      status TEXT NOT NULL DEFAULT 'draft',
      jira_issue_key TEXT,
      jira_url TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_requirements_product ON requirements(product_id);
    CREATE INDEX IF NOT EXISTS idx_requirements_parent ON requirements(parent_id);
    CREATE INDEX IF NOT EXISTS idx_requirement_versions_requirement ON requirement_versions(requirement_id);
    CREATE INDEX IF NOT EXISTS idx_code_links_requirement ON code_links(requirement_id);
    CREATE INDEX IF NOT EXISTS idx_test_links_requirement ON test_links(requirement_id);
    CREATE INDEX IF NOT EXISTS idx_delivery_links_requirement ON delivery_links(requirement_id);
    CREATE INDEX IF NOT EXISTS idx_release_snapshots_product ON release_snapshots(product_id);
    CREATE INDEX IF NOT EXISTS idx_jira_settings_product ON jira_settings(product_id);
    CREATE INDEX IF NOT EXISTS idx_jira_story_drafts_product ON jira_story_drafts(product_id);
    CREATE INDEX IF NOT EXISTS idx_jira_story_drafts_requirement ON jira_story_drafts(requirement_id);

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_requirement ON attachments(requirement_id);
  `);

  // Migration: Add prefix column to products if it doesn't exist
  try {
    sqlite.exec(`ALTER TABLE products ADD COLUMN prefix TEXT NOT NULL DEFAULT 'REQ'`);
    console.log('Migration: Added prefix column to products table');
  } catch {
    // Column already exists, ignore error
  }

  // Migration: Update existing products with auto-generated prefixes
  const productsWithoutPrefix = sqlite.prepare(`
    SELECT id, name FROM products WHERE prefix = 'REQ' OR prefix IS NULL
  `).all() as { id: string; name: string }[];

  for (const product of productsWithoutPrefix) {
    // Generate prefix from name (first letters of each word)
    const words = product.name.trim().split(/\s+/);
    let prefix: string;
    if (words.length === 1) {
      prefix = words[0].substring(0, 3).toUpperCase();
    } else {
      prefix = words.slice(0, 4).map((w) => w[0]).join('').toUpperCase();
    }

    // Make sure prefix is unique
    const existingCount = sqlite.prepare(`SELECT COUNT(*) as count FROM products WHERE prefix = ? AND id != ?`).get(prefix, product.id) as { count: number };
    if (existingCount.count > 0) {
      prefix = prefix + '1';
    }

    sqlite.prepare(`UPDATE products SET prefix = ? WHERE id = ?`).run(prefix, product.id);
    console.log(`Migration: Set prefix "${prefix}" for product "${product.name}"`);
  }
}

// Initialize on module load
initializeDatabase();
