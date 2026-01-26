import { test, expect } from '@playwright/test';

test.describe('Theme checks', () => {
  test('should have consistent light theme styling', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load
    await page.waitForSelector('aside');

    // Take a screenshot to see the current state
    await page.screenshot({ path: 'tests/screenshots/initial-load.png', fullPage: true });

    // Check sidebar is visible with white background
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    const sidebarBg = await sidebar.evaluate(el => getComputedStyle(el).backgroundColor);
    console.log('Sidebar background:', sidebarBg);
    // Sidebar should be white (rgb(255, 255, 255))
    expect(sidebarBg).toBe('rgb(255, 255, 255)');

    // Check body has light background (should be gray-100 = rgb(243, 244, 246))
    const body = page.locator('body');
    const bodyBg = await body.evaluate(el => getComputedStyle(el).backgroundColor);
    console.log('Body background:', bodyBg);
    // Body should be light gray, not dark
    expect(bodyBg).toBe('rgb(243, 244, 246)');
  });

  test('should have readable text in empty state', async ({ page }) => {
    await page.goto('/');

    // Wait for empty state heading
    const heading = page.locator('h2:has-text("Welcome to Expertly Vibecode")');
    await expect(heading).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/empty-state.png', fullPage: true });

    // Check heading has dark text color (text-gray-900 = rgb(17, 24, 39))
    const headingColor = await heading.evaluate(el => getComputedStyle(el).color);
    console.log('Heading color:', headingColor);
    expect(headingColor).toBe('rgb(17, 24, 39)');

    // Check description has gray text (text-gray-500 = rgb(107, 114, 128))
    const description = page.locator('p:has-text("Manage multiple Claude Code sessions")');
    const descColor = await description.evaluate(el => getComputedStyle(el).color);
    console.log('Description color:', descColor);
    expect(descColor).toBe('rgb(107, 114, 128)');
  });

  test('should have proper contrast in widget dropdown', async ({ page }) => {
    await page.goto('/');

    // Wait for sidebar
    await page.waitForSelector('aside');

    // Click the + button to open widget menu
    const addButton = page.locator('button[title="Add widget"]');
    await addButton.click();
    await page.waitForTimeout(300);

    // Take screenshot of dropdown
    await page.screenshot({ path: 'tests/screenshots/widget-dropdown.png', fullPage: true });

    // Check dropdown text is visible
    const sessionOption = page.locator('button:has-text("Session Widget")');
    await expect(sessionOption).toBeVisible();

    const optionColor = await sessionOption.evaluate(el => getComputedStyle(el).color);
    console.log('Dropdown option text color:', optionColor);
    // Should be dark text (text-gray-700 = rgb(55, 65, 81))
    expect(optionColor).toBe('rgb(55, 65, 81)');
  });

  test('should have proper contrast in product switcher', async ({ page }) => {
    await page.goto('/');

    // Click the product switcher header
    const productSwitcher = page.locator('button:has-text("Expertly VibeCode")').first();
    await productSwitcher.click();
    await page.waitForTimeout(300);

    // Take screenshot of product dropdown
    await page.screenshot({ path: 'tests/screenshots/product-switcher.png', fullPage: true });

    // Check product names are visible with proper contrast
    const productName = page.locator('p.font-medium:has-text("Expertly Define")');
    await expect(productName).toBeVisible();

    const textColor = await productName.evaluate(el => getComputedStyle(el).color);
    console.log('Product name color:', textColor);
    // Should be readable dark text (text-gray-600 = rgb(75, 85, 99))
    expect(textColor).toBe('rgb(75, 85, 99)');
  });

  test('chat widget should have proper violet theme', async ({ page }) => {
    await page.goto('/');

    // Click the + button to open widget menu
    const addButton = page.locator('button[title="Add widget"]');
    await addButton.click();
    await page.waitForTimeout(300);

    // Click Chat Widget option
    const chatOption = page.locator('button:has-text("Chat Widget")');
    await chatOption.click();
    await page.waitForTimeout(500);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/chat-widget.png', fullPage: true });

    // Check chat widget header has violet background
    const chatHeader = page.locator('.bg-violet-50').first();
    await expect(chatHeader).toBeVisible();
  });
});
