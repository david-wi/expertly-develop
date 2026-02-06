/**
 * Shipments E2E Tests for TMS
 *
 * Tests the shipments list page, detail page, status badges,
 * and filter functionality.
 */

import { test, expect } from '@playwright/test';
import { setupMocks, navigateTo } from './helpers';

test.describe('Shipments List Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await navigateTo(page, '/shipments');
  });

  test('displays the Shipments heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Shipments', exact: true }),
    ).toBeVisible();
  });

  test('shows shipment numbers in the list', async ({ page }) => {
    await expect(page.getByText('S-2024-00089')).toBeVisible();
    await expect(page.getByText('S-2024-00090')).toBeVisible();
    await expect(page.getByText('S-2024-00088')).toBeVisible();
  });

  test('shows status badges for shipments', async ({ page }) => {
    // The Shipments page renders status with underscores replaced by spaces
    await expect(
      page
        .locator('span')
        .filter({ hasText: /^in transit$|^booked$|^delivered$/i })
        .first(),
    ).toBeVisible();
  });

  test('shows origin and destination cities', async ({ page }) => {
    await expect(page.getByText('Chicago').first()).toBeVisible();
    await expect(page.getByText('Dallas').first()).toBeVisible();
  });

  test('shows at-risk indicator for at-risk shipments', async ({ page }) => {
    // ship-2 is at_risk: true, the page renders an "At Risk" badge
    await expect(page.getByText('At Risk').first()).toBeVisible();
  });

  test('shows carrier name for assigned shipments', async ({ page }) => {
    await expect(
      page.getByText('Swift Freight Services').first(),
    ).toBeVisible();
  });

  test('shows shipment count in subtitle', async ({ page }) => {
    // "3 shipments" count text
    await expect(page.getByText(/3 shipments/)).toBeVisible();
  });
});

test.describe('Shipment Filters', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await navigateTo(page, '/shipments');
  });

  test('displays filter buttons for status', async ({ page }) => {
    const filterLabels = ['All', 'Booked', 'Pending Pickup', 'In Transit', 'Delivered'];
    for (const label of filterLabels) {
      await expect(
        page.getByRole('button', { name: label, exact: true }),
      ).toBeVisible();
    }
  });

  test('displays At Risk Only toggle button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /At Risk Only/i }),
    ).toBeVisible();
  });

  test('clicking a status filter updates the URL', async ({ page }) => {
    await page.getByRole('button', { name: 'In Transit', exact: true }).click();
    await expect(page).toHaveURL(/status=in_transit/);
  });

  test('clicking At Risk Only filter updates the URL', async ({ page }) => {
    await page.getByRole('button', { name: /At Risk Only/i }).click();
    await expect(page).toHaveURL(/at_risk=true/);
  });
});

test.describe('Shipment Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await navigateTo(page, '/shipments');
  });

  test('clicking a shipment navigates to detail page', async ({ page }) => {
    await page.getByText('S-2024-00089').click();
    await page.waitForURL(/\/shipments\/.+/);

    // Detail page should show origin and destination
    await expect(page.getByText('Chicago').first()).toBeVisible();
    await expect(page.getByText('Dallas').first()).toBeVisible();
  });

  test('shipment detail shows tracking information', async ({ page }) => {
    await page.getByText('S-2024-00089').click();
    await page.waitForURL(/\/shipments\/.+/);

    // Should show tracking-related content
    await expect(
      page.getByText(/Tracking|picked_up|in_transit/i).first(),
    ).toBeVisible();
  });
});
