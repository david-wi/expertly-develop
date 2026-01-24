import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

interface WebsiteSettings {
  tagline?: string;
  about_text?: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  theme: string;
  hero_image_url?: string;
  hero_title?: string;
  hero_subtitle?: string;
  show_booking_cta: boolean;
  gallery_images: string[];
  testimonials: { name: string; text: string; rating: number }[];
  show_prices: boolean;
  show_staff_bios: boolean;
  allow_public_booking: boolean;
  new_client_discount_enabled: boolean;
  social_links: {
    instagram?: string;
    facebook?: string;
    yelp?: string;
  };
}

interface Website {
  salon_id: string;
  is_published: boolean;
  subdomain?: string;
  settings: WebsiteSettings;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

const themes = [
  { id: 'elegant', name: 'Elegant', description: 'Classic salon look' },
  { id: 'modern', name: 'Modern', description: 'Clean and minimalist' },
  { id: 'warm', name: 'Warm', description: 'Cozy and inviting' },
  { id: 'bold', name: 'Bold', description: 'High contrast, vibrant' },
  { id: 'natural', name: 'Natural', description: 'Earth tones, organic' },
];

export default function WebsiteBuilderPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'design' | 'content' | 'settings'>('design');

  const { data: website, isLoading } = useQuery({
    queryKey: ['website'],
    queryFn: async () => {
      const response = await api.get<Website>('/website');
      return response.data;
    },
  });

  const [settings, setSettings] = useState<WebsiteSettings>({
    primary_color: '#D4A5A5',
    secondary_color: '#C9A86C',
    theme: 'warm',
    show_booking_cta: true,
    gallery_images: [],
    testimonials: [],
    show_prices: true,
    show_staff_bios: true,
    allow_public_booking: true,
    new_client_discount_enabled: true,
    social_links: {},
  });

  const [subdomain, setSubdomain] = useState('');

  useEffect(() => {
    if (website) {
      setSettings(website.settings);
      setSubdomain(website.subdomain || '');
    }
  }, [website]);

  const updateMutation = useMutation({
    mutationFn: async (data: { settings?: WebsiteSettings; subdomain?: string; is_published?: boolean }) => {
      const response = await api.put('/website', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website'] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      await api.post('/website/publish');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website'] });
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: async () => {
      await api.post('/website/unpublish');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website'] });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({ settings, subdomain });
  };

  const handlePublish = () => {
    if (!subdomain) {
      alert('Please set a subdomain before publishing');
      return;
    }
    publishMutation.mutate();
  };

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  }

  const publicUrl = subdomain ? `https://${subdomain}.yourdomain.com` : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Website Builder</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create your public booking page
          </p>
        </div>
        <div className="flex items-center gap-3">
          {website?.is_published ? (
            <>
              <span className="flex items-center gap-2 text-sm text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Published
              </span>
              <button
                onClick={() => unpublishMutation.mutate()}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Unpublish
              </button>
            </>
          ) : (
            <button
              onClick={handlePublish}
              disabled={!subdomain}
              className="px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              Publish Website
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-500 rounded-lg hover:bg-rose-600"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Public URL */}
      {publicUrl && website?.is_published && (
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-green-800">
            Your website is live at:{' '}
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">
              {publicUrl}
            </a>
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'design', label: 'Design' },
          { id: 'content', label: 'Content' },
          { id: 'settings', label: 'Settings' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-rose-600 border-rose-500'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Panel */}
        <div className="space-y-6">
          {activeTab === 'design' && (
            <>
              {/* Subdomain */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Website Address</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="your-salon"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                  <span className="text-gray-500">.yourdomain.com</span>
                </div>
              </div>

              {/* Theme Selection */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Theme</h3>
                <div className="grid grid-cols-2 gap-3">
                  {themes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setSettings({ ...settings, theme: theme.id })}
                      className={`p-4 rounded-lg border-2 text-left transition-colors ${
                        settings.theme === theme.id
                          ? 'border-rose-500 bg-rose-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{theme.name}</div>
                      <div className="text-xs text-gray-500">{theme.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Colors */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Brand Colors</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.primary_color}
                        onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.primary_color}
                        onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.secondary_color}
                        onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.secondary_color}
                        onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'content' && (
            <>
              {/* Hero Section */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Hero Section</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
                    <input
                      type="text"
                      value={settings.hero_title || ''}
                      onChange={(e) => setSettings({ ...settings, hero_title: e.target.value })}
                      placeholder="Welcome to Our Salon"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subheadline</label>
                    <input
                      type="text"
                      value={settings.hero_subtitle || ''}
                      onChange={(e) => setSettings({ ...settings, hero_subtitle: e.target.value })}
                      placeholder="Where beauty meets excellence"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hero Image URL</label>
                    <input
                      type="url"
                      value={settings.hero_image_url || ''}
                      onChange={(e) => setSettings({ ...settings, hero_image_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* About */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">About Section</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
                    <input
                      type="text"
                      value={settings.tagline || ''}
                      onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                      placeholder="Your beauty, our passion"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">About Text</label>
                    <textarea
                      value={settings.about_text || ''}
                      onChange={(e) => setSettings({ ...settings, about_text: e.target.value })}
                      placeholder="Tell visitors about your salon..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Social Media</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                    <input
                      type="url"
                      value={settings.social_links.instagram || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        social_links: { ...settings.social_links, instagram: e.target.value }
                      })}
                      placeholder="https://instagram.com/yoursalon"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
                    <input
                      type="url"
                      value={settings.social_links.facebook || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        social_links: { ...settings.social_links, facebook: e.target.value }
                      })}
                      placeholder="https://facebook.com/yoursalon"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Yelp</label>
                    <input
                      type="url"
                      value={settings.social_links.yelp || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        social_links: { ...settings.social_links, yelp: e.target.value }
                      })}
                      placeholder="https://yelp.com/biz/yoursalon"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'settings' && (
            <>
              {/* Booking Settings */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Booking Settings</h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.allow_public_booking}
                      onChange={(e) => setSettings({ ...settings, allow_public_booking: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-500"
                    />
                    <span className="text-gray-700">Allow public online booking</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.show_booking_cta}
                      onChange={(e) => setSettings({ ...settings, show_booking_cta: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-500"
                    />
                    <span className="text-gray-700">Show "Book Now" button in hero</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.new_client_discount_enabled}
                      onChange={(e) => setSettings({ ...settings, new_client_discount_enabled: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-500"
                    />
                    <span className="text-gray-700">Show new client discount offer</span>
                  </label>
                </div>
              </div>

              {/* Display Settings */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Display Settings</h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.show_prices}
                      onChange={(e) => setSettings({ ...settings, show_prices: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-500"
                    />
                    <span className="text-gray-700">Show service prices</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.show_staff_bios}
                      onChange={(e) => setSettings({ ...settings, show_staff_bios: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-500"
                    />
                    <span className="text-gray-700">Show staff bios</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Preview Panel */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 bg-gray-100 border-b flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Preview</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
          </div>
          <div className="h-[600px] overflow-y-auto">
            {/* Mini Preview */}
            <div
              className="min-h-full"
              style={{ backgroundColor: '#FAF7F5' }}
            >
              {/* Hero Preview */}
              <div
                className="h-48 flex items-center justify-center text-white relative"
                style={{
                  backgroundColor: settings.primary_color,
                  backgroundImage: settings.hero_image_url ? `url(${settings.hero_image_url})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="absolute inset-0 bg-black/30"></div>
                <div className="relative text-center px-4">
                  <h1 className="text-2xl font-bold">{settings.hero_title || 'Your Salon Name'}</h1>
                  <p className="text-sm mt-1 opacity-90">{settings.hero_subtitle || 'Welcome message'}</p>
                  {settings.show_booking_cta && (
                    <button
                      className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ backgroundColor: settings.secondary_color }}
                    >
                      Book Now
                    </button>
                  )}
                </div>
              </div>

              {/* Services Preview */}
              <div className="p-6">
                <h2 className="text-lg font-semibold text-center mb-4" style={{ color: settings.primary_color }}>
                  Our Services
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {['Haircut', 'Color', 'Styling', 'Treatment'].map((service) => (
                    <div key={service} className="bg-white p-3 rounded-lg shadow-sm">
                      <div className="font-medium text-sm">{service}</div>
                      {settings.show_prices && (
                        <div className="text-xs text-gray-500">From $50</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Team Preview */}
              <div className="p-6 bg-white">
                <h2 className="text-lg font-semibold text-center mb-4" style={{ color: settings.primary_color }}>
                  Meet Our Team
                </h2>
                <div className="flex justify-center gap-4">
                  {['Sarah', 'Mike', 'Lisa'].map((name) => (
                    <div key={name} className="text-center">
                      <div
                        className="w-12 h-12 rounded-full mx-auto mb-2"
                        style={{ backgroundColor: settings.secondary_color }}
                      ></div>
                      <div className="text-sm font-medium">{name}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Preview */}
              <div className="p-6 text-center" style={{ backgroundColor: settings.primary_color, color: 'white' }}>
                <div className="text-sm opacity-90">Contact us today</div>
                <div className="flex justify-center gap-4 mt-2">
                  {settings.social_links.instagram && <span className="text-xs">IG</span>}
                  {settings.social_links.facebook && <span className="text-xs">FB</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
