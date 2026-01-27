import { useState, useEffect } from 'react';
import { Download, X, Monitor, Apple, Terminal } from 'lucide-react';

interface DownloadBannerProps {
  hasAgent: boolean;
}

function getPlatform(): 'mac' | 'windows' | 'linux' | 'unknown' {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';
  return 'unknown';
}

function getArchitecture(): 'arm64' | 'x64' | 'unknown' {
  const ua = navigator.userAgent.toLowerCase();
  // Check for ARM-based Mac
  if (ua.includes('mac') && (navigator.platform === 'MacIntel' || ua.includes('arm'))) {
    // Modern Macs with Apple Silicon
    // @ts-expect-error - userAgentData is not in all TypeScript versions
    if (navigator.userAgentData?.platform === 'macOS') {
      return 'arm64'; // Assume Apple Silicon for newer detection
    }
  }
  return 'arm64'; // Default to arm64 for Mac since it's more common now
}

export default function DownloadBanner({ hasAgent }: DownloadBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [platform] = useState(getPlatform);
  const [arch] = useState(getArchitecture);

  // Check if banner was previously dismissed
  useEffect(() => {
    const dismissedUntil = localStorage.getItem('vibecode-download-banner-dismissed');
    if (dismissedUntil) {
      const dismissedTime = parseInt(dismissedUntil, 10);
      if (Date.now() < dismissedTime) {
        setDismissed(true);
      } else {
        localStorage.removeItem('vibecode-download-banner-dismissed');
      }
    }
  }, []);

  const handleDismiss = () => {
    // Dismiss for 24 hours
    const dismissUntil = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem('vibecode-download-banner-dismissed', dismissUntil.toString());
    setDismissed(true);
  };

  // Don't show if agent is connected or banner was dismissed
  if (hasAgent || dismissed) {
    return null;
  }

  const platformInfo = {
    mac: {
      icon: Apple,
      name: 'macOS',
      downloadUrl: arch === 'arm64'
        ? '/downloads/Vibecode-Agent_aarch64.dmg'
        : '/downloads/Vibecode-Agent_x64.dmg',
      available: arch === 'arm64', // Only Apple Silicon available for now
    },
    windows: {
      icon: Monitor,
      name: 'Windows',
      downloadUrl: '/downloads/Vibecode-Agent_x64-setup.exe',
      available: false,
    },
    linux: {
      icon: Terminal,
      name: 'Linux',
      downloadUrl: '/downloads/Vibecode-Agent_amd64.AppImage',
      available: false,
    },
    unknown: {
      icon: Download,
      name: 'Desktop',
      downloadUrl: '/download',
      available: true,
    },
  };

  const info = platformInfo[platform];
  const Icon = info.icon;

  return (
    <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium">
              Get the Desktop Agent for local file access
            </p>
            <p className="text-sm text-brand-100">
              Run AI tools directly on your machine with native performance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {info.available ? (
            <a
              href={info.downloadUrl}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-brand-700 rounded-lg hover:bg-brand-50 transition-colors font-medium text-sm"
            >
              <Download className="w-4 h-4" />
              Download for {info.name}
            </a>
          ) : (
            <a
              href="/download"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-brand-700 rounded-lg hover:bg-brand-50 transition-colors font-medium text-sm"
            >
              <Download className="w-4 h-4" />
              View Downloads
            </a>
          )}
          <button
            onClick={handleDismiss}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
