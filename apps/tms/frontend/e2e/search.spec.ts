/**
 * Global Search E2E Tests for TMS
 *
 * Tests the Cmd+K global search overlay, typing to search,
 * and closing with Escape.
 *
 * Note: The GlobalSearch component renders as a small button when closed
 * and as a full-screen overlay when open. It is rendered inside the Layout
 * on the /search route, but the keyboard shortcut (Cmd+K) also opens it
 * from any page.
 */

import { test, expect } from '@playwright/test';
import { setupMocks, navigateTo } from './helpers';

test.describe('Global Search', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await navigateTo(page, '/search');
  });

  test('search button is visible on the search page', async ({ page }) => {
    // The GlobalSearch component renders a "Search..." button when closed
    await expect(
      page.getByRole('button', { name: /Search/i }).first(),
    ).toBeVisible();
  });

  test('clicking search button opens the search overlay', async ({ page }) => {
    await page.getByRole('button', { name: /Search/i }).first().click();

    // The overlay has a text input with the placeholder
    await expect(
      page.getByPlaceholder('Search shipments, customers, carriers...'),
    ).toBeVisible();
  });

  test('Cmd+K opens global search from the search page', async ({ page }) => {
    await page.keyboard.press('Meta+k');

    await expect(
      page.getByPlaceholder('Search shipments, customers, carriers...'),
    ).toBeVisible();
  });

  test('Escape closes the search overlay', async ({ page }) => {
    // Open
    await page.keyboard.press('Meta+k');
    await expect(
      page.getByPlaceholder('Search shipments, customers, carriers...'),
    ).toBeVisible();

    // Close
    await page.keyboard.press('Escape');
    await expect(
      page.getByPlaceholder('Search shipments, customers, carriers...'),
    ).not.toBeVisible();
  });

  test('typing in search shows results', async ({ page }) => {
    // Open search
    await page.keyboard.press('Meta+k');

    const searchInput = page.getByPlaceholder(
      'Search shipments, customers, carriers...',
    );
    await searchInput.fill('ABC');

    // Wait for debounced search to fire and results to render
    // The mock returns results for "ABC" matching "ABC Manufacturing Inc"
    await expect(page.getByText('ABC Manufacturing Inc').first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('search shows "no results" for unmatched queries', async ({ page }) => {
    await page.keyboard.press('Meta+k');

    const searchInput = page.getByPlaceholder(
      'Search shipments, customers, carriers...',
    );
    await searchInput.fill('zzzznonexistent');

    // Wait for search to complete
    await expect(
      page.getByText(/No results/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('search shows empty state hint when no query entered', async ({
    page,
  }) => {
    await page.keyboard.press('Meta+k');

    // With no query and no recent searches, should show hint text
    await expect(
      page.getByText(/Type to search/i).first(),
    ).toBeVisible();
  });

  test('search overlay shows Esc hint in footer', async ({ page }) => {
    await page.keyboard.press('Meta+k');

    await expect(page.getByText('to close')).toBeVisible();
  });
});
