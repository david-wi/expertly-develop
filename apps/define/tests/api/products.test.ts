import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Test database setup
const testDbPath = path.join(process.cwd(), 'data', 'test-expertly-define.db');

describe('Products API', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create test database
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
      )
    `);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should create a product', () => {
    const now = new Date().toISOString();
    const stmt = db.prepare('INSERT INTO products (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
    stmt.run('test-id', 'Test Product', 'A test product', now, now);

    const products = db.prepare('SELECT * FROM products').all();
    expect(products).toHaveLength(1);
    expect((products[0] as any).name).toBe('Test Product');
  });

  it('should update a product', () => {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO products (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
      'test-id',
      'Test Product',
      'A test product',
      now,
      now
    );

    db.prepare('UPDATE products SET name = ?, updated_at = ? WHERE id = ?').run('Updated Product', new Date().toISOString(), 'test-id');

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get('test-id') as any;
    expect(product.name).toBe('Updated Product');
  });

  it('should delete a product', () => {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO products (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
      'test-id',
      'Test Product',
      'A test product',
      now,
      now
    );

    db.prepare('DELETE FROM products WHERE id = ?').run('test-id');

    const products = db.prepare('SELECT * FROM products').all();
    expect(products).toHaveLength(0);
  });
});
