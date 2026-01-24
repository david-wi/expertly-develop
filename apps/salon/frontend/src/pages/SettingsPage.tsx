import { useState, useEffect } from 'react';
import { Button, Input, Card, CardHeader } from '../components/ui';
import { salon as salonApi, email as emailApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { Salon } from '../types';

export function SettingsPage() {
  const { salon, loadSalon } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'general' | 'booking' | 'payments' | 'notifications'>('general');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-warm-800 mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-warm-200">
        {[
          { id: 'general', label: 'General' },
          { id: 'booking', label: 'Booking' },
          { id: 'payments', label: 'Payments' },
          { id: 'notifications', label: 'Notifications' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-primary-600 border-primary-500'
                : 'text-warm-500 border-transparent hover:text-warm-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'general' && salon && <GeneralSettings salon={salon} onUpdate={loadSalon} />}
      {activeTab === 'booking' && salon && <BookingSettings salon={salon} onUpdate={loadSalon} />}
      {activeTab === 'payments' && <PaymentSettings />}
      {activeTab === 'notifications' && salon && <NotificationSettings salon={salon} onUpdate={loadSalon} />}
    </div>
  );
}

interface SettingsSectionProps {
  salon: Salon;
  onUpdate: () => void;
}

function GeneralSettings({ salon, onUpdate }: SettingsSectionProps) {
  const [formData, setFormData] = useState({
    name: salon.name,
    email: salon.email || '',
    phone: salon.phone || '',
    address: salon.address || '',
    city: salon.city || '',
    state: salon.state || '',
    zip_code: salon.zip_code || '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await salonApi.update(formData);
      onUpdate();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card padding="lg">
      <CardHeader title="Business Information" />
      <div className="space-y-4 max-w-xl">
        <Input
          label="Business Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="Phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
        <Input
          label="Address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="City"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          />
          <Input
            label="State"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
          />
          <Input
            label="ZIP Code"
            value={formData.zip_code}
            onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
          />
        </div>
        <div className="pt-4">
          <Button onClick={handleSave} isLoading={isSaving}>
            Save Changes
          </Button>
        </div>
      </div>
    </Card>
  );
}

function BookingSettings({ salon }: SettingsSectionProps) {
  const settings = salon.settings;

  return (
    <div className="space-y-6">
      <Card padding="lg">
        <CardHeader
          title="Booking Rules"
          subtitle="Configure how appointments can be booked"
        />
        <div className="space-y-4 max-w-xl">
          <Input
            label="Minimum Notice (hours)"
            type="number"
            value={settings.min_booking_notice_hours}
            hint="How far in advance appointments must be booked"
            disabled
          />
          <Input
            label="Maximum Advance Booking (days)"
            type="number"
            value={settings.max_booking_advance_days}
            hint="How far ahead clients can book"
            disabled
          />
          <Input
            label="Slot Duration (minutes)"
            type="number"
            value={settings.slot_duration_minutes}
            hint="Base time slot size for calendar"
            disabled
          />
        </div>
      </Card>

      <Card padding="lg">
        <CardHeader
          title="Cancellation Policy"
          subtitle="Set rules for cancellations and no-shows"
        />
        <div className="space-y-4 max-w-xl">
          <Input
            label="Free Cancellation Window (hours)"
            type="number"
            value={settings.cancellation_policy.free_cancellation_hours}
            hint="Hours before appointment when free cancellation ends"
            disabled
          />
          <Input
            label="Late Cancellation Fee (%)"
            type="number"
            value={settings.cancellation_policy.late_cancellation_fee_percent}
            hint="Percentage of deposit charged for late cancellation"
            disabled
          />
          <Input
            label="No-Show Fee (%)"
            type="number"
            value={settings.cancellation_policy.no_show_fee_percent}
            hint="Percentage of deposit charged for no-shows"
            disabled
          />
        </div>
      </Card>
    </div>
  );
}

function PaymentSettings() {
  const { salon, loadSalon } = useAuthStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    requirements: string[];
  } | null>(null);

  // Check for Stripe redirect callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('stripe') === 'connected') {
      loadSalon();
      checkStripeStatus();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loadSalon]);

  const checkStripeStatus = async () => {
    try {
      const { stripe } = await import('../services/api');
      const status = await stripe.getConnectStatus();
      setStripeStatus(status);
    } catch (error) {
      console.error('Failed to check Stripe status:', error);
    }
  };

  useEffect(() => {
    if (salon?.stripe_account_id) {
      checkStripeStatus();
    }
  }, [salon?.stripe_account_id]);

  const handleConnectStripe = async () => {
    setIsConnecting(true);
    try {
      const { stripe } = await import('../services/api');
      const result = await stripe.createOnboardingLink();
      window.location.href = result.url;
    } catch (error) {
      console.error('Failed to create Stripe onboarding link:', error);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Stripe account? You will no longer be able to accept payments.')) {
      return;
    }
    setIsDisconnecting(true);
    try {
      const { stripe } = await import('../services/api');
      await stripe.disconnect();
      loadSalon();
      setStripeStatus(null);
    } catch (error) {
      console.error('Failed to disconnect Stripe:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <Card padding="lg">
      <CardHeader
        title="Stripe Connect"
        subtitle="Connect your Stripe account to accept payments"
      />
      <div className="max-w-xl">
        {salon?.stripe_onboarding_complete && stripeStatus?.charges_enabled ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-success-100 text-success-700">
              <p className="font-medium flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Stripe Connected
              </p>
              <p className="text-sm mt-1">
                Your Stripe account is connected and ready to accept payments.
              </p>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <span className={`flex items-center gap-1 ${stripeStatus.charges_enabled ? 'text-success-600' : 'text-warm-500'}`}>
                {stripeStatus.charges_enabled ? '✓' : '○'} Card payments enabled
              </span>
              <span className={`flex items-center gap-1 ${stripeStatus.payouts_enabled ? 'text-success-600' : 'text-warm-500'}`}>
                {stripeStatus.payouts_enabled ? '✓' : '○'} Payouts enabled
              </span>
            </div>

            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="text-sm text-red-600 hover:text-red-800"
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect Stripe Account'}
            </button>
          </div>
        ) : salon?.stripe_account_id && !stripeStatus?.charges_enabled ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-amber-100 text-amber-800">
              <p className="font-medium">Onboarding Incomplete</p>
              <p className="text-sm mt-1">
                Your Stripe account setup is not complete. Please finish the onboarding process.
              </p>
              {stripeStatus?.requirements && stripeStatus.requirements.length > 0 && (
                <p className="text-xs mt-2">
                  Required: {stripeStatus.requirements.join(', ')}
                </p>
              )}
            </div>
            <Button onClick={handleConnectStripe} isLoading={isConnecting} variant="accent">
              Complete Stripe Setup
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-warm-600">
              Connect your Stripe account to enable payment processing for
              deposits and payments. You'll earn money directly to your account.
            </p>
            <Button onClick={handleConnectStripe} isLoading={isConnecting} variant="accent">
              {isConnecting ? 'Connecting...' : 'Connect Stripe Account'}
            </Button>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-warm-200">
          <h4 className="font-medium text-warm-800 mb-2">Deposit Settings</h4>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={salon?.settings.require_deposit}
                disabled
                className="w-4 h-4 rounded border-warm-300"
              />
              <label className="text-warm-700">
                Require deposit for bookings
              </label>
            </div>
            <Input
              label="Default Deposit (%)"
              type="number"
              value={salon?.settings.deposit_percent || 50}
              disabled
              hint="Percentage of service price required as deposit"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function EmailConnection() {
  const [emailStatus, setEmailStatus] = useState<{
    connected: boolean;
    provider?: 'google' | 'microsoft';
    email?: string;
    connected_at?: string;
  } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Check for redirect callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('email_connected') === 'true') {
      loadEmailStatus();
      window.history.replaceState({}, '', window.location.pathname + '?tab=notifications');
    }
    if (urlParams.get('email_error')) {
      setTestResult({ success: false, message: urlParams.get('email_error') || 'Connection failed' });
      window.history.replaceState({}, '', window.location.pathname + '?tab=notifications');
    }
  }, []);

  const loadEmailStatus = async () => {
    try {
      const status = await emailApi.getStatus();
      setEmailStatus(status);
    } catch (error) {
      console.error('Failed to load email status:', error);
    }
  };

  useEffect(() => {
    loadEmailStatus();
  }, []);

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      const result = await emailApi.connectGoogle();
      window.location.href = result.url;
    } catch (error) {
      console.error('Failed to start Google OAuth:', error);
      setIsConnecting(false);
    }
  };

  const handleConnectMicrosoft = async () => {
    setIsConnecting(true);
    try {
      const result = await emailApi.connectMicrosoft();
      window.location.href = result.url;
    } catch (error) {
      console.error('Failed to start Microsoft OAuth:', error);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your email account? Automated emails will no longer be sent.')) {
      return;
    }
    setIsDisconnecting(true);
    try {
      await emailApi.disconnect();
      setEmailStatus({ connected: false });
    } catch (error) {
      console.error('Failed to disconnect email:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) return;
    setIsSendingTest(true);
    setTestResult(null);
    try {
      await emailApi.sendTest(testEmail);
      setTestResult({ success: true, message: `Test email sent to ${testEmail}` });
      setTestEmail('');
    } catch (error: any) {
      setTestResult({ success: false, message: error.response?.data?.detail || 'Failed to send test email' });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <Card padding="lg">
      <CardHeader
        title="Email Integration"
        subtitle="Connect your email account to send automated emails to clients"
      />
      <div className="max-w-xl">
        {emailStatus?.connected ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-success-100 text-success-700">
              <p className="font-medium flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {emailStatus.provider === 'google' ? 'Gmail' : 'Outlook'} Connected
              </p>
              <p className="text-sm mt-1">
                Sending emails as: {emailStatus.email}
              </p>
            </div>

            {/* Test Email */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-warm-700">Send Test Email</label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  className="flex-1"
                />
                <Button
                  onClick={handleSendTest}
                  isLoading={isSendingTest}
                  disabled={!testEmail}
                  variant="secondary"
                >
                  Send Test
                </Button>
              </div>
              {testResult && (
                <p className={`text-sm ${testResult.success ? 'text-success-600' : 'text-error-600'}`}>
                  {testResult.message}
                </p>
              )}
            </div>

            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="text-sm text-red-600 hover:text-red-800"
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect Email Account'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-warm-600">
              Connect your Gmail or Outlook account to send automated appointment confirmations,
              reminders, review requests, and birthday messages to your clients.
            </p>

            {testResult && !testResult.success && (
              <div className="p-3 rounded-lg bg-error-100 text-error-700 text-sm">
                {testResult.message}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleConnectGoogle}
                isLoading={isConnecting}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Connect Gmail
              </Button>
              <Button
                onClick={handleConnectMicrosoft}
                isLoading={isConnecting}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 21 21">
                  <rect fill="#f25022" x="1" y="1" width="9" height="9"/>
                  <rect fill="#00a4ef" x="1" y="11" width="9" height="9"/>
                  <rect fill="#7fba00" x="11" y="1" width="9" height="9"/>
                  <rect fill="#ffb900" x="11" y="11" width="9" height="9"/>
                </svg>
                Connect Outlook
              </Button>
            </div>

            <p className="text-xs text-warm-500">
              We only request permission to send emails on your behalf. Your email content and contacts remain private.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function NotificationSettings({ salon, onUpdate }: SettingsSectionProps) {
  const [isSaving, setIsSaving] = useState(false);
  const notifications = (salon.settings as any).notifications || {};

  const [formData, setFormData] = useState({
    send_reminders: notifications.send_reminders ?? true,
    reminder_hours_before: notifications.reminder_hours_before || [24, 2],
    request_reviews: notifications.request_reviews ?? true,
    review_delay_hours: notifications.review_delay_hours || 2,
    google_review_url: notifications.google_review_url || '',
    yelp_review_url: notifications.yelp_review_url || '',
    facebook_review_url: notifications.facebook_review_url || '',
    send_birthday_messages: notifications.send_birthday_messages ?? true,
    birthday_message_template: notifications.birthday_message_template || '',
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await salonApi.update({
        settings: {
          ...salon.settings,
          notifications: formData,
        },
      } as any);
      onUpdate();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Email Connection */}
      <EmailConnection />

      {/* Appointment Reminders */}
      <Card padding="lg">
        <CardHeader
          title="Appointment Reminders"
          subtitle="Automatically remind clients about upcoming appointments"
        />
        <div className="space-y-4 max-w-xl">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={formData.send_reminders}
              onChange={(e) => setFormData({ ...formData, send_reminders: e.target.checked })}
              className="w-4 h-4 rounded border-warm-300 text-primary-500 focus:ring-primary-500"
            />
            <label className="text-warm-700">
              Send appointment reminders via SMS
            </label>
          </div>
          <p className="text-sm text-warm-500">
            Reminders are sent 24 hours and 2 hours before the appointment.
          </p>
        </div>
      </Card>

      {/* Review Requests */}
      <Card padding="lg">
        <CardHeader
          title="Review Requests"
          subtitle="Ask clients to leave reviews after their appointment"
        />
        <div className="space-y-4 max-w-xl">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={formData.request_reviews}
              onChange={(e) => setFormData({ ...formData, request_reviews: e.target.checked })}
              className="w-4 h-4 rounded border-warm-300 text-primary-500 focus:ring-primary-500"
            />
            <label className="text-warm-700">
              Send review requests after completed appointments
            </label>
          </div>

          <Input
            label="Google Business Review URL"
            value={formData.google_review_url}
            onChange={(e) => setFormData({ ...formData, google_review_url: e.target.value })}
            placeholder="https://g.page/your-business/review"
            hint="Get this from your Google Business Profile"
          />

          <Input
            label="Yelp Review URL"
            value={formData.yelp_review_url}
            onChange={(e) => setFormData({ ...formData, yelp_review_url: e.target.value })}
            placeholder="https://www.yelp.com/writeareview/biz/your-business"
            hint="Get this from your Yelp business page"
          />

          <Input
            label="Facebook Review URL"
            value={formData.facebook_review_url}
            onChange={(e) => setFormData({ ...formData, facebook_review_url: e.target.value })}
            placeholder="https://www.facebook.com/your-page/reviews"
            hint="Optional: Link to your Facebook page reviews"
          />

          <Input
            label="Hours After Appointment"
            type="number"
            value={formData.review_delay_hours}
            onChange={(e) => setFormData({ ...formData, review_delay_hours: parseInt(e.target.value) || 2 })}
            hint="How long after the appointment to send the review request"
          />
        </div>
      </Card>

      {/* Birthday Messages */}
      <Card padding="lg">
        <CardHeader
          title="Birthday Messages"
          subtitle="Send birthday greetings to clients"
        />
        <div className="space-y-4 max-w-xl">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={formData.send_birthday_messages}
              onChange={(e) => setFormData({ ...formData, send_birthday_messages: e.target.checked })}
              className="w-4 h-4 rounded border-warm-300 text-primary-500 focus:ring-primary-500"
            />
            <label className="text-warm-700">
              Send birthday messages to clients
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">
              Custom Birthday Message (optional)
            </label>
            <textarea
              value={formData.birthday_message_template}
              onChange={(e) => setFormData({ ...formData, birthday_message_template: e.target.value })}
              placeholder="Happy Birthday {client_name}! Enjoy {discount} on your next visit at {salon_name}!"
              rows={3}
              className="w-full px-3 py-2 border border-warm-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-warm-500">
              Available variables: {'{client_name}'}, {'{salon_name}'}, {'{discount}'}
            </p>
          </div>
        </div>
      </Card>

      <div className="pt-4">
        <Button onClick={handleSave} isLoading={isSaving}>
          Save Notification Settings
        </Button>
      </div>
    </div>
  );
}
