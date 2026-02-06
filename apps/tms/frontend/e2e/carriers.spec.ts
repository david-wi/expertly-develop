/**
 * Carriers E2E Tests for TMS
 *
 * Tests the carriers list page, carrier detail navigation,
 * MC numbers, equipment types, and form actions.
 */

import { test, expect } from '@playwright/test';
import { setupMocks, navigateTo } from './helpers';

test.describe('Carriers List Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await navigateTo(page, '/carriers');
  });

  test('displays the Carriers heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Carriers', exact: true }),
    ).toBeVisible();
  });

  test('shows carrier count', async ({ page }) => {
    await expect(page.getByText(/3 carriers/)).toBeVisible();
  });

  test('shows all carrier names', async ({ page }) => {
    await expect(page.getByText('Swift Freight Services')).toBeVisible();
    await expect(page.getByText('Flatbed Express Inc')).toBeVisible();
    await expect(page.getByText('Cold Chain Logistics')).toBeVisible();
  });

  test('shows MC numbers', async ({ page }) => {
    // The Carriers page renders MC numbers as "MC# MC-123456"
    await expect(page.getByText('MC-123456').first()).toBeVisible();
    await expect(page.getByText('MC-654321').first()).toBeVisible();
    await expect(page.getByText('MC-999888').first()).toBeVisible();
  });

  test('shows carrier status badges', async ({ page }) => {
    await expect(
      page
        .locator('span')
        .filter({ hasText: /^active$/i })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .locator('span')
        .filter({ hasText: /^pending$/i })
        .first(),
    ).toBeVisible();
  });

  test('shows equipment types', async ({ page }) => {
    // Equipment types are rendered as small badges
    await expect(
      page
        .locator('span')
        .filter({ hasText: /van|reefer|flatbed|step_deck/i })
        .first(),
    ).toBeVisible();
  });

  test('shows insurance expiration warning', async ({ page }) => {
    // Flatbed Express has insurance expiring within 30 days
    await expect(page.getByText('Insurance Expiring').first()).toBeVisible();
  });

  test('shows Add Carrier button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Add Carrier/i }),
    ).toBeVisible();
  });

  test('opens New Carrier modal when Add Carrier is clicked', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Add Carrier/i }).click();
    await expect(
      page.getByRole('heading', { name: 'New Carrier' }),
    ).toBeVisible();
  });

  test('New Carrier modal has required form fields', async ({ page }) => {
    await page.getByRole('button', { name: /Add Carrier/i }).click();

    await expect(page.getByText('Company Name *')).toBeVisible();
    await expect(page.getByText('MC Number')).toBeVisible();
    await expect(page.getByText('DOT Number')).toBeVisible();
    await expect(page.getByText('Contact Name')).toBeVisible();
    await expect(page.getByText('Equipment Types')).toBeVisible();
    await expect(page.getByText('Insurance Expiration')).toBeVisible();
  });

  test('New Carrier modal can be closed', async ({ page }) => {
    await page.getByRole('button', { name: /Add Carrier/i }).click();
    await expect(
      page.getByRole('heading', { name: 'New Carrier' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(
      page.getByRole('heading', { name: 'New Carrier' }),
    ).not.toBeVisible();
  });

  test('shows contact info for carriers', async ({ page }) => {
    await expect(
      page.getByText('mike@swiftfreight.com').first(),
    ).toBeVisible();
  });
});

test.describe('Carrier Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await navigateTo(page, '/carriers');
  });

  test('clicking a carrier navigates to detail page', async ({ page }) => {
    await page.getByText('Swift Freight Services').click();
    await page.waitForURL(/\/carriers\/carr-1/);
  });
});
