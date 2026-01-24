import { test, expect, Page } from '@playwright/test';

const PROD_URL = 'http://zg8cwo8osssc4oww48s4804s.152.42.152.243.sslip.io';
const API_KEY = 'e87623cff95b3847794076a899211fd8f2f4c5d17115746e59f575774c06d753';

// Helper function to authenticate
async function authenticate(page: Page) {
  // Go to the page first
  await page.goto(PROD_URL);
  await page.waitForLoadState('networkidle');

  // Check if we're on the login page
  const apiKeyInput = page.getByPlaceholder(/Enter your API key/i);
  if (await apiKeyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Fill in API key and sign in
    await apiKeyInput.fill(API_KEY);
    await page.getByRole('button', { name: /Sign in/i }).click();
    await page.waitForLoadState('networkidle');
    // Wait a bit for the app to load
    await page.waitForTimeout(1000);
  }
}

test.describe.serial('Production E2E Verification', () => {
  test('1. Login and Dashboard', async ({ page }) => {
    await authenticate(page);

    // Take screenshot of dashboard
    await page.screenshot({ path: 'e2e-screenshots/01-dashboard.png', fullPage: true });

    // The dashboard should show something after login
    await expect(page.locator('body')).not.toBeEmpty();

    console.log('Dashboard loaded successfully');
  });

  test('2. Tasks page', async ({ page }) => {
    await authenticate(page);
    await page.goto(`${PROD_URL}/tasks`);
    await page.waitForLoadState('networkidle');

    // Take screenshot of tasks page
    await page.screenshot({ path: 'e2e-screenshots/02-tasks-list.png', fullPage: true });

    console.log('Tasks page loaded');
  });

  test('3. Create task via UI', async ({ page }) => {
    await authenticate(page);
    await page.goto(`${PROD_URL}/tasks/new`);
    await page.waitForLoadState('networkidle');

    // Take screenshot of new task form
    await page.screenshot({ path: 'e2e-screenshots/03-new-task-form.png', fullPage: true });

    // Try to find and fill the form
    const titleInput = page.locator('input[name="title"], input[placeholder*="title" i], #title');
    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.fill('E2E UI Created Task - ' + new Date().toISOString().slice(0, 19));

      // Take screenshot of filled form
      await page.screenshot({ path: 'e2e-screenshots/04-task-form-filled.png', fullPage: true });

      // Try to submit
      const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'e2e-screenshots/05-task-created.png', fullPage: true });
      }
    }

    console.log('Task creation UI tested');
  });

  test('4. Task detail and lifecycle', async ({ page }) => {
    await authenticate(page);
    await page.goto(`${PROD_URL}/tasks`);
    await page.waitForLoadState('networkidle');

    // Find and click on first task
    const taskLink = page.locator('a[href*="/tasks/"]').first();
    if (await taskLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await taskLink.click();
      await page.waitForLoadState('networkidle');

      // Take screenshot of task detail
      await page.screenshot({ path: 'e2e-screenshots/06-task-detail.png', fullPage: true });

      // Try to find start button
      const startButton = page.locator('button:has-text("Start")').first();
      if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await startButton.click();
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'e2e-screenshots/07-task-started.png', fullPage: true });
        console.log('Task started');
      }
    }

    console.log('Task lifecycle tested');
  });

  test('5. Dashboard with drafts', async ({ page }) => {
    await authenticate(page);

    // Take screenshot showing drafts section
    await page.screenshot({ path: 'e2e-screenshots/08-drafts-section.png', fullPage: true });

    console.log('Drafts section captured');
  });

  test('6. Questions page', async ({ page }) => {
    await authenticate(page);
    await page.goto(`${PROD_URL}/questions`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'e2e-screenshots/09-questions-page.png', fullPage: true });

    console.log('Questions page loaded');
  });

  test('7. Playbooks page', async ({ page }) => {
    await authenticate(page);
    await page.goto(`${PROD_URL}/playbooks`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'e2e-screenshots/10-playbooks-page.png', fullPage: true });

    console.log('Playbooks page loaded');
  });

  test('8. People page', async ({ page }) => {
    await authenticate(page);
    await page.goto(`${PROD_URL}/people`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'e2e-screenshots/11-people-page.png', fullPage: true });

    console.log('People page loaded');
  });

  test('9. Projects page', async ({ page }) => {
    await authenticate(page);
    await page.goto(`${PROD_URL}/projects`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'e2e-screenshots/12-projects-page.png', fullPage: true });

    console.log('Projects page loaded');
  });

  test('10. Clients page', async ({ page }) => {
    await authenticate(page);
    await page.goto(`${PROD_URL}/clients`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'e2e-screenshots/13-clients-page.png', fullPage: true });

    console.log('Clients page loaded');
  });

  test('11. Waiting items page', async ({ page }) => {
    await authenticate(page);
    await page.goto(`${PROD_URL}/waiting`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'e2e-screenshots/14-waiting-items.png', fullPage: true });

    console.log('Waiting items page loaded');
  });

  test('12. Settings page with organization and users', async ({ page }) => {
    await authenticate(page);
    await page.goto(`${PROD_URL}/settings`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'e2e-screenshots/15-settings-organization.png', fullPage: true });

    // Click Users tab
    const usersTab = page.getByRole('button', { name: /Users/i });
    if (await usersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usersTab.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'e2e-screenshots/16-settings-users.png', fullPage: true });
    }

    console.log('Settings page loaded');
  });
});

test.describe('Playbook Matching Test', () => {
  test('12. Verify playbook matching via API', async ({ request }) => {
    // Test playbook matching endpoint
    const response = await request.post(`${PROD_URL}/api/playbooks/match`, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      data: {
        text: 'I need to review the inbox and check for emails',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    console.log('Playbook match result:', JSON.stringify(data, null, 2));
  });
});
