import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  prefix: text('prefix').notNull(), // Unique prefix for requirement IDs (e.g., "ED" for "Expertly Define")
  description: text('description'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const requirements = sqliteTable('requirements', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').references((): any => requirements.id, { onDelete: 'cascade' }),
  stableKey: text('stable_key').notNull(),
  title: text('title').notNull(),
  whatThisDoes: text('what_this_does'),
  whyThisExists: text('why_this_exists'),
  notIncluded: text('not_included'),
  acceptanceCriteria: text('acceptance_criteria'),
  status: text('status').notNull().default('draft'), // draft, ready_to_build, implemented, verified
  priority: text('priority').notNull().default('medium'), // critical, high, medium, low
  tags: text('tags'), // JSON array
  orderIndex: integer('order_index').notNull().default(0),
  currentVersion: integer('current_version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const requirementVersions = sqliteTable('requirement_versions', {
  id: text('id').primaryKey(),
  requirementId: text('requirement_id').notNull().references(() => requirements.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  snapshot: text('snapshot').notNull(), // JSON - full requirement state
  changeSummary: text('change_summary'),
  changedBy: text('changed_by'),
  changedAt: text('changed_at').notNull(),
  status: text('status').notNull().default('active'), // active, superseded, canceled
});

export const codeLinks = sqliteTable('code_links', {
  id: text('id').primaryKey(),
  requirementId: text('requirement_id').notNull().references(() => requirements.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(),
  description: text('description'),
  status: text('status').notNull().default('up_to_date'), // up_to_date, needs_look, broken
  lastCheckedAt: text('last_checked_at'),
});

export const testLinks = sqliteTable('test_links', {
  id: text('id').primaryKey(),
  requirementId: text('requirement_id').notNull().references(() => requirements.id, { onDelete: 'cascade' }),
  testPath: text('test_path').notNull(),
  testType: text('test_type').notNull().default('unit'), // unit, integration, e2e, manual
  description: text('description'),
  status: text('status').notNull().default('not_run'), // passing, failing, not_run
  lastRunAt: text('last_run_at'),
});

export const deliveryLinks = sqliteTable('delivery_links', {
  id: text('id').primaryKey(),
  requirementId: text('requirement_id').notNull().references(() => requirements.id, { onDelete: 'cascade' }),
  externalId: text('external_id').notNull(),
  externalSystem: text('external_system').notNull().default('jira'), // jira, teamwork, github
  intent: text('intent').notNull().default('implements'), // implements, modifies, verifies, refactors
  title: text('title'),
  url: text('url'),
});

export const releaseSnapshots = sqliteTable('release_snapshots', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  versionName: text('version_name').notNull(),
  description: text('description'),
  requirementsSnapshot: text('requirements_snapshot').notNull(), // JSON
  stats: text('stats'), // JSON - verified count, etc.
  status: text('status').notNull().default('draft'), // draft, released
  createdAt: text('created_at').notNull(),
  releasedAt: text('released_at'),
});

export const jiraSettings = sqliteTable('jira_settings', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  jiraHost: text('jira_host').notNull(), // e.g., "mycompany.atlassian.net"
  jiraEmail: text('jira_email').notNull(),
  jiraApiToken: text('jira_api_token').notNull(),
  defaultProjectKey: text('default_project_key').notNull(), // e.g., "PROJ"
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const jiraStoryDrafts = sqliteTable('jira_story_drafts', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  requirementId: text('requirement_id').references(() => requirements.id, { onDelete: 'set null' }),
  summary: text('summary').notNull(), // Jira issue title
  description: text('description'), // Full description in Jira format
  issueType: text('issue_type').notNull().default('Story'), // Story, Task, Bug, Epic
  priority: text('priority').notNull().default('Medium'), // Highest, High, Medium, Low, Lowest
  labels: text('labels'), // JSON array
  storyPoints: integer('story_points'),
  status: text('status').notNull().default('draft'), // draft, sent, failed
  jiraIssueKey: text('jira_issue_key'), // Populated after sending (e.g., "PROJ-123")
  jiraUrl: text('jira_url'), // Link to created issue
  errorMessage: text('error_message'), // If sending failed
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Type exports
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Requirement = typeof requirements.$inferSelect;
export type NewRequirement = typeof requirements.$inferInsert;
export type RequirementVersion = typeof requirementVersions.$inferSelect;
export type NewRequirementVersion = typeof requirementVersions.$inferInsert;
export type CodeLink = typeof codeLinks.$inferSelect;
export type NewCodeLink = typeof codeLinks.$inferInsert;
export type TestLink = typeof testLinks.$inferSelect;
export type NewTestLink = typeof testLinks.$inferInsert;
export type DeliveryLink = typeof deliveryLinks.$inferSelect;
export type NewDeliveryLink = typeof deliveryLinks.$inferInsert;
export type ReleaseSnapshot = typeof releaseSnapshots.$inferSelect;
export type NewReleaseSnapshot = typeof releaseSnapshots.$inferInsert;
export type JiraSettings = typeof jiraSettings.$inferSelect;
export type NewJiraSettings = typeof jiraSettings.$inferInsert;
export type JiraStoryDraft = typeof jiraStoryDrafts.$inferSelect;
export type NewJiraStoryDraft = typeof jiraStoryDrafts.$inferInsert;
