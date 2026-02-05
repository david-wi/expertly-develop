import { Users, MessageSquare, Video, Share2, Shield, Zap, Download, Monitor, Apple } from 'lucide-react'

const DOWNLOAD_URL = '#' // Placeholder - replace with actual download link

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-semibold text-gray-900">Expertly Cowork</span>
          </div>
          <a
            href={DOWNLOAD_URL}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-sm font-medium mb-6">
            <Monitor className="w-4 h-4" />
            Built with Tauri
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Desktop{' '}
            <span className="text-violet-600">Team Collaboration</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8">
            A powerful desktop app for seamless team collaboration.
            Built with Tauri for native performance on macOS, Windows, and Linux.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={DOWNLOAD_URL}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium text-lg"
            >
              <Download className="w-5 h-5" />
              Download for Mac
            </a>
            <a
              href={DOWNLOAD_URL}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-lg border border-gray-200"
            >
              <Monitor className="w-5 h-5" />
              Download for Windows
            </a>
          </div>
          <p className="text-sm text-gray-500 mt-4">Also available for Linux</p>
        </div>
      </section>

      {/* Platform Section */}
      <section className="bg-gray-50 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-8 items-center">
            <div className="flex items-center gap-2 text-gray-600">
              <Apple className="w-6 h-6" />
              <span className="font-medium">macOS</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Monitor className="w-6 h-6" />
              <span className="font-medium">Windows</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Monitor className="w-6 h-6" />
              <span className="font-medium">Linux</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-white py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Powerful Collaboration Features
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Everything your team needs to work together effectively, right from your desktop.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Real-time Chat
              </h3>
              <p className="text-gray-600">
                Instant messaging with your team members, organized by channels and direct messages.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Video className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Video Calls
              </h3>
              <p className="text-gray-600">
                High-quality video conferencing for meetings, standups, and pair programming.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Share2 className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Screen Sharing
              </h3>
              <p className="text-gray-600">
                Share your screen with one click for presentations and collaborative work.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Team Presence
              </h3>
              <p className="text-gray-600">
                See who's online and available with real-time presence indicators.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Secure & Private
              </h3>
              <p className="text-gray-600">
                End-to-end encryption for all communications. Your data stays private.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Native Performance
              </h3>
              <p className="text-gray-600">
                Built with Tauri for lightning-fast performance and minimal resource usage.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tauri Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Built with Tauri
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              Tauri enables us to build a small, fast, and secure desktop application
              that feels native on every platform.
            </p>
            <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-violet-600 mb-2">~5MB</div>
                <p className="text-gray-600 text-sm">App Size</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-violet-600 mb-2">~30MB</div>
                <p className="text-gray-600 text-sm">Memory Usage</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-violet-600 mb-2">&lt;1s</div>
                <p className="text-gray-600 text-sm">Startup Time</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Perfect For
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From startups to enterprises, Expertly Cowork helps teams collaborate better.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="text-4xl mb-4">👨‍💻</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Remote Teams</h3>
              <p className="text-gray-600">
                Stay connected with distributed team members across time zones.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Startups</h3>
              <p className="text-gray-600">
                Move fast with instant communication and quick decisions.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl mb-4">🏢</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Enterprises</h3>
              <p className="text-gray-600">
                Secure, reliable collaboration for teams of any size.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-violet-600 py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Collaborate Better?
          </h2>
          <p className="text-lg text-violet-100 mb-8">
            Download Expertly Cowork and bring your team together.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={DOWNLOAD_URL}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-violet-600 rounded-lg hover:bg-violet-50 transition-colors font-medium text-lg"
            >
              <Apple className="w-5 h-5" />
              Download for Mac
            </a>
            <a
              href={DOWNLOAD_URL}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-violet-500 text-white rounded-lg hover:bg-violet-400 transition-colors font-medium text-lg"
            >
              <Monitor className="w-5 h-5" />
              Download for Windows
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-medium">Expertly Cowork</span>
            </div>
            <p className="text-gray-400 text-sm">
              Part of the Expertly suite of productivity tools.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
