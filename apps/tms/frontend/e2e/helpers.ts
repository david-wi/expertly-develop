/**
 * Shared helpers for TMS E2E tests.
 *
 * All tests in this suite use API mocking so they can run without a live backend.
 * The `setupMocks` helper intercepts every `/api/v1/**` request and returns
 * deterministic fixture data from `./fixtures/mock-data`.
 */

import { Page, expect } from '@playwright/test';
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

// ---------------------------------------------------------------------------
// API mocking
// ---------------------------------------------------------------------------

/**
 * Intercept all `/api/v1/**` calls and return mock data.
 * Must be called **before** any `page.goto()` in each test/beforeEach.
 */
export async function setupMocks(page: Page) {
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

    // Identity / user
    if (pathname.includes('/identity/me') || pathname.includes('/auth/me')) {
      return json({ id: 'user-1', email: 'test@expertly.com', name: 'Test User' });
    }

    // Organizations
    if (pathname.includes('/organizations')) {
      return json([]);
    }

    // Customers
    if (pathname.match(/\/customers\/[^/]+$/) && method === 'GET') {
      const id = pathname.split('/').pop();
      const customer = mockCustomers.find((c) => c.id === id);
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
      const carrier = mockCarriers.find((c) => c.id === id);
      return carrier ? json(carrier) : json({ detail: 'Not found' }, 404);
    }
    if (pathname.includes('/carriers') && method === 'GET') {
      const urlObj = new URL(url);
      const equipmentType = urlObj.searchParams.get('equipment_type');
      if (equipmentType) {
        const filtered = mockCarriers.filter((c) =>
          c.equipment_types.includes(equipmentType),
        );
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
      const qr = mockQuoteRequests.find((q) => q.id === id);
      return json({ ...qr, extraction_confidence: 0.95 });
    }
    if (
      pathname.match(/\/quote-requests\/[^/]+\/create-quote/) &&
      method === 'POST'
    ) {
      return json(
        { id: 'quote-new', quote_number: 'Q-2024-00099', status: 'draft' },
        201,
      );
    }
    if (pathname.match(/\/quote-requests\/[^/]+$/) && method === 'GET') {
      const id = pathname.split('/').pop();
      const qr = mockQuoteRequests.find((q) => q.id === id);
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
      const quote = mockQuotes.find((q) => q.id === id);
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
      return json(
        {
          id: 'quote-new',
          quote_number: 'Q-2024-00099',
          status: 'draft',
          ...body,
        },
        201,
      );
    }

    // Shipments
    if (
      pathname.match(/\/shipments\/[^/]+\/suggest-carriers/) &&
      method === 'POST'
    ) {
      return json(mockCarrierSuggestions);
    }
    if (
      pathname.match(/\/shipments\/[^/]+\/transition/) &&
      method === 'POST'
    ) {
      const body = JSON.parse(route.request().postData() || '{}');
      return json({ ...mockShipments[0], status: body.status });
    }
    if (pathname.match(/\/shipments\/[^/]+\/tenders/) && method === 'GET') {
      const id = pathname.split('/')[4];
      const tenders = mockTenders.filter((t) => t.shipment_id === id);
      return json(tenders);
    }
    if (pathname.match(/\/shipments\/[^/]+\/tracking/) && method === 'GET') {
      const id = pathname.split('/')[4];
      const events = mockTrackingEvents.filter((t) => t.shipment_id === id);
      return json(events);
    }
    if (pathname.match(/\/shipments\/[^/]+\/tracking/) && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json({ id: 'track-new', ...body }, 201);
    }
    if (pathname.match(/\/shipments\/[^/]+$/) && method === 'GET') {
      const id = pathname.split('/').pop();
      const shipment = mockShipments.find((s) => s.id === id);
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
        const filtered = mockShipments.filter((s) => s.status === status);
        return json(filtered);
      }
      return json(mockShipments);
    }
    if (pathname.includes('/shipments') && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json(
        {
          id: 'ship-new',
          shipment_number: 'S-2024-00100',
          status: 'booked',
          ...body,
        },
        201,
      );
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
    if (
      pathname.match(/\/invoices\/from-shipment\/[^/]+/) &&
      method === 'POST'
    ) {
      return json(
        {
          id: 'inv-new',
          invoice_number: 'INV-2024-00200',
          status: 'draft',
        },
        201,
      );
    }
    if (pathname.match(/\/invoices\/[^/]+\/send/) && method === 'POST') {
      return json({ ...mockInvoices[0], status: 'sent' });
    }
    if (pathname.match(/\/invoices\/[^/]+\/mark-paid/) && method === 'POST') {
      return json({ ...mockInvoices[0], status: 'paid' });
    }
    if (pathname.match(/\/invoices\/[^/]+$/) && method === 'GET') {
      const id = pathname.split('/').pop();
      const invoice = mockInvoices.find((i) => i.id === id);
      return invoice ? json(invoice) : json({ detail: 'Not found' }, 404);
    }
    if (pathname.includes('/invoices') && method === 'GET') {
      return json(mockInvoices);
    }
    if (pathname.includes('/invoices') && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json(
        {
          id: 'inv-new',
          invoice_number: 'INV-2024-00200',
          status: 'draft',
          ...body,
        },
        201,
      );
    }

    // Work Items
    if (pathname.includes('/work-items/dashboard') && method === 'GET') {
      return json(mockDashboardStats);
    }
    if (pathname.includes('/work-items') && method === 'GET') {
      return json(mockWorkItems);
    }

    // Search
    if (pathname.includes('/search') && method === 'GET') {
      const urlObj = new URL(url);
      const q = (urlObj.searchParams.get('q') || '').toLowerCase();
      const results = [
        ...mockShipments
          .filter(
            (s) =>
              s.shipment_number.toLowerCase().includes(q) ||
              s.origin_city.toLowerCase().includes(q),
          )
          .map((s) => ({
            id: s.id,
            type: 'shipment' as const,
            title: s.shipment_number,
            subtitle: `${s.origin_city}, ${s.origin_state} → ${s.destination_city}, ${s.destination_state}`,
            score: 90,
          })),
        ...mockCustomers
          .filter((c) => c.name.toLowerCase().includes(q))
          .map((c) => ({
            id: c.id,
            type: 'customer' as const,
            title: c.name,
            subtitle: `${c.city}, ${c.state}`,
            score: 85,
          })),
        ...mockCarriers
          .filter((c) => c.name.toLowerCase().includes(q))
          .map((c) => ({
            id: c.id,
            type: 'carrier' as const,
            title: c.name,
            subtitle: `MC# ${c.mc_number}`,
            score: 80,
          })),
      ];
      return json({ results, total: results.length, query: q, entity_type: 'all' });
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

    // Driver App
    if (pathname.includes('/driver-app/login') && method === 'POST') {
      return json({
        driver_id: 'driver-1',
        name: 'Test Driver',
        phone: '5551234567',
        carrier_id: 'carr-1',
        token: 'fake-token',
      });
    }
    if (pathname.includes('/driver-app/my-loads') && method === 'GET') {
      return json([]);
    }
    if (pathname.includes('/driver-app/my-schedule') && method === 'GET') {
      return json([]);
    }
    if (pathname.includes('/driver-app/my-location') && method === 'PUT') {
      return json({ ok: true });
    }

    // Default fallback
    return json({});
  });
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the sidebar navigation to be fully rendered.
 * The Layout component uses the shared `<Sidebar>` from @expertly/ui.
 */
export async function waitForSidebar(page: Page) {
  await expect(page.locator('nav').first()).toBeVisible({ timeout: 10_000 });
}

/**
 * Navigate to a path inside the Layout and wait for the page content to settle.
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

/**
 * Login through the identity service.
 * Currently the E2E tests use API mocks so no real login is needed,
 * but this helper is here for when tests run against the live site.
 */
export async function login(page: Page) {
  const email = process.env.IDENTITY_EMAIL || 'david@expertly.com';
  const password = process.env.IDENTITY_PASSWORD || 'expertly123';

  await page.goto('https://identity.ai.devintensive.com/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL('**/tms**', { timeout: 15_000 });
}
