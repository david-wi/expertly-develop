/**
 * E2E Tests for Aipocalypse Fund
 *
 * Verifies UI renders correctly with mocked API data.
 */

import { test, expect, Page } from '@playwright/test';
import {
  mockHypotheses,
  mockIndustries,
  mockCompanies,
  mockDashboardStats,
  mockLeaderboard,
  mockReports,
  mockFullReport,
  mockQueueItems,
  mockQueueStatus,
  mockSettings,
} from './fixtures/mock-data';

async function setupMocks(page: Page) {
  // Mock identity API (always returns not authenticated for tests)
  await page.route('**/identity-api.ai.devintensive.com/**', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Not authenticated' }),
    });
  });

  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const pathname = new URL(url).pathname;

    const json = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(data),
      });

    // Dashboard
    if (pathname.includes('/dashboard/stats')) return json(mockDashboardStats);
    if (pathname.includes('/dashboard/leaderboard')) return json(mockLeaderboard);
    if (pathname.match(/\/dashboard\/by-hypothesis\//)) return json(mockCompanies);
    if (pathname.match(/\/dashboard\/by-industry\//)) return json(mockCompanies);

    // Hypotheses
    if (pathname.match(/\/hypotheses\/[^/]+\/archive/) && method === 'POST') return json({ status: 'archived' });
    if (pathname.match(/\/hypotheses\/[^/]+\/activate/) && method === 'POST') return json({ status: 'active' });
    if (pathname.match(/\/hypotheses\/[^/]+$/) && method === 'GET') {
      const id = pathname.split('/').pop();
      const hyp = mockHypotheses.find(h => h.id === id);
      return hyp ? json(hyp) : json({ detail: 'Not found' }, 404);
    }
    if (pathname.includes('/hypotheses') && method === 'GET') return json(mockHypotheses);
    if (pathname.includes('/hypotheses') && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json({ id: 'hyp-new', status: 'active', ...body }, 201);
    }

    // Industries
    if (pathname.includes('/industries/tree')) return json(mockIndustries);
    if (pathname.includes('/industries') && method === 'GET') {
      return json(mockIndustries.flatMap(i => [i, ...(i.children || [])]));
    }

    // Companies
    if (pathname.match(/\/companies\/search-ticker\//)) return json([]);
    if (pathname.match(/\/companies\/[^/]+\/refresh-financials/) && method === 'POST') {
      const id = pathname.split('/')[4];
      const company = mockCompanies.find(c => c.id === id);
      return company ? json(company) : json({ detail: 'Not found' }, 404);
    }
    if (pathname.match(/\/companies\/[^/]+\/link-hypothesis/) && method === 'POST') return json({ linked: true });
    if (pathname.match(/\/companies\/[^/]+$/) && method === 'GET') {
      const id = pathname.split('/').pop();
      const company = mockCompanies.find(c => c.id === id);
      return company ? json(company) : json({ detail: 'Not found' }, 404);
    }
    if (pathname.includes('/companies') && method === 'GET') return json(mockCompanies);

    // Reports
    if (pathname.match(/\/reports\/[^/]+$/) && method === 'GET') {
      const id = pathname.split('/').pop();
      if (id === mockFullReport.id) return json(mockFullReport);
      return json({ detail: 'Not found' }, 404);
    }
    if (pathname.includes('/reports') && method === 'GET') return json(mockReports);

    // Queue
    if (pathname.includes('/queue/status')) return json(mockQueueStatus);
    if (pathname.includes('/queue') && method === 'GET') return json(mockQueueItems);

    // Settings
    if (pathname.includes('/settings') && method === 'GET') return json(mockSettings);

    // Fallback
    await route.continue();
  });
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('displays stats cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'The Aipocalypse Fund' })).toBeVisible();
    await expect(page.getByText('Companies Tracked')).toBeVisible();
    await expect(page.getByRole('main').getByText('Research Reports')).toBeVisible();
  });

  test('displays signal distribution boxes', async ({ page }) => {
    await page.goto('/');
    // Use more specific locators for signal distribution boxes
    const signalSection = page.locator('.grid.grid-cols-2');
    await expect(signalSection).toBeVisible();
  });

  test('displays company leaderboard with companies', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Company Leaderboard' })).toBeVisible();
    // Use table-specific locators
    const table = page.locator('table');
    await expect(table.getByText('ACN').first()).toBeVisible();
    await expect(table.getByText('ASAN').first()).toBeVisible();
  });

  test('leaderboard shows signal badges', async ({ page }) => {
    await page.goto('/');
    const table = page.locator('table');
    await expect(table.locator('text=Hold').first()).toBeVisible();
  });

  test('leaderboard shows market cap formatted', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('$144.9B')).toBeVisible();
    await expect(page.getByText('$2.0B')).toBeVisible();
  });

  test('has filter dropdowns', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('combobox').first()).toBeVisible();
  });
});

test.describe('Hypotheses', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('displays hypothesis list', async ({ page }) => {
    await page.goto('/hypotheses');
    await expect(page.getByRole('heading', { name: 'Investment Hypotheses' })).toBeVisible();
    await expect(page.getByText('AI Coding Tools Devastate IT Services')).toBeVisible();
    await expect(page.getByText('SaaS Applications Vulnerable to AI Duplication')).toBeVisible();
  });

  test('displays confidence bars', async ({ page }) => {
    await page.goto('/hypotheses');
    await expect(page.getByText('85%')).toBeVisible();
    await expect(page.getByText('70%')).toBeVisible();
  });

  test('displays tags', async ({ page }) => {
    await page.goto('/hypotheses');
    await expect(page.getByText('ai-coding')).toBeVisible();
    await expect(page.getByText('it-services')).toBeVisible();
  });

  test('has new hypothesis button', async ({ page }) => {
    await page.goto('/hypotheses');
    await expect(page.getByText('New Hypothesis')).toBeVisible();
  });
});

test.describe('Industries', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('displays industry page heading', async ({ page }) => {
    await page.goto('/industries');
    await expect(page.getByRole('heading', { name: 'Industries' })).toBeVisible();
    await expect(page.getByText('Browse companies by sector')).toBeVisible();
  });
});

test.describe('Company Detail', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('displays company name and ticker', async ({ page }) => {
    await page.goto('/companies/comp-2');
    await expect(page.getByRole('heading', { name: /Asana/ })).toBeVisible();
    await expect(page.getByText('ASAN').first()).toBeVisible();
  });

  test('displays financial cards', async ({ page }) => {
    await page.goto('/companies/comp-2');
    await expect(page.getByText('$8.46')).toBeVisible();
    await expect(page.getByText('89.5%')).toBeVisible();
  });

  test('displays linked hypotheses section', async ({ page }) => {
    await page.goto('/companies/comp-2');
    await expect(page.getByText('Linked Hypotheses')).toBeVisible();
  });

  test('has action buttons', async ({ page }) => {
    await page.goto('/companies/comp-2');
    await expect(page.getByText('Refresh Financials')).toBeVisible();
    await expect(page.getByText('Add to Queue')).toBeVisible();
    await expect(page.getByText('Generate Report')).toBeVisible();
  });
});

test.describe('Report View', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('displays report for Asana', async ({ page }) => {
    await page.goto('/reports/rep-2');
    await expect(page.getByText('Asana (ASAN)').first()).toBeVisible();
  });

  test('displays table of contents with Executive Summary', async ({ page }) => {
    await page.goto('/reports/rep-2');
    // Look for the contents section links
    await expect(page.locator('text=Executive Summary').first()).toBeVisible();
  });

  test('displays executive summary content', async ({ page }) => {
    await page.goto('/reports/rep-2');
    await expect(page.getByText('existential AI disruption')).toBeVisible();
  });

  test('displays moat rating', async ({ page }) => {
    await page.goto('/reports/rep-2');
    await expect(page.getByText('Weak')).toBeVisible();
  });
});

test.describe('Research Queue', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('displays queue heading and empty state', async ({ page }) => {
    await page.goto('/queue');
    await expect(page.getByRole('heading', { name: 'Research Queue' })).toBeVisible();
    await expect(page.getByText('Queue is empty')).toBeVisible();
  });

  test('has search input', async ({ page }) => {
    await page.goto('/queue');
    await expect(page.getByPlaceholder('Search companies by name or ticker...')).toBeVisible();
  });

  test('has status filter tabs', async ({ page }) => {
    await page.goto('/queue');
    await expect(page.getByText('Queued')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
    await expect(page.getByText('Completed')).toBeVisible();
    await expect(page.getByText('Failed')).toBeVisible();
  });
});

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('displays settings sections', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Claude API Key' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SEC EDGAR' })).toBeVisible();
  });

  test('displays queue batch size setting', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('Batch Size')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/');
    // Use role-based selectors to avoid ambiguity
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

    // Navigate to Hypotheses
    await page.getByRole('link', { name: 'Hypotheses' }).click();
    await expect(page.getByRole('heading', { name: 'Investment Hypotheses' })).toBeVisible();

    // Navigate to Industries
    await page.getByRole('link', { name: 'Industries' }).click();
    await expect(page.getByRole('heading', { name: 'Industries' })).toBeVisible();

    // Navigate to Queue
    await page.getByRole('link', { name: 'Research Queue' }).click();
    await expect(page.getByRole('heading', { name: 'Research Queue' })).toBeVisible();

    // Navigate to Settings
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();

    // Back to Dashboard
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByRole('heading', { name: 'The Aipocalypse Fund' })).toBeVisible();
  });

  test('company link from leaderboard works', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Asana' }).click();
    await expect(page.getByText('Cloud-based project management')).toBeVisible();
  });
});
