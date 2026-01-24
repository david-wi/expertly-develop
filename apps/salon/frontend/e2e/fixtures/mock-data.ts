// Mock data for E2E tests

export const mockUser = {
  id: 'user-1',
  email: 'admin@testsalon.com',
  first_name: 'Admin',
  last_name: 'User',
  role: 'owner',
  salon_id: 'salon-1',
};

export const mockSalon = {
  id: 'salon-1',
  name: 'Test Salon & Spa',
  email: 'info@testsalon.com',
  phone: '555-123-4567',
  address: '123 Main Street',
  city: 'New York',
  state: 'NY',
  zip: '10001',
  timezone: 'America/New_York',
  settings: {
    business_hours: {
      '0': { is_open: false },
      '1': { is_open: true, open: '09:00', close: '18:00' },
      '2': { is_open: true, open: '09:00', close: '18:00' },
      '3': { is_open: true, open: '09:00', close: '18:00' },
      '4': { is_open: true, open: '09:00', close: '18:00' },
      '5': { is_open: true, open: '09:00', close: '18:00' },
      '6': { is_open: true, open: '10:00', close: '16:00' },
    },
    booking: {
      min_notice_hours: 2,
      max_advance_days: 60,
      slot_duration_minutes: 15,
      require_deposit: false,
    },
  },
  notification_settings: {
    send_reminders: true,
    reminder_hours_before: [24, 2],
    request_reviews: true,
    review_delay_hours: 2,
    google_review_url: 'https://g.page/testsalon/review',
    yelp_review_url: 'https://yelp.com/biz/testsalon',
    facebook_review_url: null,
    send_birthday_messages: true,
    birthday_message_template: 'Happy Birthday {name}! Enjoy 15% off your next visit!',
  },
  stripe_account_id: null,
  stripe_onboarding_complete: false,
};

export const mockStaff = [
  {
    _id: 'staff-1',
    id: 'staff-1',
    salon_id: 'salon-1',
    first_name: 'Sarah',
    last_name: 'Johnson',
    display_name: 'Sarah J.',
    email: 'sarah@testsalon.com',
    phone: '555-111-2222',
    color: '#D4A5A5',
    is_active: true,
    working_hours: {
      schedule: {
        '1': { is_working: true, slots: [{ start: '09:00', end: '17:00' }] },
        '2': { is_working: true, slots: [{ start: '09:00', end: '17:00' }] },
        '3': { is_working: true, slots: [{ start: '09:00', end: '17:00' }] },
        '4': { is_working: true, slots: [{ start: '09:00', end: '17:00' }] },
        '5': { is_working: true, slots: [{ start: '09:00', end: '17:00' }] },
      },
    },
  },
  {
    _id: 'staff-2',
    id: 'staff-2',
    salon_id: 'salon-1',
    first_name: 'Mike',
    last_name: 'Chen',
    display_name: 'Mike C.',
    email: 'mike@testsalon.com',
    phone: '555-333-4444',
    color: '#C9A86C',
    is_active: true,
    working_hours: {
      schedule: {
        '1': { is_working: true, slots: [{ start: '10:00', end: '18:00' }] },
        '2': { is_working: true, slots: [{ start: '10:00', end: '18:00' }] },
        '3': { is_working: false, slots: [] },
        '4': { is_working: true, slots: [{ start: '10:00', end: '18:00' }] },
        '5': { is_working: true, slots: [{ start: '10:00', end: '18:00' }] },
        '6': { is_working: true, slots: [{ start: '10:00', end: '16:00' }] },
      },
    },
  },
];

export const mockServices = [
  {
    _id: 'service-1',
    id: 'service-1',
    salon_id: 'salon-1',
    name: 'Haircut',
    description: 'Classic haircut with styling',
    duration_minutes: 45,
    buffer_minutes: 15,
    price: 5500, // $55.00 in cents
    is_active: true,
    sort_order: 1,
  },
  {
    _id: 'service-2',
    id: 'service-2',
    salon_id: 'salon-1',
    name: 'Hair Coloring',
    description: 'Full color treatment',
    duration_minutes: 120,
    buffer_minutes: 15,
    price: 15000, // $150.00
    is_active: true,
    sort_order: 2,
  },
  {
    _id: 'service-3',
    id: 'service-3',
    salon_id: 'salon-1',
    name: 'Manicure',
    description: 'Classic manicure',
    duration_minutes: 30,
    buffer_minutes: 5,
    price: 3500, // $35.00
    is_active: true,
    sort_order: 3,
  },
];

export const mockClients = [
  {
    _id: 'client-1',
    id: 'client-1',
    salon_id: 'salon-1',
    first_name: 'Emily',
    last_name: 'Davis',
    email: 'emily.davis@email.com',
    phone: '555-987-6543',
    language: 'en',
    notes: 'Prefers afternoon appointments',
    tags: ['VIP', 'Regular'],
    stats: {
      total_visits: 12,
      cancelled_appointments: 1,
      no_shows: 0,
      total_spent: 66000,
    },
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    _id: 'client-2',
    id: 'client-2',
    salon_id: 'salon-1',
    first_name: 'James',
    last_name: 'Wilson',
    email: 'james.w@email.com',
    phone: '555-456-7890',
    language: 'en',
    notes: '',
    tags: ['New'],
    stats: {
      total_visits: 2,
      cancelled_appointments: 0,
      no_shows: 0,
      total_spent: 11000,
    },
    created_at: '2024-06-01T14:00:00Z',
  },
];

export const mockAppointments = [
  {
    _id: 'appt-1',
    id: 'appt-1',
    salon_id: 'salon-1',
    client_id: 'client-1',
    client: mockClients[0],
    staff_id: 'staff-1',
    staff: mockStaff[0],
    service_id: 'service-1',
    service: mockServices[0],
    start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    end_time: new Date(Date.now() + 86400000 + 2700000).toISOString(), // +45min
    status: 'confirmed',
    notes: 'Wants layers',
    price_snapshot: 5500,
  },
];

export const mockPromotions = [
  {
    _id: 'promo-1',
    id: 'promo-1',
    salon_id: 'salon-1',
    name: 'Birthday Special',
    description: '15% off during your birthday week',
    promotion_type: 'birthday',
    discount_type: 'percentage',
    discount_value: 15,
    is_active: true,
    requires_code: false,
    days_before_birthday: 3,
    days_after_birthday: 3,
    usage_count: 5,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    _id: 'promo-2',
    id: 'promo-2',
    salon_id: 'salon-1',
    name: 'New Client Welcome',
    description: '$10 off first visit',
    promotion_type: 'new_client',
    discount_type: 'fixed',
    discount_value: 1000,
    is_active: true,
    requires_code: false,
    usage_count: 23,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    _id: 'promo-3',
    id: 'promo-3',
    salon_id: 'salon-1',
    name: 'Summer Sale',
    description: '20% off all services',
    promotion_type: 'seasonal',
    discount_type: 'percentage',
    discount_value: 20,
    code: 'SUMMER20',
    requires_code: true,
    is_active: false,
    start_date: '2024-06-01T00:00:00Z',
    end_date: '2024-08-31T23:59:59Z',
    usage_count: 45,
    max_uses: 100,
    created_at: '2024-05-15T00:00:00Z',
  },
];

export const mockWaitlist = [
  {
    _id: 'wait-1',
    id: 'wait-1',
    salon_id: 'salon-1',
    client_id: 'client-1',
    client: mockClients[0],
    service_id: 'service-2',
    service: mockServices[1],
    preferred_staff_id: 'staff-1',
    preferred_staff: mockStaff[0],
    availability_description: 'weekday mornings before 11am',
    availability_parsed: {
      days_of_week: [1, 2, 3, 4, 5],
      time_ranges: [{ start: '09:00', end: '11:00' }],
    },
    status: 'active',
    notification_count: 0,
    expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    _id: 'wait-2',
    id: 'wait-2',
    salon_id: 'salon-1',
    client_id: 'client-2',
    client: mockClients[1],
    service_id: 'service-1',
    service: mockServices[0],
    availability_description: 'any saturday',
    availability_parsed: {
      days_of_week: [6],
      time_ranges: [],
    },
    status: 'notified',
    notification_count: 1,
    last_notified_at: new Date(Date.now() - 86400000).toISOString(),
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

export const mockWebsite = {
  salon_id: 'salon-1',
  is_published: false,
  subdomain: null,
  settings: {
    tagline: 'Where Beauty Meets Excellence',
    about_text: 'Welcome to Test Salon & Spa, your destination for premium beauty services.',
    logo_url: null,
    primary_color: '#D4A5A5',
    secondary_color: '#C9A86C',
    font_heading: 'Playfair Display',
    font_body: 'Inter',
    theme: 'warm',
    hero_title: 'Welcome to Test Salon',
    hero_subtitle: 'Experience luxury beauty services',
    hero_image_url: null,
    show_booking_cta: true,
    gallery_images: [],
    testimonials: [],
    show_map: true,
    show_hours: true,
    contact_form_enabled: true,
    social_links: {
      instagram: 'https://instagram.com/testsalon',
      facebook: 'https://facebook.com/testsalon',
      yelp: null,
    },
    sections: [],
    allow_public_booking: true,
    require_account: false,
    show_prices: true,
    show_staff_bios: true,
    new_client_discount_enabled: true,
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z',
};

export const mockCalendar = {
  start_date: new Date().toISOString().split('T')[0],
  end_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  staff: mockStaff,
  appointments: mockAppointments,
};

export const mockAvailability = {
  date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  service_id: 'service-1',
  slots: [
    { start_time: '09:00', end_time: '09:45', staff_id: 'staff-1', staff_name: 'Sarah Johnson' },
    { start_time: '09:15', end_time: '10:00', staff_id: 'staff-1', staff_name: 'Sarah Johnson' },
    { start_time: '09:30', end_time: '10:15', staff_id: 'staff-1', staff_name: 'Sarah Johnson' },
    { start_time: '10:00', end_time: '10:45', staff_id: 'staff-1', staff_name: 'Sarah Johnson' },
    { start_time: '10:00', end_time: '10:45', staff_id: 'staff-2', staff_name: 'Mike Chen' },
    { start_time: '10:15', end_time: '11:00', staff_id: 'staff-2', staff_name: 'Mike Chen' },
    { start_time: '11:00', end_time: '11:45', staff_id: 'staff-1', staff_name: 'Sarah Johnson' },
    { start_time: '14:00', end_time: '14:45', staff_id: 'staff-1', staff_name: 'Sarah Johnson' },
    { start_time: '14:00', end_time: '14:45', staff_id: 'staff-2', staff_name: 'Mike Chen' },
    { start_time: '15:00', end_time: '15:45', staff_id: 'staff-1', staff_name: 'Sarah Johnson' },
  ],
};

export const mockWaitlistMatches = [
  {
    waitlist_entry: mockWaitlist[0],
    available_slots: [
      {
        start_time: '2024-07-15T09:00:00Z',
        end_time: '2024-07-15T11:00:00Z',
        staff_id: 'staff-1',
        staff_name: 'Sarah Johnson',
      },
    ],
  },
];

export const mockScheduleOverrides = [
  {
    _id: 'override-1',
    id: 'override-1',
    staff_id: 'staff-1',
    date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    override_type: 'day_off',
    reason: 'Personal day',
    created_at: '2024-06-01T00:00:00Z',
  },
];
