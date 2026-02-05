import { Mic, Users, Languages, Sparkles, Zap, Download, Apple, Bot, FileText, Clock } from 'lucide-react'

const TESTFLIGHT_URL = 'https://testflight.apple.com/join/6758741715' // Apple ID: 6758741715

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
              <Mic className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-semibold text-gray-900">Expertly Hear</span>
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
            <Sparkles className="w-4 h-4" />
            Powered by Deepgram AI
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Real-time{' '}
            <span className="text-violet-600">Audio Transcription</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8">
            Transform speech to text instantly with industry-leading accuracy.
            Speaker diarization, multi-language support, and AI-powered insights.
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
              Advanced Transcription Features
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Expertly Hear combines cutting-edge speech recognition with powerful AI to deliver the best transcription experience.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Real-time Transcription
              </h3>
              <p className="text-gray-600">
                See your words appear as you speak with near-zero latency powered by Deepgram's streaming API.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Speaker Diarization
              </h3>
              <p className="text-gray-600">
                Automatically identify and label different speakers in conversations and meetings.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Languages className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Multi-language Support
              </h3>
              <p className="text-gray-600">
                Transcribe audio in multiple languages with automatic language detection.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Bot className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                AI Assistant
              </h3>
              <p className="text-gray-600">
                Get intelligent summaries, action items, and insights from your transcribed content.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Timestamps & Search
              </h3>
              <p className="text-gray-600">
                Navigate through transcripts with precise timestamps and full-text search.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Export Options
              </h3>
              <p className="text-gray-600">
                Export transcripts in multiple formats including plain text, markdown, and more.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Deepgram Badge Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Powered by Deepgram
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              We use Deepgram's industry-leading speech recognition API for the highest accuracy and fastest performance.
            </p>
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-xl shadow-sm border border-gray-200">
              <Sparkles className="w-6 h-6 text-violet-600" />
              <span className="text-lg font-medium text-gray-900">99%+ Accuracy</span>
              <span className="text-gray-300">|</span>
              <Zap className="w-6 h-6 text-violet-600" />
              <span className="text-lg font-medium text-gray-900">Sub-300ms Latency</span>
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
              From meetings to interviews, Expertly Hear captures every word.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="text-4xl mb-4">💼</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Meetings</h3>
              <p className="text-gray-600">
                Capture meeting notes automatically with speaker identification.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl mb-4">🎙️</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Interviews</h3>
              <p className="text-gray-600">
                Transcribe interviews with accurate speaker separation.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Lectures</h3>
              <p className="text-gray-600">
                Never miss a word from lectures and presentations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-violet-600 py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Start Transcribing Today
          </h2>
          <p className="text-lg text-violet-100 mb-8">
            Download Expertly Hear and experience the future of audio transcription.
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
                <Mic className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-medium">Expertly Hear</span>
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
