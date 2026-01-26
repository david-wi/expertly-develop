import {
  Code2,
  Bot,
  Zap,
  MessageSquare,
  ArrowRight,
  Check,
  LayoutDashboard,
  Wifi,
  Layers,
} from 'lucide-react'

const features = [
  {
    name: 'Multi-Agent Dashboard',
    description: 'Manage multiple AI coding sessions simultaneously with a draggable, resizable widget system.',
    icon: LayoutDashboard,
  },
  {
    name: 'Real-Time Collaboration',
    description: 'Stream responses in real-time with WebSocket connections for instant feedback and interaction.',
    icon: Wifi,
  },
  {
    name: 'AI Code Generation',
    description: 'Leverage Claude AI to generate, refactor, and explain code across multiple programming languages.',
    icon: Code2,
  },
  {
    name: 'Multiple AI Assistants',
    description: 'Spin up separate chat widgets for different coding tasks, each with its own context and history.',
    icon: Bot,
  },
  {
    name: 'WebSocket Connections',
    description: 'Persistent connections ensure low-latency communication between you and your AI assistants.',
    icon: Zap,
  },
  {
    name: 'Widget System',
    description: 'Flexible grid layout with drag-and-drop widgets. Customize your workspace to match your workflow.',
    icon: Layers,
  },
]

const benefits = [
  'Parallel AI sessions',
  'Real-time streaming',
  'Context-aware assistance',
  'Customizable layout',
  'Code syntax highlighting',
  'Markdown rendering',
]

export default function LandingPage() {
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
                href="/download"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Download Agent
              </a>
              <a
                href="/"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Sign In
              </a>
              <a
                href="/"
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-brand-50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
              Multi-Agent AI Coding,{' '}
              <span className="text-brand-600">Reimagined</span>
            </h1>
            <p className="mt-6 text-xl text-gray-600 leading-relaxed">
              A powerful dashboard for managing multiple AI coding sessions simultaneously.
              Real-time streaming, draggable widgets, and seamless collaboration with Claude AI.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium text-lg"
              >
                Launch Dashboard
                <ArrowRight className="w-5 h-5" />
              </a>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors font-medium text-lg"
              >
                See Features
              </a>
            </div>
          </div>

          {/* Hero Image Placeholder */}
          <div className="mt-16 relative">
            <div className="bg-gradient-to-b from-brand-100 to-brand-50 rounded-2xl shadow-xl overflow-hidden border border-brand-200">
              <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 m-4 rounded-lg">
                <div className="text-center">
                  <div className="flex justify-center gap-4 mb-4">
                    <MessageSquare className="w-12 h-12 text-white/80" />
                    <Bot className="w-12 h-12 text-white/80" />
                    <Code2 className="w-12 h-12 text-white/80" />
                  </div>
                  <p className="mt-4 text-white/60 text-sm">Multi-Agent Dashboard Preview</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Bar */}
      <div className="bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 text-white">
                <Check className="w-5 h-5 text-brand-400" />
                <span className="text-sm font-medium">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Everything you need for AI-powered coding
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              A complete platform for managing multiple AI coding assistants in one place.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.name}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-brand-100 rounded-lg flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-brand-600" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {feature.name}
                </h3>
                <p className="mt-2 text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Start coding with AI in three steps
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Get up and running with your multi-agent coding workspace in minutes.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-brand-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                1
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Create a Widget
              </h3>
              <p className="mt-3 text-gray-600">
                Click the plus button to add a new AI chat widget to your dashboard workspace.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-brand-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                2
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Start Chatting
              </h3>
              <p className="mt-3 text-gray-600">
                Describe your coding task and watch as the AI generates code and explanations in real-time.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-brand-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                3
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Organize & Scale
              </h3>
              <p className="mt-3 text-gray-600">
                Drag, resize, and arrange widgets. Add more sessions for parallel tasks.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-brand-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">
            Ready to supercharge your coding workflow?
          </h2>
          <p className="mt-4 text-lg text-brand-100">
            Join developers who are building faster with multi-agent AI assistance.
          </p>
          <a
            href="/"
            className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-white text-brand-600 rounded-lg hover:bg-brand-50 transition-colors font-medium text-lg"
          >
            Launch Dashboard
            <ArrowRight className="w-5 h-5" />
          </a>
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
  )
}
