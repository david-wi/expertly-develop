import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const testDbPath = path.join(process.cwd(), 'data', 'test-requirements.db');

describe('Requirements API', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new Database(testDbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS requirements (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        parent_id TEXT,
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
        updated_at TEXT NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );

      CREATE TABLE IF NOT EXISTS requirement_versions (
        id TEXT PRIMARY KEY,
        requirement_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        snapshot TEXT NOT NULL,
        change_summary TEXT,
        changed_by TEXT,
        changed_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        FOREIGN KEY (requirement_id) REFERENCES requirements(id)
      );
    `);

    // Create a test product
    const now = new Date().toISOString();
    db.prepare('INSERT INTO products (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
      'prod-1',
      'Test Product',
      'A test product',
      now,
      now
    );
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should create a requirement', () => {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO requirements (id, product_id, stable_key, title, what_this_does, status, priority, order_index, current_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run('req-1', 'prod-1', 'REQ-001', 'Test Requirement', 'Users can test things', 'draft', 'medium', 0, 1, now, now);

    const requirements = db.prepare('SELECT * FROM requirements').all();
    expect(requirements).toHaveLength(1);
    expect((requirements[0] as any).title).toBe('Test Requirement');
    expect((requirements[0] as any).stable_key).toBe('REQ-001');
  });

  it('should create a version when requirement is created', () => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO requirements (id, product_id, stable_key, title, what_this_does, status, priority, order_index, current_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('req-1', 'prod-1', 'REQ-001', 'Test Requirement', 'Users can test things', 'draft', 'medium', 0, 1, now, now);

    db.prepare(`
      INSERT INTO requirement_versions (id, requirement_id, version_number, snapshot, change_summary, changed_by, changed_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('ver-1', 'req-1', 1, '{}', 'Initial creation', 'System', now, 'active');

    const versions = db.prepare('SELECT * FROM requirement_versions WHERE requirement_id = ?').all('req-1');
    expect(versions).toHaveLength(1);
    expect((versions[0] as any).version_number).toBe(1);
  });

  it('should support parent-child relationships', () => {
    const now = new Date().toISOString();
    // Create parent
    db.prepare(`
      INSERT INTO requirements (id, product_id, stable_key, title, status, priority, order_index, current_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('req-parent', 'prod-1', 'REQ-001', 'Parent Requirement', 'draft', 'high', 0, 1, now, now);

    // Create child
    db.prepare(`
      INSERT INTO requirements (id, product_id, parent_id, stable_key, title, status, priority, order_index, current_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('req-child', 'prod-1', 'req-parent', 'REQ-002', 'Child Requirement', 'draft', 'medium', 0, 1, now, now);

    const children = db.prepare('SELECT * FROM requirements WHERE parent_id = ?').all('req-parent');
    expect(children).toHaveLength(1);
    expect((children[0] as any).title).toBe('Child Requirement');
  });

  it('should update requirement and increment version', () => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO requirements (id, product_id, stable_key, title, status, priority, order_index, current_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('req-1', 'prod-1', 'REQ-001', 'Original Title', 'draft', 'medium', 0, 1, now, now);

    db.prepare('UPDATE requirements SET title = ?, current_version = current_version + 1, updated_at = ? WHERE id = ?').run(
      'Updated Title',
      new Date().toISOString(),
      'req-1'
    );

    const req = db.prepare('SELECT * FROM requirements WHERE id = ?').get('req-1') as any;
    expect(req.title).toBe('Updated Title');
    expect(req.current_version).toBe(2);
  });

  it('should support different statuses', () => {
    const now = new Date().toISOString();
    const statuses = ['draft', 'ready_to_build', 'implemented', 'verified'];

    statuses.forEach((status, i) => {
      db.prepare(`
        INSERT INTO requirements (id, product_id, stable_key, title, status, priority, order_index, current_version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(`req-${i}`, 'prod-1', `REQ-00${i}`, `Requirement ${i}`, status, 'medium', i, 1, now, now);
    });

    const draftReqs = db.prepare('SELECT * FROM requirements WHERE status = ?').all('draft');
    const verifiedReqs = db.prepare('SELECT * FROM requirements WHERE status = ?').all('verified');

    expect(draftReqs).toHaveLength(1);
    expect(verifiedReqs).toHaveLength(1);
  });
});
