import { test, expect } from '@playwright/test';

test('Admin Idea Backlog shows ideas', async ({ page }) => {
  // First log in via Identity
  await page.goto('https://identity.ai.devintensive.com/login?returnUrl=https://admin.ai.devintensive.com/idea-backlog', { waitUntil: 'networkidle' });

  // Fill login form
  await page.fill('input[type="email"]', 'david@expertly.com');
  await page.fill('input[type="password"]', 'expertly123');
  await page.click('button[type="submit"]');

  // Wait for redirect back to admin
  await page.waitForURL('**/idea-backlog**', { timeout: 15000 });

  // Wait for ideas to load
  await page.waitForTimeout(2000);

  // Take screenshot
  await page.screenshot({ path: 'e2e-screenshots/admin-idea-backlog.png', fullPage: true });

  // Verify the page title
  await expect(page.locator('h1, h2').filter({ hasText: 'Idea Backlog' })).toBeVisible();

  // Verify stats section shows "New Ideas" label
  await expect(page.locator('text=New Ideas')).toBeVisible();

  // Verify at least one idea card is displayed
  const pageContent = await page.textContent('body');
  expect(pageContent).toContain('New');
  expect(pageContent).toContain('medium');

  // Should not show "No ideas" empty state when ideas exist
  const noIdeasCount = await page.locator('text=/no ideas found|empty/i').count();
  expect(noIdeasCount).toBe(0);
});
