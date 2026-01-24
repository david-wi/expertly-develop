import { Page } from '@playwright/test';
import {
  mockUser,
  mockSalon,
  mockStaff,
  mockServices,
  mockClients,
  mockAppointments,
  mockPromotions,
  mockWaitlist,
  mockWebsite,
  mockCalendar,
  mockAvailability,
  mockWaitlistMatches,
  mockScheduleOverrides,
} from './mock-data';

// Store for dynamic mock data (for testing CRUD operations)
let dynamicStaff = [...mockStaff];
let dynamicServices = [...mockServices];
let dynamicClients = [...mockClients];
let dynamicPromotions = [...mockPromotions];
let dynamicWaitlist = [...mockWaitlist];
let dynamicWebsite = { ...mockWebsite };
let dynamicOverrides = [...mockScheduleOverrides];

export function resetMockData() {
  dynamicStaff = [...mockStaff];
  dynamicServices = [...mockServices];
  dynamicClients = [...mockClients];
  dynamicPromotions = [...mockPromotions];
  dynamicWaitlist = [...mockWaitlist];
  dynamicWebsite = { ...mockWebsite };
  dynamicOverrides = [...mockScheduleOverrides];
}

export async function setupApiMocks(page: Page) {
  // Reset data for clean state
  resetMockData();

  // Intercept ALL requests to the API and mock them
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const pathname = new URL(url).pathname;

    // Helper to send JSON response
    const json = (data: any, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(data),
      });

    try {
      // Auth endpoints
      if (pathname.endsWith('/auth/login') && method === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        if (body.email === 'admin@testsalon.com' && body.password === 'password123') {
          return json({
            access_token: 'mock-access-token-12345',
            refresh_token: 'mock-refresh-token-12345',
            token_type: 'bearer',
          });
        }
        return json({ detail: 'Invalid email or password' }, 401);
      }

      if (pathname.endsWith('/auth/me')) {
        return json(mockUser);
      }

      if (pathname.endsWith('/auth/users') && method === 'GET') {
        return json([mockUser]);
      }

      if (pathname.endsWith('/auth/users') && method === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const newUser = {
          id: `user-${Date.now()}`,
          ...body,
          is_active: true,
        };
        return json(newUser, 201);
      }

      if (pathname.match(/\/auth\/users\/[^/]+$/) && method === 'PUT') {
        const body = JSON.parse(route.request().postData() || '{}');
        return json({ ...mockUser, ...body });
      }

      if (pathname.match(/\/auth\/users\/[^/]+$/) && method === 'DELETE') {
        return route.fulfill({ status: 204 });
      }

      if (pathname.endsWith('/auth/refresh') && method === 'POST') {
        return json({
          access_token: 'mock-refreshed-token',
          refresh_token: 'mock-refresh-token',
          token_type: 'bearer',
        });
      }

      // Salon endpoints
      if (pathname.endsWith('/salons/current')) {
        if (method === 'GET') return json(mockSalon);
        if (method === 'PUT') {
          const body = JSON.parse(route.request().postData() || '{}');
          Object.assign(mockSalon, body);
          return json(mockSalon);
        }
      }

      // Staff endpoints
      if (pathname.match(/\/staff\/[^/]+\/schedule\/overrides?$/)) {
        if (method === 'GET') return json(dynamicOverrides);
        if (method === 'POST') {
          const body = JSON.parse(route.request().postData() || '{}');
          const newOverride = {
            _id: `override-${Date.now()}`,
            id: `override-${Date.now()}`,
            ...body,
            created_at: new Date().toISOString(),
          };
          dynamicOverrides.push(newOverride);
          return json(newOverride, 201);
        }
      }

      if (pathname.match(/\/staff\/[^/]+\/schedule\/override\/[^/]+$/)) {
        if (method === 'DELETE') {
          const overrideId = pathname.split('/').pop();
          dynamicOverrides = dynamicOverrides.filter(o => o._id !== overrideId && o.id !== overrideId);
          return route.fulfill({ status: 204 });
        }
      }

      if (pathname.match(/\/staff\/[^/]+$/) && !pathname.includes('/schedule')) {
        const staffId = pathname.split('/').pop();
        if (method === 'GET') {
          const staff = dynamicStaff.find(s => s._id === staffId || s.id === staffId);
          return staff ? json(staff) : json({ detail: 'Staff not found' }, 404);
        }
        if (method === 'PUT') {
          const body = JSON.parse(route.request().postData() || '{}');
          const index = dynamicStaff.findIndex(s => s._id === staffId || s.id === staffId);
          if (index >= 0) {
            dynamicStaff[index] = { ...dynamicStaff[index], ...body };
            return json(dynamicStaff[index]);
          }
          return json({ detail: 'Staff not found' }, 404);
        }
        if (method === 'DELETE') {
          dynamicStaff = dynamicStaff.filter(s => s._id !== staffId && s.id !== staffId);
          return route.fulfill({ status: 204 });
        }
      }

      if (pathname.endsWith('/staff')) {
        if (method === 'GET') return json(dynamicStaff);
        if (method === 'POST') {
          const body = JSON.parse(route.request().postData() || '{}');
          const newStaff = {
            _id: `staff-${Date.now()}`,
            id: `staff-${Date.now()}`,
            salon_id: 'salon-1',
            is_active: true,
            working_hours: { schedule: {} },
            ...body,
          };
          dynamicStaff.push(newStaff);
          return json(newStaff, 201);
        }
      }

      // Services endpoints
      if (pathname.match(/\/services\/[^/]+$/) && !pathname.includes('categories')) {
        const serviceId = pathname.split('/').pop();
        if (method === 'GET') {
          const service = dynamicServices.find(s => s._id === serviceId || s.id === serviceId);
          return service ? json(service) : json({ detail: 'Service not found' }, 404);
        }
        if (method === 'PUT') {
          const body = JSON.parse(route.request().postData() || '{}');
          const index = dynamicServices.findIndex(s => s._id === serviceId || s.id === serviceId);
          if (index >= 0) {
            dynamicServices[index] = { ...dynamicServices[index], ...body };
            return json(dynamicServices[index]);
          }
          return json({ detail: 'Service not found' }, 404);
        }
        if (method === 'DELETE') {
          dynamicServices = dynamicServices.filter(s => s._id !== serviceId && s.id !== serviceId);
          return route.fulfill({ status: 204 });
        }
      }

      if (pathname.endsWith('/services/categories')) {
        return json([]);
      }

      if (pathname.endsWith('/services')) {
        if (method === 'GET') return json(dynamicServices);
        if (method === 'POST') {
          const body = JSON.parse(route.request().postData() || '{}');
          const newService = {
            _id: `service-${Date.now()}`,
            id: `service-${Date.now()}`,
            salon_id: 'salon-1',
            is_active: true,
            sort_order: dynamicServices.length + 1,
            ...body,
          };
          dynamicServices.push(newService);
          return json(newService, 201);
        }
      }

      // Clients endpoints
      if (pathname.includes('/clients/search')) {
        const searchUrl = new URL(url);
        const query = searchUrl.searchParams.get('q')?.toLowerCase() || '';
        const filtered = dynamicClients.filter(
          c => c.first_name.toLowerCase().includes(query) ||
               c.last_name.toLowerCase().includes(query) ||
               c.phone?.includes(query)
        );
        return json(filtered);
      }

      if (pathname.match(/\/clients\/[^/]+$/)) {
        const clientId = pathname.split('/').pop();
        if (method === 'GET') {
          const client = dynamicClients.find(c => c._id === clientId || c.id === clientId);
          return client ? json(client) : json({ detail: 'Client not found' }, 404);
        }
        if (method === 'PUT') {
          const body = JSON.parse(route.request().postData() || '{}');
          const index = dynamicClients.findIndex(c => c._id === clientId || c.id === clientId);
          if (index >= 0) {
            dynamicClients[index] = { ...dynamicClients[index], ...body };
            return json(dynamicClients[index]);
          }
          return json({ detail: 'Client not found' }, 404);
        }
      }

      if (pathname.endsWith('/clients')) {
        if (method === 'GET') return json(dynamicClients);
        if (method === 'POST') {
          const body = JSON.parse(route.request().postData() || '{}');
          const newClient = {
            _id: `client-${Date.now()}`,
            id: `client-${Date.now()}`,
            salon_id: 'salon-1',
            language: 'en',
            tags: [],
            stats: { total_visits: 0, cancelled_appointments: 0, no_shows: 0, total_spent: 0 },
            created_at: new Date().toISOString(),
            ...body,
          };
          dynamicClients.push(newClient);
          return json(newClient, 201);
        }
      }

      // Calendar endpoints
      if (pathname.includes('/calendar/availability')) {
        return json(mockAvailability);
      }

      if (pathname.endsWith('/calendar')) {
        return json(mockCalendar);
      }

      // Appointments endpoints
      if (pathname.endsWith('/appointments/lock') && method === 'POST') {
        return json({
          id: 'lock-123',
          slot_start: new Date().toISOString(),
          expires_at: new Date(Date.now() + 300000).toISOString(),
        }, 201);
      }

      if (pathname.match(/\/appointments\/lock\/[^/]+/) && method === 'DELETE') {
        return route.fulfill({ status: 204 });
      }

      if (pathname.match(/\/appointments\/[^/]+\/reschedule/)) {
        const searchParams = new URL(url).searchParams;
        const newStartTime = searchParams.get('new_start_time');
        const newStaffId = searchParams.get('new_staff_id');
        return json({
          ...mockAppointments[0],
          start_time: newStartTime,
          staff_id: newStaffId || mockAppointments[0].staff_id,
        });
      }

      if (pathname.match(/\/appointments\/[^/]+\/(check-in|start|complete|cancel|no-show)/)) {
        return json({ ...mockAppointments[0], status: 'updated' });
      }

      if (pathname.endsWith('/appointments') && method === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const newAppointment = {
          _id: `appt-${Date.now()}`,
          id: `appt-${Date.now()}`,
          salon_id: 'salon-1',
          status: 'confirmed',
          ...body,
          created_at: new Date().toISOString(),
        };
        mockAppointments.push(newAppointment);
        return json(newAppointment, 201);
      }

      // Promotions endpoints
      if (pathname.match(/\/promotions\/[^/]+$/) && !pathname.includes('check') && !pathname.includes('validate')) {
        const promoId = pathname.split('/').pop();
        if (method === 'GET') {
          const promo = dynamicPromotions.find(p => p._id === promoId || p.id === promoId);
          return promo ? json(promo) : json({ detail: 'Promotion not found' }, 404);
        }
        if (method === 'PUT') {
          const body = JSON.parse(route.request().postData() || '{}');
          const index = dynamicPromotions.findIndex(p => p._id === promoId || p.id === promoId);
          if (index >= 0) {
            dynamicPromotions[index] = { ...dynamicPromotions[index], ...body };
            return json(dynamicPromotions[index]);
          }
          return json({ detail: 'Promotion not found' }, 404);
        }
        if (method === 'DELETE') {
          dynamicPromotions = dynamicPromotions.filter(p => p._id !== promoId && p.id !== promoId);
          return route.fulfill({ status: 204 });
        }
      }

      if (pathname.endsWith('/promotions')) {
        if (method === 'GET') return json(dynamicPromotions);
        if (method === 'POST') {
          const body = JSON.parse(route.request().postData() || '{}');
          const newPromo = {
            _id: `promo-${Date.now()}`,
            id: `promo-${Date.now()}`,
            salon_id: 'salon-1',
            usage_count: 0,
            created_at: new Date().toISOString(),
            ...body,
          };
          dynamicPromotions.push(newPromo);
          return json(newPromo, 201);
        }
      }

      // Waitlist endpoints
      if (pathname.endsWith('/waitlist/matches/check')) {
        return json(mockWaitlistMatches);
      }

      if (pathname.match(/\/waitlist\/[^/]+\/notify/)) {
        return json({ message: 'Notification sent' });
      }

      if (pathname.match(/\/waitlist\/[^/]+$/) && !pathname.includes('matches')) {
        const entryId = pathname.split('/').pop();
        if (method === 'DELETE') {
          dynamicWaitlist = dynamicWaitlist.filter(w => w._id !== entryId && w.id !== entryId);
          return route.fulfill({ status: 204 });
        }
        if (method === 'PUT') {
          const body = JSON.parse(route.request().postData() || '{}');
          const index = dynamicWaitlist.findIndex(w => w._id === entryId || w.id === entryId);
          if (index >= 0) {
            dynamicWaitlist[index] = { ...dynamicWaitlist[index], ...body };
            return json(dynamicWaitlist[index]);
          }
          return json({ detail: 'Entry not found' }, 404);
        }
      }

      if (pathname.endsWith('/waitlist')) {
        if (method === 'GET') return json(dynamicWaitlist);
        if (method === 'POST') {
          const body = JSON.parse(route.request().postData() || '{}');
          const newEntry = {
            _id: `wait-${Date.now()}`,
            id: `wait-${Date.now()}`,
            salon_id: 'salon-1',
            status: 'active',
            notification_count: 0,
            created_at: new Date().toISOString(),
            ...body,
          };
          dynamicWaitlist.push(newEntry);
          return json(newEntry, 201);
        }
      }

      // Website endpoints
      if (pathname.endsWith('/website/publish') && method === 'POST') {
        dynamicWebsite.is_published = true;
        return json({ message: 'Website published successfully' });
      }

      if (pathname.endsWith('/website/unpublish') && method === 'POST') {
        dynamicWebsite.is_published = false;
        return json({ message: 'Website unpublished' });
      }

      if (pathname.endsWith('/website')) {
        if (method === 'GET') return json(dynamicWebsite);
        if (method === 'PUT') {
          const body = JSON.parse(route.request().postData() || '{}');
          dynamicWebsite = { ...dynamicWebsite, ...body };
          if (body.settings) {
            dynamicWebsite.settings = { ...dynamicWebsite.settings, ...body.settings };
          }
          return json(dynamicWebsite);
        }
      }

      // Stripe endpoints
      if (pathname.endsWith('/stripe/connect/status')) {
        return json({
          connected: false,
          account_id: null,
          onboarding_complete: false,
        });
      }

      if (pathname.endsWith('/stripe/connect/onboard') && method === 'POST') {
        return json({ url: 'https://connect.stripe.com/setup/mock-account' });
      }

      if (pathname.endsWith('/stripe/connect/disconnect') && method === 'POST') {
        return json({ message: 'Disconnected' });
      }

      // Email OAuth endpoints
      if (pathname.endsWith('/email/status')) {
        return json({
          connected: false,
          provider: null,
          email: null,
          connected_at: null,
        });
      }

      if (pathname.endsWith('/email/connect/google') && method === 'POST') {
        return json({ url: 'https://accounts.google.com/o/oauth2/mock' });
      }

      if (pathname.endsWith('/email/connect/microsoft') && method === 'POST') {
        return json({ url: 'https://login.microsoftonline.com/mock' });
      }

      if (pathname.endsWith('/email/disconnect') && method === 'POST') {
        return json({ message: 'Email disconnected' });
      }

      if (pathname.endsWith('/email/send-test') && method === 'POST') {
        return json({ message: 'Test email sent' });
      }

      // Notifications endpoints
      if (pathname.endsWith('/notifications/sms-log')) {
        return json([]);
      }

      if (pathname.endsWith('/notifications/send-test') && method === 'POST') {
        return json({ message: 'Test SMS sent' });
      }

      // Default: pass through or return 404
      console.log(`Unhandled mock route: ${method} ${pathname}`);
      return json({ detail: 'Not found' }, 404);
    } catch (e) {
      console.error('Mock error:', e);
      return json({ detail: 'Internal error' }, 500);
    }
  });
}

export async function loginUser(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin@testsalon.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  // Wait for redirect to calendar
  await page.waitForURL('/', { timeout: 10000 });
}
