import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Go to login page
  await page.goto('/login');

  // Fill in login form
  await page.fill('input[type="email"]', 'admin@demo.com');
  await page.fill('input[type="password"]', 'demo123');

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for redirect to calendar
  await page.waitForURL('/');

  // Verify we're logged in by checking for the sidebar
  await expect(page.locator('text=Calendar')).toBeVisible();

  // Save auth state
  await page.context().storageState({ path: authFile });
});
