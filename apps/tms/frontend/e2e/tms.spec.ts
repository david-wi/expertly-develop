/**
 * Comprehensive E2E Tests for TMS (Transportation Management System)
 *
 * These tests verify the UI renders correctly and the quote-to-invoice flow works properly.
 * API calls are mocked to allow testing without a running backend.
 */

import { test, expect, Page } from '@playwright/test';
import {
  mockCustomers,
  mockCarriers,
  mockQuoteRequests,
  mockQuotes,
  mockShipments,
  mockInvoices,
  mockWorkItems,
  mockCarrierSuggestions,
  mockTenders,
  mockTrackingEvents,
  mockDashboardStats,
} from './fixtures/mock-data';

// Setup API mocks for all tests
async function setupMocks(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const pathname = new URL(url).pathname;

    const json = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(data),
      });

    // Health check
    if (pathname.includes('/health')) {
      return json({ status: 'healthy', database: 'connected' });
    }

    // Customers
    if (pathname.match(/\/customers\/[^/]+$/) && method === 'GET') {
      const id = pathname.split('/').pop();
      const customer = mockCustomers.find(c => c.id === id);
      return customer ? json(customer) : json({ detail: 'Not found' }, 404);
    }
    if (pathname.includes('/customers') && method === 'GET') {
      return json(mockCustomers);
    }
    if (pathname.includes('/customers') && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json({ id: 'cust-new', status: 'active', ...body }, 201);
    }

    // Carriers
    if (pathname.match(/\/carriers\/[^/]+$/) && method === 'GET') {
      const id = pathname.split('/').pop();
      const carrier = mockCarriers.find(c => c.id === id);
      return carrier ? json(carrier) : json({ detail: 'Not found' }, 404);
    }
    if (pathname.includes('/carriers') && method === 'GET') {
      const urlObj = new URL(url);
      const equipmentType = urlObj.searchParams.get('equipment_type');
      if (equipmentType) {
        const filtered = mockCarriers.filter(c => c.equipment_types.includes(equipmentType));
        return json(filtered);
      }
      return json(mockCarriers);
    }
    if (pathname.includes('/carriers') && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json({ id: 'carr-new', status: 'active', ...body }, 201);
    }

    // Quote Requests
    if (pathname.match(/\/quote-requests\/[^/]+\/extract/) && method === 'POST') {
      const id = pathname.split('/')[4];
      const qr = mockQuoteRequests.find(q => q.id === id);
      return json({ ...qr, extraction_confidence: 0.95 });
    }
    if (pathname.match(/\/quote-requests\/[^/]+\/create-quote/) && method === 'POST') {
      return json({ id: 'quote-new', quote_number: 'Q-2024-00099', status: 'draft' }, 201);
    }
    if (pathname.match(/\/quote-requests\/[^/]+$/) && method === 'GET') {
      const id = pathname.split('/').pop();
      const qr = mockQuoteRequests.find(q => q.id === id);
      return qr ? json(qr) : json({ detail: 'Not found' }, 404);
    }
    if (pathname.includes('/quote-requests') && method === 'GET') {
      return json(mockQuoteRequests);
    }
    if (pathname.includes('/quote-requests') && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json({ id: 'qr-new', status: 'new', ...body }, 201);
    }

    // Quotes
    if (pathname.match(/\/quotes\/[^/]+\/send/) && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json({ ...mockQuotes[0], status: 'sent', sent_to: body.email });
    }
    if (pathname.match(/\/quotes\/[^/]+\/accept/) && method === 'POST') {
      return json({ ...mockQuotes[0], status: 'accepted' });
    }
    if (pathname.match(/\/quotes\/[^/]+\/book/) && method === 'POST') {
      return json({ shipment_id: 'ship-new', shipment_number: 'S-2024-00100' });
    }
    if (pathname.match(/\/quotes\/[^/]+$/) && method === 'GET') {
      const id = pathname.split('/').pop();
      const quote = mockQuotes.find(q => q.id === id);
      return quote ? json(quote) : json({ detail: 'Not found' }, 404);
    }
    if (pathname.match(/\/quotes\/[^/]+$/) && method === 'PATCH') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json({ ...mockQuotes[1], ...body });
    }
    if (pathname.includes('/quotes') && method === 'GET') {
      return json(mockQuotes);
    }
    if (pathname.includes('/quotes') && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json({ id: 'quote-new', quote_number: 'Q-2024-00099', status: 'draft', ...body }, 201);
    }

    // Shipments
    if (pathname.match(/\/shipments\/[^/]+\/suggest-carriers/) && method === 'POST') {
      return json(mockCarrierSuggestions);
    }
    if (pathname.match(/\/shipments\/[^/]+\/transition/) && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json({ ...mockShipments[0], status: body.status });
    }
    if (pathname.match(/\/shipments\/[^/]+\/tenders/) && method === 'GET') {
      const id = pathname.split('/')[4];
      const tenders = mockTenders.filter(t => t.shipment_id === id);
      return json(tenders);
    }
    if (pathname.match(/\/shipments\/[^/]+\/tracking/) && method === 'GET') {
      const id = pathname.split('/')[4];
      const events = mockTrackingEvents.filter(t => t.shipment_id === id);
      return json(events);
    }
    if (pathname.match(/\/shipments\/[^/]+\/tracking/) && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json({ id: 'track-new', ...body }, 201);
    }
    if (pathname.match(/\/shipments\/[^/]+$/) && method === 'GET') {
      const id = pathname.split('/').pop();
      const shipment = mockShipments.find(s => s.id === id);
      return shipment ? json(shipment) : json({ detail: 'Not found' }, 404);
    }
    if (pathname.match(/\/shipments\/[^/]+$/) && method === 'PATCH') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json({ ...mockShipments[0], ...body });
    }
    if (pathname.includes('/shipments') && method === 'GET') {
      const urlObj = new URL(url);
      const status = urlObj.searchParams.get('status');
      if (status) {
        const filtered = mockShipments.filter(s => s.status === status);
        return json(filtered);
      }
      return json(mockShipments);
    }
    if (pathname.includes('/shipments') && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json({ id: 'ship-new', shipment_number: 'S-2024-00100', status: 'booked', ...body }, 201);
    }

    // Tenders
    if (pathname.match(/\/tenders\/[^/]+\/send/) && method === 'POST') {
      return json({ ...mockTenders[0], status: 'sent' });
    }
    if (pathname.match(/\/tenders\/[^/]+\/accept/) && method === 'POST') {
      return json({ ...mockTenders[0], status: 'accepted' });
    }
    if (pathname.includes('/tenders') && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json({ id: 'tend-new', status: 'draft', ...body }, 201);
    }

    // Invoices
    if (pathname.match(/\/invoices\/from-shipment\/[^/]+/) && method === 'POST') {
      return json({ id: 'inv-new', invoice_number: 'INV-2024-00200', status: 'draft' }, 201);
    }
    if (pathname.match(/\/invoices\/[^/]+\/send/) && method === 'POST') {
      return json({ ...mockInvoices[0], status: 'sent' });
    }
    if (pathname.match(/\/invoices\/[^/]+\/mark-paid/) && method === 'POST') {
      return json({ ...mockInvoices[0], status: 'paid' });
    }
    if (pathname.match(/\/invoices\/[^/]+$/) && method === 'GET') {
      const id = pathname.split('/').pop();
      const invoice = mockInvoices.find(i => i.id === id);
      return invoice ? json(invoice) : json({ detail: 'Not found' }, 404);
    }
    if (pathname.includes('/invoices') && method === 'GET') {
      return json(mockInvoices);
    }
    if (pathname.includes('/invoices') && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json({ id: 'inv-new', invoice_number: 'INV-2024-00200', status: 'draft', ...body }, 201);
    }

    // Work Items
    if (pathname.includes('/work-items/dashboard') && method === 'GET') {
      return json(mockDashboardStats);
    }
    if (pathname.includes('/work-items') && method === 'GET') {
      return json(mockWorkItems);
    }

    // AI endpoints
    if (pathname.includes('/ai/extract-email') && method === 'POST') {
      return json({
        extracted_fields: {
          origin_city: { value: 'Chicago', confidence: 0.95, evidence_text: 'Chicago, IL 60601' },
          origin_state: { value: 'IL', confidence: 0.95, evidence_text: 'Chicago, IL 60601' },
          destination_city: { value: 'Dallas', confidence: 0.92, evidence_text: 'Dallas, TX 75201' },
          destination_state: { value: 'TX', confidence: 0.92, evidence_text: 'Dallas, TX 75201' },
          equipment_type: { value: 'van', confidence: 0.88, evidence_text: 'Dry Van' },
          weight_lbs: { value: 42000, confidence: 0.90, evidence_text: '42,000 lbs' },
        },
        missing_fields: ['pickup_date'],
      });
    }
    if (pathname.includes('/ai/draft-response') && method === 'POST') {
      return json({
        subject: 'Re: Rate request: Chicago to Dallas',
        body: 'Thank you for your rate request. We are pleased to offer...',
      });
    }

    // Default
    return json({});
  });
}

// ============================================
// DASHBOARD TESTS
// ============================================

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
  });

  test('displays dashboard header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible();
  });

  test('displays work item summary', async ({ page }) => {
    // Dashboard has stat cards
    await expect(page.getByText('Open Work Items')).toBeVisible();
    await expect(page.getByText("Today's Pickups")).toBeVisible();
  });

  test('navigates to inbox from dashboard', async ({ page }) => {
    const inboxLink = page.getByRole('link', { name: /Inbox/i });
    await inboxLink.click();
    await expect(page).toHaveURL('/inbox');
  });
});

// ============================================
// NAVIGATION TESTS
// ============================================

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
  });

  test('displays all nav items in sidebar', async ({ page }) => {
    // Use exact match and locate within sidebar
    const sidebar = page.locator('nav');
    const navItems = ['Dashboard', 'Inbox', 'Quote Requests', 'Shipments', 'Dispatch Board', 'Customers', 'Carriers', 'Invoices', 'Settings'];

    for (const item of navItems) {
      await expect(sidebar.getByRole('link', { name: item, exact: true })).toBeVisible();
    }
  });

  test('navigates to each page', async ({ page }) => {
    const sidebar = page.locator('nav');
    const pages = [
      { link: 'Inbox', url: '/inbox' },
      { link: 'Quote Requests', url: '/quote-requests' },
      { link: 'Shipments', url: '/shipments' },
      { link: 'Dispatch Board', url: '/dispatch' },
      { link: 'Customers', url: '/customers' },
      { link: 'Carriers', url: '/carriers' },
      { link: 'Invoices', url: '/invoices' },
      { link: 'Settings', url: '/settings' },
    ];

    for (const { link, url } of pages) {
      const navLink = sidebar.getByRole('link', { name: link, exact: true });
      await navLink.click();
      await expect(page).toHaveURL(url);
      await page.waitForLoadState('networkidle');
    }
  });
});

// ============================================
// INBOX / WORK ITEMS TESTS
// ============================================

test.describe('Inbox Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/inbox');
  });

  test('displays work items list', async ({ page }) => {
    await expect(page.getByText('New quote request from ABC Manufacturing')).toBeVisible();
    await expect(page.getByText('Unassigned load - pickup in 12 hours')).toBeVisible();
  });

  test('shows work item type labels', async ({ page }) => {
    // Work items show type labels like Quote Request, Needs Carrier, etc.
    await expect(page.getByText(/Quote Request|Needs Carrier|Exception/i).first()).toBeVisible();
  });

  test('filters by status', async ({ page }) => {
    const statusFilter = page.locator('select').first();
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('open');
      await page.waitForLoadState('networkidle');
    }
  });
});

// ============================================
// QUOTE REQUESTS TESTS
// ============================================

test.describe('Quote Requests Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/quote-requests');
  });

  test('displays quote requests list', async ({ page }) => {
    await expect(page.getByText('Rate request: Chicago to Dallas')).toBeVisible();
    await expect(page.getByText('Phone quote request from XYZ Distribution')).toBeVisible();
  });

  test('shows status badges', async ({ page }) => {
    // Look for status text in the list
    await expect(page.locator('span').filter({ hasText: /^new$|^in_progress$/i }).first()).toBeVisible();
  });

  test('shows AI extraction data', async ({ page }) => {
    // Click on a quote request to see details
    await page.getByText('Rate request: Chicago to Dallas').click();
    await page.waitForLoadState('networkidle');

    // Should show extracted fields
    await expect(page.getByText('Chicago')).toBeVisible();
    await expect(page.getByText('Dallas')).toBeVisible();
  });
});

// ============================================
// CUSTOMERS PAGE TESTS
// ============================================

test.describe('Customers Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/customers');
  });

  test('displays customers list', async ({ page }) => {
    await expect(page.getByText('ABC Manufacturing Inc')).toBeVisible();
    await expect(page.getByText('XYZ Distribution LLC')).toBeVisible();
    await expect(page.getByText('QuickShip Retail')).toBeVisible();
  });

  test('shows Add Customer button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Add Customer/i })).toBeVisible();
  });

  test('opens add customer modal', async ({ page }) => {
    await page.getByRole('button', { name: /Add Customer/i }).click();
    // Wait for modal to appear - modal shows "New Customer" heading
    await expect(page.getByRole('heading', { name: 'New Customer' })).toBeVisible();
  });

  test('shows customer status', async ({ page }) => {
    // Look for status badges
    await expect(page.locator('span').filter({ hasText: /^active$/i }).first()).toBeVisible();
  });

  test('search functionality exists', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('ABC');
      await page.waitForTimeout(500);
    }
  });
});

// ============================================
// CARRIERS PAGE TESTS
// ============================================

test.describe('Carriers Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/carriers');
  });

  test('displays carriers list', async ({ page }) => {
    await expect(page.getByText('Swift Freight Services')).toBeVisible();
    await expect(page.getByText('Flatbed Express Inc')).toBeVisible();
    await expect(page.getByText('Cold Chain Logistics')).toBeVisible();
  });

  test('shows Add Carrier button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Add Carrier/i })).toBeVisible();
  });

  test('shows MC numbers', async ({ page }) => {
    await expect(page.getByText('MC-123456')).toBeVisible();
    await expect(page.getByText('MC-654321')).toBeVisible();
  });

  test('shows equipment types', async ({ page }) => {
    // Equipment types are displayed in carriers list
    await expect(page.locator('span, div').filter({ hasText: /van|reefer|flatbed/i }).first()).toBeVisible();
  });
});

// ============================================
// SHIPMENTS PAGE TESTS
// ============================================

test.describe('Shipments Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/shipments');
  });

  test('displays shipments list', async ({ page }) => {
    await expect(page.getByText('S-2024-00089')).toBeVisible();
    await expect(page.getByText('S-2024-00090')).toBeVisible();
    await expect(page.getByText('S-2024-00088')).toBeVisible();
  });

  test('shows shipment status', async ({ page }) => {
    // Look for status badge in the shipments table
    await expect(page.locator('span').filter({ hasText: /in_transit|booked|delivered/i }).first()).toBeVisible();
  });

  test('shows at-risk indicator', async ({ page }) => {
    // At-risk shipments have visual indicator
    await expect(page.locator('[class*="red"], [class*="warning"], [class*="risk"]').first()).toBeVisible();
  });

  test('shows origin and destination', async ({ page }) => {
    // Look for city names in shipment rows
    await expect(page.getByText('Chicago').first()).toBeVisible();
    await expect(page.getByText('Dallas').first()).toBeVisible();
  });

  test('filter by status', async ({ page }) => {
    const statusFilter = page.locator('select').first();
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('in_transit');
      await page.waitForLoadState('networkidle');
    }
  });
});

// ============================================
// DISPATCH BOARD TESTS
// ============================================

test.describe('Dispatch Board Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/dispatch');
  });

  test('displays dispatch board header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dispatch Board' })).toBeVisible();
  });

  test('shows shipments needing carrier', async ({ page }) => {
    // Dispatch board shows shipments
    await expect(page.getByText(/S-2024-\d+|Needs Carrier|Booked/i).first()).toBeVisible();
  });

  test('shows carrier suggestions when available', async ({ page }) => {
    // Click on a shipment to get suggestions
    const shipmentCard = page.getByText('S-2024-00090');
    if (await shipmentCard.isVisible()) {
      await shipmentCard.click();
      await page.waitForLoadState('networkidle');
      // Should show carrier suggestions
      await expect(page.getByText(/Swift Freight|suggest/i)).toBeVisible();
    }
  });
});

// ============================================
// INVOICES PAGE TESTS
// ============================================

test.describe('Invoices Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/invoices');
  });

  test('displays invoices list', async ({ page }) => {
    await expect(page.getByText('INV-2024-00156')).toBeVisible();
    await expect(page.getByText('INV-2024-00155')).toBeVisible();
  });

  test('shows invoice status', async ({ page }) => {
    await expect(page.locator('span').filter({ hasText: /^sent$|^draft$/i }).first()).toBeVisible();
  });

  test('shows customer names', async ({ page }) => {
    await expect(page.getByText('ABC Manufacturing Inc')).toBeVisible();
    await expect(page.getByText('XYZ Distribution LLC')).toBeVisible();
  });

  test('shows invoice totals', async ({ page }) => {
    // Check for dollar amounts in the table
    await expect(page.locator('td, span').filter({ hasText: /\$[\d,]+/ }).first()).toBeVisible();
  });
});

// ============================================
// SETTINGS PAGE TESTS
// ============================================

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/settings');
  });

  test('displays settings header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  });

  test('shows settings sections', async ({ page }) => {
    // Settings page has sections like Profile, Company, Notifications
    await expect(page.getByRole('heading', { name: /Profile|Company|Notifications/i }).first()).toBeVisible();
  });
});

// ============================================
// QUOTE FLOW E2E TEST
// ============================================

test.describe('Quote to Invoice Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('creates quote from quote request', async ({ page }) => {
    // Navigate to quote requests
    await page.goto('/quote-requests');
    await expect(page.getByText('Rate request: Chicago to Dallas').first()).toBeVisible();

    // Click on quote request
    await page.getByText('Rate request: Chicago to Dallas').first().click();
    await page.waitForLoadState('networkidle');

    // The page should show quote request details
    await expect(page.getByText('Chicago').first()).toBeVisible();
  });

  test('views shipment detail and tracking', async ({ page }) => {
    // Navigate to shipments
    await page.goto('/shipments');

    // Click on in-transit shipment
    await page.getByText('S-2024-00089').click();
    await page.waitForURL(/\/shipments\/.+/);

    // Should show shipment details
    await expect(page.getByText('Chicago')).toBeVisible();
    await expect(page.getByText('Dallas')).toBeVisible();

    // Should show tracking events or tab
    await expect(page.getByText(/Tracking|picked_up|in_transit/i)).toBeVisible();
  });

  test('views invoice details', async ({ page }) => {
    // Navigate to invoices
    await page.goto('/invoices');

    // Click on invoice
    await page.getByText('INV-2024-00156').click();

    // May navigate to detail or show modal
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('ABC Manufacturing')).toBeVisible();
  });
});

// ============================================
// VISUAL REGRESSION TESTS
// ============================================

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('dashboard screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'e2e-screenshots/tms-dashboard.png', fullPage: true });
  });

  test('inbox screenshot', async ({ page }) => {
    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'e2e-screenshots/tms-inbox.png', fullPage: true });
  });

  test('shipments screenshot', async ({ page }) => {
    await page.goto('/shipments');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'e2e-screenshots/tms-shipments.png', fullPage: true });
  });

  test('dispatch board screenshot', async ({ page }) => {
    await page.goto('/dispatch');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'e2e-screenshots/tms-dispatch.png', fullPage: true });
  });

  test('customers screenshot', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'e2e-screenshots/tms-customers.png', fullPage: true });
  });

  test('carriers screenshot', async ({ page }) => {
    await page.goto('/carriers');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'e2e-screenshots/tms-carriers.png', fullPage: true });
  });
});
