/**
 * Customers E2E Tests for TMS
 *
 * Tests the customers list page, customer detail navigation,
 * and action buttons.
 */

import { test, expect } from '@playwright/test';
import { setupMocks, navigateTo } from './helpers';

test.describe('Customers List Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await navigateTo(page, '/customers');
  });

  test('displays the Customers heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Customers', exact: true }),
    ).toBeVisible();
  });

  test('shows customer count', async ({ page }) => {
    await expect(page.getByText(/3 customers/)).toBeVisible();
  });

  test('shows all customer names', async ({ page }) => {
    await expect(page.getByText('ABC Manufacturing Inc')).toBeVisible();
    await expect(page.getByText('XYZ Distribution LLC')).toBeVisible();
    await expect(page.getByText('QuickShip Retail')).toBeVisible();
  });

  test('shows customer status badges', async ({ page }) => {
    // "active" and "credit hold" statuses should be visible
    await expect(
      page
        .locator('span')
        .filter({ hasText: /^active$/i })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .locator('span')
        .filter({ hasText: /credit hold/i })
        .first(),
    ).toBeVisible();
  });

  test('shows Add Customer button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Add Customer/i }),
    ).toBeVisible();
  });

  test('opens New Customer modal when Add Customer is clicked', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Add Customer/i }).click();
    await expect(
      page.getByRole('heading', { name: 'New Customer' }),
    ).toBeVisible();
  });

  test('New Customer modal has required form fields', async ({ page }) => {
    await page.getByRole('button', { name: /Add Customer/i }).click();

    await expect(page.getByText('Company Name *')).toBeVisible();
    await expect(page.getByText('Billing Email')).toBeVisible();
    await expect(page.getByText('Phone')).toBeVisible();
    await expect(page.getByText('City')).toBeVisible();
    await expect(page.getByText('State')).toBeVisible();
  });

  test('New Customer modal can be closed', async ({ page }) => {
    await page.getByRole('button', { name: /Add Customer/i }).click();
    await expect(
      page.getByRole('heading', { name: 'New Customer' }),
    ).toBeVisible();

    // Click the Cancel button
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(
      page.getByRole('heading', { name: 'New Customer' }),
    ).not.toBeVisible();
  });

  test('shows customer contact info', async ({ page }) => {
    // Customer billing emails are shown
    await expect(page.getByText('ap@abcmfg.com')).toBeVisible();
    await expect(page.getByText('billing@xyzdist.com')).toBeVisible();
  });

  test('shows customer location', async ({ page }) => {
    await expect(page.getByText('Chicago, IL')).toBeVisible();
    await expect(page.getByText('Dallas, TX')).toBeVisible();
  });
});

test.describe('Customer Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await navigateTo(page, '/customers');
  });

  test('clicking a customer navigates to detail page', async ({ page }) => {
    await page.getByText('ABC Manufacturing Inc').click();
    await page.waitForURL(/\/customers\/cust-1/);
  });
});
