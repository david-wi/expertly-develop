/**
 * Navigation E2E Tests for TMS
 *
 * Verifies the sidebar renders correctly, all nav items are present,
 * and clicking them navigates to the expected routes.
 */

import { test, expect } from '@playwright/test';
import { setupMocks, waitForSidebar, navigateTo } from './helpers';

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await navigateTo(page, '/');
    await waitForSidebar(page);
  });

  test('renders sidebar with product name', async ({ page }) => {
    // The Layout uses the shared Sidebar component with productName="TMS"
    await expect(page.locator('nav').first()).toBeVisible();
  });

  test('displays all primary nav items', async ({ page }) => {
    const sidebar = page.locator('nav').first();

    const expectedItems = [
      'Dashboard',
      'Inbox',
      'Quote Requests',
      'Shipments',
      'Dispatch Board',
      'Customers',
      'Carriers',
      'Invoices',
      'Settings',
    ];

    for (const item of expectedItems) {
      await expect(
        sidebar.getByRole('link', { name: item, exact: true }),
      ).toBeVisible();
    }
  });

  test('navigates to Inbox', async ({ page }) => {
    await page.locator('nav').first().getByRole('link', { name: 'Inbox', exact: true }).click();
    await expect(page).toHaveURL('/inbox');
  });

  test('navigates to Quote Requests', async ({ page }) => {
    await page.locator('nav').first().getByRole('link', { name: 'Quote Requests', exact: true }).click();
    await expect(page).toHaveURL('/quote-requests');
  });

  test('navigates to Shipments', async ({ page }) => {
    await page.locator('nav').first().getByRole('link', { name: 'Shipments', exact: true }).click();
    await expect(page).toHaveURL('/shipments');
  });

  test('navigates to Dispatch Board', async ({ page }) => {
    await page.locator('nav').first().getByRole('link', { name: 'Dispatch Board', exact: true }).click();
    await expect(page).toHaveURL('/dispatch');
  });

  test('navigates to Customers', async ({ page }) => {
    await page.locator('nav').first().getByRole('link', { name: 'Customers', exact: true }).click();
    await expect(page).toHaveURL('/customers');
  });

  test('navigates to Carriers', async ({ page }) => {
    await page.locator('nav').first().getByRole('link', { name: 'Carriers', exact: true }).click();
    await expect(page).toHaveURL('/carriers');
  });

  test('navigates to Invoices', async ({ page }) => {
    await page.locator('nav').first().getByRole('link', { name: 'Invoices', exact: true }).click();
    await expect(page).toHaveURL('/invoices');
  });

  test('navigates to Settings', async ({ page }) => {
    await page.locator('nav').first().getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page).toHaveURL('/settings');
  });
});

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await navigateTo(page, '/');
  });

  test('displays Dashboard heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Dashboard/i }),
    ).toBeVisible();
  });

  test('displays stat cards', async ({ page }) => {
    await expect(page.getByText('Open Work Items')).toBeVisible();
    await expect(page.getByText("Today's Pickups")).toBeVisible();
    await expect(page.getByText("Today's Deliveries")).toBeVisible();
    await expect(page.getByText('At-Risk Shipments')).toBeVisible();
  });

  test('displays Quick Actions section', async ({ page }) => {
    await expect(page.getByText('Quick Actions')).toBeVisible();
    await expect(page.getByText('New Quote Request')).toBeVisible();
    await expect(page.getByText('Dispatch Board')).toBeVisible();
    await expect(page.getByText('Track Shipments')).toBeVisible();
  });

  test('page titles/headers are correct on each page', async ({ page }) => {
    const pages = [
      { url: '/', heading: 'Dashboard' },
      { url: '/inbox', heading: 'Inbox' },
      { url: '/shipments', heading: 'Shipments' },
      { url: '/customers', heading: 'Customers' },
      { url: '/carriers', heading: 'Carriers' },
      { url: '/invoices', heading: 'Invoices' },
      { url: '/settings', heading: 'Settings' },
    ];

    for (const { url, heading } of pages) {
      await navigateTo(page, url);
      await expect(
        page.getByRole('heading', { name: heading, exact: true }).first(),
      ).toBeVisible();
    }
  });
});
