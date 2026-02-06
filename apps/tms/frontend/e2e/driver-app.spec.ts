/**
 * Driver App E2E Tests for TMS
 *
 * Tests the driver login page, form fields, and authentication redirect.
 * The driver app lives at /driver/* and uses a separate layout (no sidebar).
 */

import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers';

test.describe('Driver Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/driver/login');
  });

  test('loads the driver login page', async ({ page }) => {
    await expect(page).toHaveURL('/driver/login');
  });

  test('displays the Expertly TMS branding', async ({ page }) => {
    await expect(page.getByText('Expertly TMS')).toBeVisible();
    await expect(page.getByText('Driver App')).toBeVisible();
  });

  test('has a phone number input field', async ({ page }) => {
    const phoneInput = page.locator('#phone');
    await expect(phoneInput).toBeVisible();
    await expect(phoneInput).toHaveAttribute('type', 'tel');
    await expect(phoneInput).toHaveAttribute('placeholder', '(555) 123-4567');
  });

  test('has a PIN input field', async ({ page }) => {
    const pinInput = page.locator('#pin');
    await expect(pinInput).toBeVisible();
    await expect(pinInput).toHaveAttribute('type', 'password');
    await expect(pinInput).toHaveAttribute('placeholder', 'Enter PIN');
    await expect(pinInput).toHaveAttribute('maxlength', '6');
  });

  test('has a Remember this device checkbox', async ({ page }) => {
    await expect(page.getByText('Remember this device')).toBeVisible();
    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
  });

  test('has a Sign In button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Sign In' }),
    ).toBeVisible();
  });

  test('Sign In button is disabled when fields are empty', async ({
    page,
  }) => {
    const signInButton = page.getByRole('button', { name: 'Sign In' });
    await expect(signInButton).toBeDisabled();
  });

  test('Sign In button becomes enabled when both fields are filled', async ({
    page,
  }) => {
    // Fill phone number
    await page.locator('#phone').fill('5551234567');
    // Fill PIN
    await page.locator('#pin').fill('1234');

    const signInButton = page.getByRole('button', { name: 'Sign In' });
    await expect(signInButton).toBeEnabled();
  });

  test('phone number formats as user types', async ({ page }) => {
    const phoneInput = page.locator('#phone');
    await phoneInput.fill('5551234567');

    // The display value should be formatted
    await expect(phoneInput).toHaveValue('(555) 123-4567');
  });

  test('PIN only accepts digits', async ({ page }) => {
    const pinInput = page.locator('#pin');
    await pinInput.fill('12ab34');
    // Non-digits are stripped
    await expect(pinInput).toHaveValue('1234');
  });

  test('shows dispatch contact help text', async ({ page }) => {
    await expect(
      page.getByText('Contact dispatch if you need help logging in'),
    ).toBeVisible();
  });
});

test.describe('Driver App Auth Redirect', () => {
  test('redirects to /driver/login when not authenticated', async ({
    page,
  }) => {
    await setupMocks(page);

    // Clear any stored driver session
    await page.goto('/driver/login');
    await page.evaluate(() => {
      localStorage.removeItem('driver_id');
      localStorage.removeItem('driver_name');
      localStorage.removeItem('driver_token');
      sessionStorage.removeItem('driver_id');
      sessionStorage.removeItem('driver_name');
      sessionStorage.removeItem('driver_token');
    });

    // Navigate to driver app main page
    await page.goto('/driver');
    await page.waitForURL(/\/driver\/login/);
    await expect(page).toHaveURL(/\/driver\/login/);
  });
});
