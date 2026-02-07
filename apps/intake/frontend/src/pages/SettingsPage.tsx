import { useState } from 'react';
import { Settings, User, Bell } from 'lucide-react';
import { IDENTITY_URL } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';

// ── Page ──

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications'>('profile');

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { id: 'profile' as const, label: 'Profile', icon: User },
          { id: 'notifications' as const, label: 'Notifications', icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 -mb-px text-sm ${
                activeTab === tab.id
                  ? 'text-indigo-600 border-indigo-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'profile' && <ProfileSettings />}
      {activeTab === 'notifications' && <NotificationSettings />}
    </div>
  );
}

// ── Profile Settings ──

function ProfileSettings() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">User Profile</h2>
      <div className="space-y-4 max-w-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={user?.name ?? ''}
            disabled
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={user?.email ?? ''}
            disabled
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <input
            type="text"
            value={user?.role ?? ''}
            disabled
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
          />
        </div>
        <p className="text-sm text-gray-500">
          Profile and password management is handled by the{' '}
          <a
            href={IDENTITY_URL}
            className="text-indigo-600 hover:text-indigo-700 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Expertly Identity
          </a>{' '}
          service.
        </p>
      </div>
    </div>
  );
}

// ── Notification Settings ──

function NotificationSettings() {
  const [prefs, setPrefs] = useState({
    emailNotifications: true,
    smsNotifications: false,
    proposalAlerts: true,
    sessionComplete: true,
    followUpReminders: true,
    usageAlerts: false,
  });

  const togglePref = (key: keyof typeof prefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h2>
      <p className="text-sm text-gray-500 mb-6">
        Configure how you receive notifications. These settings are placeholders and will be
        connected to the notification system.
      </p>
      <div className="space-y-4 max-w-lg">
        <NotificationToggle
          label="Email Notifications"
          description="Receive notifications via email"
          checked={prefs.emailNotifications}
          onChange={() => togglePref('emailNotifications')}
        />
        <NotificationToggle
          label="SMS Notifications"
          description="Receive notifications via SMS"
          checked={prefs.smsNotifications}
          onChange={() => togglePref('smsNotifications')}
        />
        <hr className="border-gray-200" />
        <NotificationToggle
          label="Proposal Alerts"
          description="Get notified when new proposals are ready for review"
          checked={prefs.proposalAlerts}
          onChange={() => togglePref('proposalAlerts')}
        />
        <NotificationToggle
          label="Session Complete"
          description="Get notified when a phone call or processing session completes"
          checked={prefs.sessionComplete}
          onChange={() => togglePref('sessionComplete')}
        />
        <NotificationToggle
          label="Follow-up Reminders"
          description="Receive reminders about scheduled follow-ups"
          checked={prefs.followUpReminders}
          onChange={() => togglePref('followUpReminders')}
        />
        <NotificationToggle
          label="Usage Alerts"
          description="Get notified when usage approaches limits"
          checked={prefs.usageAlerts}
          onChange={() => togglePref('usageAlerts')}
        />
      </div>
    </div>
  );
}

function NotificationToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
          checked ? 'bg-indigo-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
