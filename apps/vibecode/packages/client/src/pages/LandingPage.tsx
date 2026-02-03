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

function ExpertlyLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.8379 24.9606C16.6714 22.9391 17.9566 20.4822 18.571 17.8238L24.2667 20.4657C24.3728 20.4481 24.4733 20.4064 24.5606 20.3436C24.6478 20.2809 24.7194 20.1989 24.7698 20.104C24.8201 20.0091 24.8479 19.9039 24.8509 19.7965C24.8539 19.6892 24.832 19.5826 24.7871 19.485L19.4266 8.14301C19.3632 8.00575 19.2699 7.88442 19.1535 7.78793C19.037 7.69144 18.9004 7.62224 18.7537 7.58542C18.607 7.5486 18.4539 7.54509 18.3057 7.57515C18.1574 7.60521 18.0178 7.66808 17.897 7.75913L7.63363 15.6497C7.10981 16.0196 7.36125 16.9409 7.98285 16.92L14.0452 16.6931C14.0452 16.6931 13.2106 20.2912 8.35301 22.0047L8.27269 22.0326C2.61541 23.4285 -0.000202179 18.7452 -0.000202179 15.7509C-0.00718689 7.22169 7.2006 0.699166 15.1173 0.0570345C17.8181 -0.167956 20.5328 0.274916 23.0218 1.34656C25.5108 2.41821 27.6976 4.08568 29.3891 6.2018C31.0806 8.31791 32.2249 10.8176 32.7209 13.4803C33.2169 16.1429 33.0494 18.8867 32.2332 21.4693C31.4169 24.0519 29.9771 26.3941 28.0407 28.289C26.1043 30.184 23.7309 31.5734 21.13 32.3347C18.5291 33.096 15.7807 33.2058 13.1273 32.6544C10.4738 32.103 7.99705 30.9073 5.91549 29.1728C9.17716 28.7959 12.4772 27.6408 14.8379 24.9606Z" fill="url(#paint0_linear_expertly_vibecode)"/>
      <defs>
        <linearGradient id="paint0_linear_expertly_vibecode" x1="32.9998" y1="33" x2="-6.71734" y2="18.8377" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9648FF"/>
          <stop offset="1" stopColor="#2C62F9"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

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
              <ExpertlyLogo className="w-8 h-8" />
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
              <ExpertlyLogo className="w-8 h-8" />
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
