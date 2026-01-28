import {
  Code2,
  Download,
  Monitor,
  Apple,
  Terminal,
  Check,
  ArrowLeft,
  Cpu,
  HardDrive,
  Zap,
  Shield,
} from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Native Performance',
    description: 'Built with Tauri and Rust for lightning-fast execution',
  },
  {
    icon: Shield,
    title: 'Resource Aware',
    description: 'Automatically queues tasks when system is under load',
  },
  {
    icon: Cpu,
    title: 'System Tray',
    description: 'Runs quietly in your system tray with status indicators',
  },
  {
    icon: HardDrive,
    title: 'Auto Updates',
    description: 'Stays current with automatic background updates',
  },
];

const tools = [
  'read_file - Read any file on your system',
  'write_file - Create or update files',
  'list_files - Browse directories with glob patterns',
  'run_command - Execute shell commands',
  'search_files - Search file contents with grep',
];

interface Platform {
  name: string;
  icon: typeof Monitor;
  downloads: {
    label: string;
    arch: string;
    url: string;
    size?: string;
    available?: boolean;
  }[];
}

const platforms: Platform[] = [
  {
    name: 'macOS',
    icon: Apple,
    downloads: [
      {
        label: 'Apple Silicon',
        arch: 'aarch64',
        url: '/downloads/Vibecode-Agent_aarch64.dmg',
        size: '~6.4 MB',
      },
      {
        label: 'Intel',
        arch: 'x64',
        url: '/downloads/Vibecode-Agent_x64.dmg',
        size: '~44 MB',
        available: false,
      },
    ],
  },
  {
    name: 'Windows',
    icon: Monitor,
    downloads: [
      {
        label: 'Windows (64-bit)',
        arch: 'x64',
        url: '/downloads/Vibecode-Agent_x64-setup.exe',
        size: '~15 MB',
        available: false,
      },
    ],
  },
  {
    name: 'Linux',
    icon: Terminal,
    downloads: [
      {
        label: 'AppImage',
        arch: 'x64',
        url: '/downloads/Vibecode-Agent_amd64.AppImage',
        size: '~90 MB',
        available: false,
      },
      {
        label: 'Debian/Ubuntu',
        arch: 'x64',
        url: '/downloads/Vibecode-Agent_amd64.deb',
        size: '~10 MB',
        available: false,
      },
    ],
  },
];

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                <Code2 className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Expertly Vibecode</span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/landing"
                className="text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </a>
              <a
                href="/"
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
              >
                Open Dashboard
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-brand-50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-100 text-brand-700 rounded-full text-sm font-medium mb-6">
              <Download className="w-4 h-4" />
              Desktop Agent
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
              Run AI tools on your{' '}
              <span className="text-brand-600">local machine</span>
            </h1>
            <p className="mt-6 text-xl text-gray-600 leading-relaxed">
              The Vibecode Desktop Agent connects to the dashboard and executes file operations
              and commands directly on your computer. Native, fast, and secure.
            </p>
          </div>
        </div>
      </div>

      {/* Downloads */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
            Download for your platform
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {platforms.map((platform) => (
              <div
                key={platform.name}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <platform.icon className="w-6 h-6 text-gray-700" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">{platform.name}</h3>
                </div>

                <div className="space-y-3">
                  {platform.downloads.map((download) => {
                    const isAvailable = download.available !== false;
                    return isAvailable ? (
                      <a
                        key={download.arch}
                        href={download.url}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-brand-50 hover:border-brand-200 border border-transparent transition-colors group"
                      >
                        <div>
                          <div className="font-medium text-gray-900 group-hover:text-brand-700">
                            {download.label}
                          </div>
                          {download.size && (
                            <div className="text-sm text-gray-500">{download.size}</div>
                          )}
                        </div>
                        <Download className="w-5 h-5 text-gray-400 group-hover:text-brand-600" />
                      </a>
                    ) : (
                      <div
                        key={download.arch}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-transparent opacity-60"
                      >
                        <div>
                          <div className="font-medium text-gray-500">
                            {download.label}
                          </div>
                          <div className="text-sm text-gray-400">Coming soon</div>
                        </div>
                        <Download className="w-5 h-5 text-gray-300" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-gray-500 text-sm mt-8">
            macOS Apple Silicon available now. Other platforms coming soon.
          </p>

          {/* macOS Gatekeeper note */}
          <div className="max-w-2xl mx-auto mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h4 className="font-medium text-amber-800 mb-2">macOS Security Note</h4>
            <p className="text-sm text-amber-700 mb-2">
              If macOS shows "app is damaged" or "can't be opened", run this command in Terminal:
            </p>
            <code className="block bg-amber-100 p-2 rounded text-xs text-amber-900 font-mono">
              xattr -cr ~/Downloads/Vibecode-Agent_aarch64.dmg
            </code>
            <p className="text-xs text-amber-600 mt-2">
              This removes the quarantine flag that macOS applies to downloaded files.
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
            Why use the desktop agent?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="w-12 h-12 bg-brand-100 rounded-lg flex items-center justify-center mx-auto">
                  <feature.icon className="w-6 h-6 text-brand-600" />
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tools */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
              Available tools
            </h2>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <ul className="space-y-3">
                {tools.map((tool) => (
                  <li key={tool} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <code className="text-sm text-gray-700">{tool}</code>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Start */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
              Quick start
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Download and install</h3>
                  <p className="text-gray-600">
                    Download the agent for your platform and run the installer.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Configure settings</h3>
                  <p className="text-gray-600">
                    Set your working directory and connection preferences.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Connect and code</h3>
                  <p className="text-gray-600">
                    The agent connects automatically and appears in your system tray.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                <Code2 className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">Expertly Vibecode</span>
            </div>
            <p className="text-gray-400 text-sm">
              Part of the Expertly suite of products.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
