import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';
import type {
  AuthResponse,
  LoginRequest,
  User,
  Salon,
  Staff,
  StaffCreate,
  Service,
  ServiceCreate,
  ServiceCategory,
  Client,
  ClientCreate,
  Appointment,
  AppointmentCreate,
  CalendarResponse,
  AvailabilityResponse,
  SlotLock,
  WaitlistEntry,
  WaitlistCreate,
  AvailabilityMatch,
  Promotion,
  PromotionCreate,
  PromotionCheckResult,
  ScheduleOverride,
  WaitlistStatus,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (token) {
    localStorage.setItem('access_token', token);
  } else {
    localStorage.removeItem('access_token');
  }
};

export const getAccessToken = () => {
  if (!accessToken) {
    accessToken = localStorage.getItem('access_token');
  }
  return accessToken;
};

// Request interceptor
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Try to refresh token
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post<AuthResponse>(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          setAccessToken(response.data.access_token);
          localStorage.setItem('refresh_token', response.data.refresh_token);

          // Retry original request
          const originalRequest = error.config as AxiosRequestConfig;
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`;
          }
          return api(originalRequest);
        } catch {
          // Refresh failed, clear tokens
          setAccessToken(null);
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const auth = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    setAccessToken(response.data.access_token);
    localStorage.setItem('refresh_token', response.data.refresh_token);
    return response.data;
  },

  logout: () => {
    setAccessToken(null);
    localStorage.removeItem('refresh_token');
  },

  me: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },
};

// Users (Staff Login Management)
export const users = {
  list: async (includeInactive = false): Promise<User[]> => {
    const response = await api.get<User[]>('/auth/users', {
      params: { include_inactive: includeInactive },
    });
    return response.data;
  },

  get: async (id: string): Promise<User> => {
    const response = await api.get<User>(`/auth/users/${id}`);
    return response.data;
  },

  create: async (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role?: string;
    staff_id?: string;
  }): Promise<User> => {
    const response = await api.post<User>('/auth/users', data);
    return response.data;
  },

  update: async (id: string, data: {
    email?: string;
    first_name?: string;
    last_name?: string;
    role?: string;
    is_active?: boolean;
  }): Promise<User> => {
    const response = await api.put<User>(`/auth/users/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/auth/users/${id}`);
  },
};

// Salon
export const salon = {
  getCurrent: async (): Promise<Salon> => {
    const response = await api.get<Salon>('/salons/current');
    return response.data;
  },

  update: async (data: Partial<Salon>): Promise<Salon> => {
    const response = await api.put<Salon>('/salons/current', data);
    return response.data;
  },
};

// Staff
export const staff = {
  list: async (includeInactive = false): Promise<Staff[]> => {
    const response = await api.get<Staff[]>('/staff', {
      params: { include_inactive: includeInactive },
    });
    return response.data;
  },

  get: async (id: string): Promise<Staff> => {
    const response = await api.get<Staff>(`/staff/${id}`);
    return response.data;
  },

  create: async (data: StaffCreate): Promise<Staff> => {
    const response = await api.post<Staff>('/staff', data);
    return response.data;
  },

  update: async (id: string, data: Partial<StaffCreate>): Promise<Staff> => {
    const response = await api.put<Staff>(`/staff/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/staff/${id}`);
  },
};

// Services
export const services = {
  list: async (categoryId?: string, includeInactive = false): Promise<Service[]> => {
    const response = await api.get<Service[]>('/services', {
      params: { category_id: categoryId, include_inactive: includeInactive },
    });
    return response.data;
  },

  get: async (id: string): Promise<Service> => {
    const response = await api.get<Service>(`/services/${id}`);
    return response.data;
  },

  create: async (data: ServiceCreate): Promise<Service> => {
    const response = await api.post<Service>('/services', data);
    return response.data;
  },

  update: async (id: string, data: Partial<ServiceCreate>): Promise<Service> => {
    const response = await api.put<Service>(`/services/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/services/${id}`);
  },

  categories: {
    list: async (includeInactive = false): Promise<ServiceCategory[]> => {
      const response = await api.get<ServiceCategory[]>('/services/categories', {
        params: { include_inactive: includeInactive },
      });
      return response.data;
    },

    create: async (data: { name: string; description?: string }): Promise<ServiceCategory> => {
      const response = await api.post<ServiceCategory>('/services/categories', data);
      return response.data;
    },
  },
};

// Clients
export const clients = {
  list: async (limit = 50, offset = 0): Promise<Client[]> => {
    const response = await api.get<Client[]>('/clients', {
      params: { limit, offset },
    });
    return response.data;
  },

  search: async (query: string, limit = 20): Promise<Client[]> => {
    const response = await api.get<Client[]>('/clients/search', {
      params: { q: query, limit },
    });
    return response.data;
  },

  get: async (id: string): Promise<Client> => {
    const response = await api.get<Client>(`/clients/${id}`);
    return response.data;
  },

  create: async (data: ClientCreate): Promise<Client> => {
    const response = await api.post<Client>('/clients', data);
    return response.data;
  },

  update: async (id: string, data: Partial<ClientCreate>): Promise<Client> => {
    const response = await api.put<Client>(`/clients/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/clients/${id}`);
  },
};

// Appointments
export const appointments = {
  get: async (id: string): Promise<Appointment> => {
    const response = await api.get<Appointment>(`/appointments/${id}`);
    return response.data;
  },

  create: async (data: AppointmentCreate): Promise<Appointment> => {
    const response = await api.post<Appointment>('/appointments', data);
    return response.data;
  },

  update: async (id: string, data: { notes?: string; internal_notes?: string }): Promise<Appointment> => {
    const response = await api.put<Appointment>(`/appointments/${id}`, data);
    return response.data;
  },

  checkIn: async (id: string): Promise<Appointment> => {
    const response = await api.post<Appointment>(`/appointments/${id}/check-in`);
    return response.data;
  },

  start: async (id: string): Promise<Appointment> => {
    const response = await api.post<Appointment>(`/appointments/${id}/start`);
    return response.data;
  },

  complete: async (id: string): Promise<Appointment> => {
    const response = await api.post<Appointment>(`/appointments/${id}/complete`);
    return response.data;
  },

  cancel: async (id: string, reason?: string): Promise<Appointment> => {
    const response = await api.post<Appointment>(`/appointments/${id}/cancel`, {
      status: 'cancelled',
      reason,
    });
    return response.data;
  },

  noShow: async (id: string): Promise<Appointment> => {
    const response = await api.post<Appointment>(`/appointments/${id}/no-show`);
    return response.data;
  },

  reschedule: async (
    id: string,
    newStartTime: string,
    newStaffId?: string
  ): Promise<Appointment> => {
    const response = await api.post<Appointment>(
      `/appointments/${id}/reschedule`,
      null,
      {
        params: {
          new_start_time: newStartTime,
          new_staff_id: newStaffId,
        },
      }
    );
    return response.data;
  },

  lock: async (staffId: string, startTime: string, endTime: string): Promise<SlotLock> => {
    const response = await api.post<SlotLock>('/appointments/lock', {
      staff_id: staffId,
      start_time: startTime,
      end_time: endTime,
    });
    return response.data;
  },

  releaseLock: async (lockId: string): Promise<void> => {
    await api.delete(`/appointments/lock/${lockId}`);
  },
};

// Calendar
export const calendar = {
  get: async (startDate: string, endDate: string, staffIds?: string[]): Promise<CalendarResponse> => {
    const response = await api.get<CalendarResponse>('/calendar', {
      params: {
        start_date: startDate,
        end_date: endDate,
        staff_ids: staffIds?.join(','),
      },
    });
    return response.data;
  },

  availability: async (date: string, serviceId: string, staffId?: string): Promise<AvailabilityResponse> => {
    const response = await api.get<AvailabilityResponse>('/calendar/availability', {
      params: {
        date,
        service_id: serviceId,
        staff_id: staffId,
      },
    });
    return response.data;
  },
};

// Waitlist
export const waitlist = {
  list: async (status?: WaitlistStatus, serviceId?: string): Promise<WaitlistEntry[]> => {
    const response = await api.get<WaitlistEntry[]>('/waitlist', {
      params: { status_filter: status, service_id: serviceId },
    });
    return response.data;
  },

  get: async (id: string): Promise<WaitlistEntry> => {
    const response = await api.get<WaitlistEntry>(`/waitlist/${id}`);
    return response.data;
  },

  create: async (data: WaitlistCreate): Promise<WaitlistEntry> => {
    const response = await api.post<WaitlistEntry>('/waitlist', data);
    return response.data;
  },

  update: async (id: string, data: Partial<WaitlistCreate & { status?: WaitlistStatus }>): Promise<WaitlistEntry> => {
    const response = await api.put<WaitlistEntry>(`/waitlist/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/waitlist/${id}`);
  },

  checkMatches: async (): Promise<AvailabilityMatch[]> => {
    const response = await api.get<AvailabilityMatch[]>('/waitlist/matches/check');
    return response.data;
  },

  notify: async (entryId: string, slotStartTime: string, staffId: string): Promise<void> => {
    await api.post(`/waitlist/${entryId}/notify`, null, {
      params: { slot_start_time: slotStartTime, staff_id: staffId },
    });
  },
};

// Promotions
export const promotions = {
  list: async (isActive?: boolean, type?: string): Promise<Promotion[]> => {
    const response = await api.get<Promotion[]>('/promotions', {
      params: { is_active: isActive, promotion_type: type },
    });
    return response.data;
  },

  get: async (id: string): Promise<Promotion> => {
    const response = await api.get<Promotion>(`/promotions/${id}`);
    return response.data;
  },

  create: async (data: PromotionCreate): Promise<Promotion> => {
    const response = await api.post<Promotion>('/promotions', data);
    return response.data;
  },

  update: async (id: string, data: Partial<PromotionCreate>): Promise<Promotion> => {
    const response = await api.put<Promotion>(`/promotions/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/promotions/${id}`);
  },

  checkApplicable: async (clientId: string, serviceId?: string, staffId?: string): Promise<PromotionCheckResult[]> => {
    const response = await api.get<PromotionCheckResult[]>(`/promotions/check/${clientId}`, {
      params: { service_id: serviceId, staff_id: staffId },
    });
    return response.data;
  },

  validateCode: async (code: string, clientId?: string): Promise<Promotion> => {
    const response = await api.post<Promotion>('/promotions/validate-code', null, {
      params: { code, client_id: clientId },
    });
    return response.data;
  },
};

// Staff Schedule Overrides
export const scheduleOverrides = {
  list: async (staffId: string, startDate?: string, endDate?: string): Promise<ScheduleOverride[]> => {
    const response = await api.get<ScheduleOverride[]>(`/staff/${staffId}/schedule/overrides`, {
      params: { start_date: startDate, end_date: endDate },
    });
    return response.data;
  },

  create: async (staffId: string, data: {
    date: string;
    override_type: 'day_off' | 'custom_hours' | 'vacation';
    reason?: string;
    custom_hours?: { start: string; end: string }[];
  }): Promise<ScheduleOverride> => {
    const response = await api.post<ScheduleOverride>(`/staff/${staffId}/schedule/override`, data);
    return response.data;
  },

  delete: async (staffId: string, overrideId: string): Promise<void> => {
    await api.delete(`/staff/${staffId}/schedule/override/${overrideId}`);
  },
};

// Notifications
export const notifications = {
  getSmsLog: async (clientId?: string, direction?: string, limit = 50): Promise<any[]> => {
    const response = await api.get('/notifications/sms-log', {
      params: { client_id: clientId, direction, limit },
    });
    return response.data;
  },

  sendTestSms: async (phone: string, message: string): Promise<void> => {
    await api.post('/notifications/send-test', null, {
      params: { phone, message },
    });
  },

  processPending: async (): Promise<void> => {
    await api.post('/notifications/process-pending');
  },

  getScheduled: async (status?: string, limit = 50): Promise<any[]> => {
    const response = await api.get('/notifications/scheduled', {
      params: { status_filter: status, limit },
    });
    return response.data;
  },
};

// Email OAuth
export const email = {
  getStatus: async (): Promise<{
    connected: boolean;
    provider?: 'google' | 'microsoft';
    email?: string;
    connected_at?: string;
  }> => {
    const response = await api.get('/email/status');
    return response.data;
  },

  connectGoogle: async (): Promise<{ url: string }> => {
    const response = await api.post('/email/connect/google');
    return response.data;
  },

  connectMicrosoft: async (): Promise<{ url: string }> => {
    const response = await api.post('/email/connect/microsoft');
    return response.data;
  },

  disconnect: async (): Promise<void> => {
    await api.post('/email/disconnect');
  },

  sendTest: async (to: string, template?: string): Promise<{ message: string }> => {
    const response = await api.post('/email/send-test', { to, template });
    return response.data;
  },
};

// Stripe
export const stripe = {
  getConnectStatus: async (): Promise<{
    connected: boolean;
    onboarding_complete: boolean;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    requirements: string[];
  }> => {
    const response = await api.get('/stripe/connect/status');
    return response.data;
  },

  createOnboardingLink: async (): Promise<{ url: string; stripe_account_id?: string }> => {
    const response = await api.post('/stripe/connect/onboard');
    return response.data;
  },

  disconnect: async (): Promise<void> => {
    await api.post('/stripe/connect/disconnect');
  },

  createPaymentIntent: async (data: {
    amount: number;
    client_id: string;
    appointment_id?: string;
    description?: string;
  }): Promise<{ client_secret: string; payment_intent_id: string }> => {
    const response = await api.post('/stripe/payment-intent', data);
    return response.data;
  },

  createSetupIntent: async (clientId: string): Promise<{ client_secret: string; setup_intent_id: string }> => {
    const response = await api.post('/stripe/setup-intent', { client_id: clientId });
    return response.data;
  },

  getPaymentMethods: async (clientId: string): Promise<{
    id: string;
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  }[]> => {
    const response = await api.get(`/stripe/payment-methods/${clientId}`);
    return response.data;
  },

  capturePayment: async (paymentIntentId: string, amount?: number): Promise<any> => {
    const response = await api.post(`/stripe/capture/${paymentIntentId}`, null, {
      params: { amount },
    });
    return response.data;
  },

  refund: async (paymentIntentId: string, amount?: number, reason?: string): Promise<any> => {
    const response = await api.post('/stripe/refund', {
      payment_intent_id: paymentIntentId,
      amount,
      reason,
    });
    return response.data;
  },
};

export default api;
