import { test, expect } from '@playwright/test';

test.describe('Product Dropdown', () => {
  test('dropdown should have opaque background when opened', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Find and click the product switcher button (contains "Develop" text)
    const productSwitcher = page.locator('button', { hasText: 'Develop' }).first();
    await productSwitcher.click();

    // Wait for the dropdown to appear
    const dropdown = page.locator('text=Switch Product').locator('..');
    await expect(dropdown).toBeVisible();

    // Get the dropdown container's background color
    const dropdownContainer = page.locator('.fixed.left-0.top-14.w-64');
    await expect(dropdownContainer).toBeVisible();

    // Verify the background is not transparent by checking computed styles
    const backgroundColor = await dropdownContainer.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // The background should not be transparent (rgba with alpha 0)
    // It should be a solid color like rgb(255, 255, 255) or similar
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(backgroundColor).not.toBe('transparent');

    // Verify we can see the product list
    await expect(page.locator('text=Requirements management')).toBeVisible();
    await expect(page.locator('text=Visual walkthroughs')).toBeVisible();
  });

  test('dropdown should cover content underneath', async ({ page }) => {
    await page.goto('/');

    // Click to open the product switcher
    const productSwitcher = page.locator('button', { hasText: 'Develop' }).first();
    await productSwitcher.click();

    // The dropdown should be visible
    const dropdown = page.locator('.fixed.left-0.top-14.w-64');
    await expect(dropdown).toBeVisible();

    // Take a screenshot for visual verification
    await page.screenshot({ path: 'e2e-screenshots/product-dropdown.png' });

    // Verify the z-index is high enough (should be z-50 = 50)
    const zIndex = await dropdown.evaluate((el) => {
      return window.getComputedStyle(el).zIndex;
    });
    expect(parseInt(zIndex)).toBeGreaterThanOrEqual(50);
  });
});
