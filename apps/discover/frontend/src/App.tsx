import { Video, Layers, FileImage, FileText, Zap, Download, Apple, Monitor } from 'lucide-react'

const TESTFLIGHT_URL = '#' // Placeholder - replace with actual TestFlight link

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
              <Video className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-semibold text-gray-900">Expertly Discover</span>
          </div>
          <a
            href={TESTFLIGHT_URL}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium"
          >
            <Apple className="w-4 h-4" />
            Get on TestFlight
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-sm font-medium mb-6">
            <Apple className="w-4 h-4" />
            Available for iOS & macOS
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Extract Key Frames from{' '}
            <span className="text-violet-600">Screen Recordings</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8">
            Automatically detect changes in your screen recordings and extract the most important frames.
            Perfect for creating documentation, tutorials, and walkthroughs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={TESTFLIGHT_URL}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium text-lg"
            >
              <Download className="w-5 h-5" />
              Download on TestFlight
            </a>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-lg border border-gray-200"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-white py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Powerful Video Analysis
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Expertly Discover uses intelligent change detection to identify the frames that matter most.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Layers className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Smart Change Detection
              </h3>
              <p className="text-gray-600">
                Automatically detects significant visual changes in your recordings and extracts only the unique frames.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <FileImage className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Key Frame Extraction
              </h3>
              <p className="text-gray-600">
                Extract high-quality images from your screen recordings with precision timing and clarity.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                PDF & HTML Export
              </h3>
              <p className="text-gray-600">
                Export your extracted frames as professional PDF documents or HTML pages for easy sharing.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Fast Processing
              </h3>
              <p className="text-gray-600">
                Optimized algorithms process your videos quickly, even for long recordings.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Apple className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                iOS & macOS Native
              </h3>
              <p className="text-gray-600">
                Built specifically for Apple platforms with native performance and seamless integration.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Monitor className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Screen Recording Support
              </h3>
              <p className="text-gray-600">
                Works with screen recordings from any source - perfect for tutorials and documentation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Perfect For
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From developers to educators, Expertly Discover helps you create better documentation.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Documentation</h3>
              <p className="text-gray-600">
                Create step-by-step visual guides from your software demos.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl mb-4">🎓</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Tutorials</h3>
              <p className="text-gray-600">
                Build comprehensive tutorials with extracted key moments.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl mb-4">💼</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Presentations</h3>
              <p className="text-gray-600">
                Extract frames for presentations and training materials.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-violet-600 py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Extract Key Frames?
          </h2>
          <p className="text-lg text-violet-100 mb-8">
            Download Expertly Discover today and start creating better documentation from your screen recordings.
          </p>
          <a
            href={TESTFLIGHT_URL}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-violet-600 rounded-lg hover:bg-violet-50 transition-colors font-medium text-lg"
          >
            <Apple className="w-5 h-5" />
            Get on TestFlight
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
                <Video className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-medium">Expertly Discover</span>
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
