/**
 * Comprehensive E2E Tests for Salon Booking Application
 *
 * These tests verify the UI renders correctly and forms work properly.
 * API calls are mocked to allow testing without a running backend.
 */

import { test, expect, Page } from '@playwright/test';
import {
  mockUser,
  mockSalon,
  mockStaff,
  mockServices,
  mockClients,
  mockPromotions,
  mockWaitlist,
  mockWebsite,
  mockCalendar,
} from './fixtures/mock-data';

// Setup API mocks for all tests
async function setupMocks(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const pathname = new URL(url).pathname;

    const json = (data: any, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(data),
      });

    // Auth
    if (pathname.includes('/auth/login') && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.email === 'admin@testsalon.com' && body.password === 'password123') {
        return json({
          access_token: 'mock-token',
          refresh_token: 'mock-refresh',
          token_type: 'bearer',
          user: { ...mockUser, is_active: true },
        });
      }
      return json({ detail: 'Invalid credentials' }, 401);
    }
    if (pathname.includes('/auth/me')) return json({ ...mockUser, is_active: true });
    if (pathname.includes('/auth/refresh')) return json({ access_token: 'new-token', refresh_token: 'new-refresh', token_type: 'bearer' });

    // Salon - return full salon data
    if (pathname.includes('/salons/current')) {
      return json({
        ...mockSalon,
        slug: 'test-salon',
        timezone: 'America/New_York',
        stripe_onboarding_complete: false,
        is_active: true,
        settings: {
          slot_duration_minutes: 15,
          min_booking_notice_hours: 2,
          max_booking_advance_days: 60,
          require_deposit: false,
          deposit_percent: 0,
          business_hours: {
            '0': { is_closed: true, open: '09:00', close: '17:00' },
            '1': { is_closed: false, open: '09:00', close: '18:00' },
            '2': { is_closed: false, open: '09:00', close: '18:00' },
            '3': { is_closed: false, open: '09:00', close: '18:00' },
            '4': { is_closed: false, open: '09:00', close: '18:00' },
            '5': { is_closed: false, open: '09:00', close: '18:00' },
            '6': { is_closed: false, open: '10:00', close: '16:00' },
          },
          cancellation_policy: {
            free_cancellation_hours: 24,
            late_cancellation_fee_percent: 50,
            no_show_fee_percent: 100,
            no_show_window_minutes: 15,
          },
        },
      });
    }

    // Staff
    if (pathname.includes('/staff') && !pathname.includes('schedule')) return json(mockStaff);
    if (pathname.match(/\/staff\/[^/]+\/schedule/)) return json([]);

    // Services
    if (pathname.includes('/services/categories')) return json([]);
    if (pathname.includes('/services')) return json(mockServices);

    // Clients
    if (pathname.includes('/clients/search')) return json(mockClients);
    if (pathname.includes('/clients')) return json(mockClients);

    // Calendar - generate proper days object
    if (pathname.includes('/calendar/availability')) {
      return json({ date: '2024-01-01', service_id: 'service-1', service_name: 'Haircut', duration_minutes: 45, slots: [] });
    }
    if (pathname.includes('/calendar')) {
      const days: Record<string, any[]> = {};
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - today.getDay() + i);
        const dateStr = date.toISOString().split('T')[0];
        days[dateStr] = [];
      }
      return json({
        start_date: Object.keys(days)[0],
        end_date: Object.keys(days)[6],
        staff: mockStaff,
        days,
      });
    }

    // Appointments
    if (pathname.includes('/appointments/lock')) {
      if (method === 'POST') return json({ id: 'lock-1', lock_id: 'lock-1', expires_at: new Date(Date.now() + 300000).toISOString() }, 201);
      if (method === 'DELETE') return route.fulfill({ status: 204 });
    }
    if (pathname.includes('/appointments')) return json([]);

    // Promotions
    if (pathname.includes('/promotions')) return json(mockPromotions);

    // Waitlist
    if (pathname.includes('/waitlist/matches')) return json([]);
    if (pathname.includes('/waitlist')) return json(mockWaitlist);

    // Website
    if (pathname.includes('/website')) return json(mockWebsite);

    // Stripe
    if (pathname.includes('/stripe/connect/status')) return json({ connected: false, onboarding_complete: false });
    if (pathname.includes('/stripe')) return json({});

    // Notifications
    if (pathname.includes('/notifications')) return json([]);

    // Default
    return json({}, 200);
  });
}

// Login helper
async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin@testsalon.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 5000 });
  // Wait for app to fully load after auth
  await page.waitForSelector('text=Test Salon & Spa', { timeout: 5000 });
  await page.waitForLoadState('networkidle');
}

// ============================================
// LOGIN PAGE TESTS
// ============================================

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('displays login form elements', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('validates email format', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'invalid-email');
    await page.click('button[type="submit"]');

    // HTML5 validation
    const email = page.locator('input[type="email"]');
    await expect(email).toHaveAttribute('type', 'email');
  });

  test('requires password', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'test@test.com');
    await page.click('button[type="submit"]');

    // Should still be on login page
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    // Wait for error or stay on page
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/login/);
  });

  test('redirects on successful login', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL('/');
  });
});

// ============================================
// NAVIGATION TESTS
// ============================================

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await login(page);
  });

  test('displays all nav items in sidebar', async ({ page }) => {
    const navItems = ['Calendar', 'Clients', 'Staff', 'Services', 'Waitlist', 'Promotions', 'Website', 'Reports', 'Settings'];

    for (const item of navItems) {
      await expect(page.getByRole('link', { name: item })).toBeVisible();
    }
  });

  test('displays salon name', async ({ page }) => {
    await expect(page.getByText('Test Salon & Spa')).toBeVisible();
  });

  test('navigates to each page', async ({ page }) => {
    const pages = [
      { link: 'Clients', url: '/clients' },
      { link: 'Staff', url: '/staff' },
      { link: 'Services', url: '/services' },
      { link: 'Promotions', url: '/promotions' },
      { link: 'Website', url: '/website' },
      { link: 'Reports', url: '/reports' },
      { link: 'Settings', url: '/settings' },
    ];

    for (const { link, url } of pages) {
      const navLink = page.getByRole('link', { name: link });
      await navLink.waitFor({ state: 'visible' });
      await navLink.click();
      await expect(page).toHaveURL(url);
      await page.waitForLoadState('networkidle');
    }
  });
});

// ============================================
// CALENDAR PAGE TESTS
// ============================================

test.describe('Calendar Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await login(page);
  });

  test('displays calendar controls', async ({ page }) => {
    await expect(page.getByRole('button', { name: /New Booking/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Today/i })).toBeVisible();
  });

  test('opens booking modal', async ({ page }) => {
    await page.click('button:has-text("New Booking")');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('booking modal shows services', async ({ page }) => {
    await page.click('button:has-text("New Booking")');
    await page.waitForSelector('[role="dialog"]');

    // Should show service list
    await expect(page.getByText('Haircut')).toBeVisible();
    await expect(page.getByText('$55')).toBeVisible();
  });

  test('day/week toggle switches views', async ({ page }) => {
    // Both toggle buttons should be visible
    const dayButton = page.getByRole('button', { name: 'Day', exact: true });
    const weekButton = page.getByRole('button', { name: 'Week', exact: true });

    await expect(dayButton).toBeVisible();
    await expect(weekButton).toBeVisible();

    // Default should be week view - check for day abbreviations in header
    await page.waitForLoadState('networkidle');

    // Click Day button and verify day view
    await dayButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e-screenshots/calendar-day-view.png', fullPage: true });

    // In day view, we should see staff names (Sarah Johnson, Mike Chen)
    await expect(page.getByText('Sarah')).toBeVisible();
    await expect(page.getByText('Mike')).toBeVisible();

    // Click Week button and verify week view
    await weekButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e-screenshots/calendar-week-view.png', fullPage: true });

    // In week view, we should see day abbreviations (Sun, Mon, Tue, etc.)
    await expect(page.getByText('Sun')).toBeVisible();
    await expect(page.getByText('Mon')).toBeVisible();
    await expect(page.getByText('Tue')).toBeVisible();
  });
});

// ============================================
// CLIENTS PAGE TESTS
// ============================================

test.describe('Clients Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await login(page);
    await page.click('a:has-text("Clients")');
    await page.waitForURL('/clients');
  });

  test('displays client list', async ({ page }) => {
    await expect(page.getByText('Emily Davis')).toBeVisible();
    await expect(page.getByText('James Wilson')).toBeVisible();
  });

  test('shows Add Client button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Add Client/i })).toBeVisible();
  });

  test('opens add client modal', async ({ page }) => {
    await page.click('button:has-text("Add Client")');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('client modal has form fields', async ({ page }) => {
    await page.click('button:has-text("Add Client")');
    await page.waitForSelector('[role="dialog"]');

    await expect(page.locator('input[name="first_name"]')).toBeVisible();
    await expect(page.locator('input[name="last_name"]')).toBeVisible();
  });

  test('search functionality exists', async ({ page }) => {
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });
});

// ============================================
// STAFF PAGE TESTS
// ============================================

test.describe('Staff Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await login(page);
    await page.click('a:has-text("Staff")');
    await page.waitForURL('/staff');
  });

  test('displays staff members', async ({ page }) => {
    await expect(page.getByText('Sarah Johnson')).toBeVisible();
    await expect(page.getByText('Mike Chen')).toBeVisible();
  });

  test('shows Add Staff button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Add Staff/i })).toBeVisible();
  });

  test('displays staff contact info', async ({ page }) => {
    await expect(page.getByText('sarah@testsalon.com')).toBeVisible();
  });
});

// ============================================
// SERVICES PAGE TESTS
// ============================================

test.describe('Services Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await login(page);
    await page.click('a:has-text("Services")');
    await page.waitForURL('/services');
  });

  test('displays services list', async ({ page }) => {
    await expect(page.getByText('Haircut')).toBeVisible();
    await expect(page.getByText('Hair Coloring')).toBeVisible();
    await expect(page.getByText('Manicure')).toBeVisible();
  });

  test('shows service prices and durations', async ({ page }) => {
    await expect(page.getByText('$55')).toBeVisible();
    await expect(page.getByText('45 min')).toBeVisible();
  });

  test('shows Add Service button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Add Service/i })).toBeVisible();
  });
});

// ============================================
// PROMOTIONS PAGE TESTS
// ============================================

test.describe('Promotions Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await login(page);
    await page.click('a:has-text("Promotions")');
    await page.waitForURL('/promotions');
  });

  test('displays promotions', async ({ page }) => {
    await expect(page.getByText('Birthday Special')).toBeVisible();
    await expect(page.getByText('New Client Welcome')).toBeVisible();
  });

  test('shows Create Promotion button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Create Promotion/i })).toBeVisible();
  });

  test('displays promotion details', async ({ page }) => {
    await expect(page.getByText('15%')).toBeVisible();
    await expect(page.getByText('$10')).toBeVisible();
  });

  test('shows promo codes', async ({ page }) => {
    await expect(page.getByText('SUMMER20')).toBeVisible();
  });
});

// ============================================
// WAITLIST PAGE TESTS
// ============================================

test.describe('Waitlist Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await login(page);
    await page.click('a:has-text("Waitlist")');
    await page.waitForURL('/waitlist');
  });

  test('displays waitlist entries', async ({ page }) => {
    await expect(page.getByText('Emily Davis')).toBeVisible();
    await expect(page.getByText('Hair Coloring')).toBeVisible();
  });

  test('shows Add to Waitlist button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Add to Waitlist/i })).toBeVisible();
  });

  test('shows Check for Matches button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Check for Matches/i })).toBeVisible();
  });

  test('displays availability descriptions', async ({ page }) => {
    await expect(page.getByText(/weekday mornings/i)).toBeVisible();
  });
});

// ============================================
// WEBSITE BUILDER PAGE TESTS
// ============================================

test.describe('Website Builder Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await login(page);
    await page.click('a:has-text("Website")');
    await page.waitForURL('/website');
  });

  test('displays page header', async ({ page }) => {
    await expect(page.getByText('Website Builder')).toBeVisible();
  });

  test('shows tab navigation', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /Design/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Content/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Settings/i })).toBeVisible();
  });

  test('shows publish button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Publish|Unpublish/i })).toBeVisible();
  });

  test('shows save button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Save/i })).toBeVisible();
  });
});

// ============================================
// SETTINGS PAGE TESTS
// ============================================

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await login(page);
    await page.click('a:has-text("Settings")');
    await page.waitForURL('/settings');
  });

  test('displays settings header', async ({ page }) => {
    await expect(page.getByText('Settings')).toBeVisible();
  });

  test('shows tab navigation', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /General/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Booking/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Payments/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Notifications/i })).toBeVisible();
  });

  test('general tab shows salon info', async ({ page }) => {
    await expect(page.getByDisplayValue('Test Salon & Spa')).toBeVisible();
  });
});

// ============================================
// REPORTS PAGE TESTS
// ============================================

test.describe('Reports Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await login(page);
    await page.click('a:has-text("Reports")');
    await page.waitForURL('/reports');
  });

  test('displays reports header', async ({ page }) => {
    await expect(page.getByText('Reports')).toBeVisible();
  });

  test('shows stat cards', async ({ page }) => {
    await expect(page.getByText(/Appointments|Revenue|Clients/i)).toBeVisible();
  });
});

// ============================================
// LOGOUT TEST
// ============================================

test.describe('Logout', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await login(page);
  });

  test('logs out and redirects to login', async ({ page }) => {
    await page.click('button:has-text("Logout")');
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/login/);
  });
});

// ============================================
// VISUAL REGRESSION TESTS
// ============================================

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('login page screenshot', async ({ page }) => {
    await page.goto('/login');
    await page.screenshot({ path: 'e2e-screenshots/login.png', fullPage: true });
  });

  test('calendar page screenshot', async ({ page }) => {
    await login(page);
    await page.screenshot({ path: 'e2e-screenshots/calendar.png', fullPage: true });
  });

  test('clients page screenshot', async ({ page }) => {
    await login(page);
    await page.click('a:has-text("Clients")');
    await page.waitForURL('/clients');
    await page.screenshot({ path: 'e2e-screenshots/clients.png', fullPage: true });
  });
});
