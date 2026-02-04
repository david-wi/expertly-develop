import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChevronRight,
  Mail,
  Phone,
  Clock,
  Truck,
  Brain,
  Check,
  Quote,
  Play,
  Sparkles,
  DollarSign,
  AlertTriangle,
  FileText,
  Send,
  BarChart3,
  Zap,
  Shield,
} from 'lucide-react'

function ExpertlyLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.8379 24.9606C16.6714 22.9391 17.9566 20.4822 18.571 17.8238L24.2667 20.4657C24.3728 20.4481 24.4733 20.4064 24.5606 20.3436C24.6478 20.2809 24.7194 20.1989 24.7698 20.104C24.8201 20.0091 24.8479 19.9039 24.8509 19.7965C24.8539 19.6892 24.832 19.5826 24.7871 19.485L19.4266 8.14301C19.3632 8.00575 19.2699 7.88442 19.1535 7.78793C19.037 7.69144 18.9004 7.62224 18.7537 7.58542C18.607 7.5486 18.4539 7.54509 18.3057 7.57515C18.1574 7.60521 18.0178 7.66808 17.897 7.75913L7.63363 15.6497C7.10981 16.0196 7.36125 16.9409 7.98285 16.92L14.0452 16.6931C14.0452 16.6931 13.2106 20.2912 8.35301 22.0047L8.27269 22.0326C2.61541 23.4285 -0.000202179 18.7452 -0.000202179 15.7509C-0.00718689 7.22169 7.2006 0.699166 15.1173 0.0570345C17.8181 -0.167956 20.5328 0.274916 23.0218 1.34656C25.5108 2.41821 27.6976 4.08568 29.3891 6.2018C31.0806 8.31791 32.2249 10.8176 32.7209 13.4803C33.2169 16.1429 33.0494 18.8867 32.2332 21.4693C31.4169 24.0519 29.9771 26.3941 28.0407 28.289C26.1043 30.184 23.7309 31.5734 21.13 32.3347C18.5291 33.096 15.7807 33.2058 13.1273 32.6544C10.4738 32.103 7.99705 30.9073 5.91549 29.1728C9.17716 28.7959 12.4772 27.6408 14.8379 24.9606Z" fill="url(#paint0_linear_expertly_tms)"/>
      <defs>
        <linearGradient id="paint0_linear_expertly_tms" x1="32.9998" y1="33" x2="-6.71734" y2="18.8377" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981"/>
          <stop offset="1" stopColor="#059669"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

const integrations = [
  { name: 'Email Inbox', icon: Mail },
  { name: 'Load Boards', icon: Truck },
  { name: 'QuickBooks', icon: DollarSign },
  { name: 'ELD/GPS', icon: Clock },
]

const features = [
  {
    icon: Sparkles,
    title: 'AI Email Extraction',
    description: 'Paste an email, AI extracts origin, destination, dates, equipment, and commodity instantly with evidence.',
  },
  {
    icon: Brain,
    title: 'Smart Carrier Matching',
    description: 'AI ranks carriers by lane history, on-time percentage, and cost. Best matches in seconds.',
  },
  {
    icon: Send,
    title: 'One-Click Dispatch',
    description: 'From quote to tender to tracking—each step is one click with AI-drafted communications.',
  },
  {
    icon: AlertTriangle,
    title: 'Proactive Risk Alerts',
    description: 'AI flags at-risk shipments before problems happen. No more surprise service failures.',
  },
  {
    icon: DollarSign,
    title: 'Margin Optimization',
    description: 'Real-time margin tracking, pricing suggestions, and profitability analytics per lane.',
  },
  {
    icon: BarChart3,
    title: 'Unified Dashboard',
    description: 'Every pending task, at-risk load, and follow-up in one view. Nothing slips through.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <ExpertlyLogo className="w-8 h-8" />
              <span className="text-xl font-bold text-gray-900">Expertly TMS</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/compare" className="text-gray-600 hover:text-gray-900 font-medium">
                Compare
              </Link>
              <Link to="/" className="text-gray-600 hover:text-gray-900 font-medium">
                Sign In
              </Link>
              <Link
                to="/"
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 lg:pt-24">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              AI-First Transportation Management
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-tight">
              Quote to Invoice in
              <br />
              <span className="text-emerald-600">Minutes, Not Hours</span>
            </h1>

            {/* Visual tagline */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
              <span className="px-5 py-2.5 bg-gray-900 text-white rounded-full font-semibold text-lg">Rate Request</span>
              <ChevronRight className="hidden sm:block w-5 h-5 text-gray-400" />
              <span className="px-5 py-2.5 bg-emerald-100 text-emerald-700 rounded-full font-semibold text-lg">AI Extracts Details</span>
              <ChevronRight className="hidden sm:block w-5 h-5 text-gray-400" />
              <span className="px-5 py-2.5 bg-emerald-600 text-white rounded-full font-semibold text-lg">Quote Sent</span>
            </div>

            <p className="mt-8 text-xl text-gray-600 max-w-2xl mx-auto">
              Stop copying and pasting between emails and spreadsheets.
              Let AI handle the data entry while you focus on building relationships.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-semibold text-lg shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/30"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all font-semibold text-lg"
              >
                <Play className="w-5 h-5" />
                Watch Demo
              </a>
            </div>
          </div>

          {/* Hero Screenshot */}
          <div className="mt-16 relative max-w-5xl mx-auto">
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-gray-100">
              <img
                src="/images/tms-dashboard.png"
                alt="TMS Dashboard showing shipments and dispatch board"
                className="w-full h-auto"
                onError={(e) => {
                  // Fallback to a colored placeholder
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  target.parentElement!.innerHTML = `
                    <div class="w-full h-[400px] bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center">
                      <div class="text-center">
                        <div class="w-24 h-24 mx-auto mb-4 bg-emerald-200 rounded-2xl flex items-center justify-center">
                          <svg class="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"></path>
                          </svg>
                        </div>
                        <p class="text-emerald-700 font-medium">AI-Powered TMS Dashboard</p>
                      </div>
                    </div>
                  `
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl sm:text-5xl font-bold text-white">80%</div>
              <div className="mt-2 text-gray-400 font-medium">Less data entry</div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-bold text-white">5 min</div>
              <div className="mt-2 text-gray-400 font-medium">Email to quote</div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-bold text-white">Zero</div>
              <div className="mt-2 text-gray-400 font-medium">Missed follow-ups</div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-bold text-white">2x</div>
              <div className="mt-2 text-gray-400 font-medium">Loads per rep</div>
            </div>
          </div>
        </div>
      </div>

      {/* The Problem */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Your current TMS was built for
              <br />
              <span className="text-red-500">data entry, not speed</span>
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              Most TMS systems are just glorified spreadsheets. You still copy-paste from emails,
              manually search for carriers, and chase updates all day.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Before */}
            <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">The Old Way</div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                  </span>
                  <span className="text-gray-600">Copy email → paste into 15 different fields</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                  </span>
                  <span className="text-gray-600">Manually search through carrier lists</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                  </span>
                  <span className="text-gray-600">Type out every quote email from scratch</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                  </span>
                  <span className="text-gray-600">Constantly check shipments for problems</span>
                </li>
              </ul>
            </div>

            {/* After */}
            <div className="bg-emerald-600 rounded-2xl p-8 text-white">
              <div className="text-sm font-semibold text-emerald-200 uppercase tracking-wide mb-4">With Expertly TMS</div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-emerald-200" />
                  </span>
                  <span>Paste email → AI fills every field automatically</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-emerald-200" />
                  </span>
                  <span>AI suggests best carriers based on lane history</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-emerald-200" />
                  </span>
                  <span>One click to send AI-drafted professional quotes</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-emerald-200" />
                  </span>
                  <span>AI alerts you before problems happen</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Built for speed, powered by AI
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              Every feature designed to eliminate busywork and let you move more freight.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-gray-900 text-lg mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-4">
            How it works
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16 max-w-2xl mx-auto">
            From rate request to delivered in four simple steps
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { num: '1', title: 'Receive Request', desc: 'Customer emails a rate request. Paste it in or connect your inbox for auto-import.', icon: Mail },
              { num: '2', title: 'AI Extracts Details', desc: 'Origin, destination, dates, commodity—AI extracts everything with evidence you can verify.', icon: Sparkles },
              { num: '3', title: 'Quote & Dispatch', desc: 'One click to send quote. AI suggests carriers. One click to tender. Done.', icon: Send },
              { num: '4', title: 'Track & Invoice', desc: 'AI monitors for delays. Auto-generates invoice on delivery. You get paid faster.', icon: FileText },
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="bg-gray-50 rounded-2xl p-6 h-full border border-gray-100">
                  <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold mb-4">
                    {step.num}
                  </div>
                  <step.icon className="w-8 h-8 text-emerald-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 text-lg mb-2">{step.title}</h3>
                  <p className="text-gray-600 text-sm">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Social Proof */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Quote className="w-12 h-12 text-emerald-200 mx-auto mb-6" />
          <blockquote className="text-2xl sm:text-3xl font-medium text-gray-900 leading-relaxed">
            "I used to spend 20 minutes on each quote just entering data. Now I paste the email,
            AI fills everything, and I'm sending quotes in <span className="text-emerald-600">under 2 minutes</span>.
            My quote volume is up 3x."
          </blockquote>
          <div className="mt-8">
            <div className="font-semibold text-gray-900">Freight Broker</div>
            <div className="text-gray-500">Midwest 3PL</div>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-gray-400" />
              <div>
                <div className="font-semibold text-gray-900">Bank-Grade Security</div>
                <div className="text-sm text-gray-500">256-bit encryption, SOC 2 compliant</div>
              </div>
            </div>
            <div className="hidden md:block w-px h-12 bg-gray-200" />
            <div className="flex items-center gap-3">
              <Phone className="w-8 h-8 text-gray-400" />
              <div>
                <div className="font-semibold text-gray-900">US-Based Support</div>
                <div className="text-sm text-gray-500">Real humans who know freight</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h3 className="text-lg font-semibold text-gray-900">Connects with your tools</h3>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {integrations.map((integration) => (
              <div key={integration.name} className="flex items-center gap-2 px-5 py-3 bg-white rounded-xl border border-gray-200">
                <integration.icon className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-700">{integration.name}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 px-5 py-3 bg-white rounded-xl border border-gray-200">
              <span className="font-medium text-gray-500">+ more</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div id="demo" className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 py-24">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
            Ready to move more freight?
          </h2>
          <p className="mt-6 text-xl text-emerald-100 max-w-xl mx-auto">
            Stop drowning in data entry. Start closing more deals.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-emerald-600 rounded-xl hover:bg-emerald-50 transition-all font-semibold text-lg shadow-xl"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all font-semibold text-lg border border-white/20"
            >
              Book a Demo
            </a>
          </div>
          <p className="mt-6 text-sm text-emerald-200">
            No credit card required. Free for 14 days.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <ExpertlyLogo className="w-8 h-8" />
              <span className="text-lg font-bold text-white">Expertly TMS</span>
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
