import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChevronRight,
  Check,
  Phone,
  FileText,
  Upload,
  Users,
  Zap,
  Shield,
  Clock,
  BarChart3,
  RefreshCw,
  Mic,
  Quote,
  Brain,
  History,
} from 'lucide-react'

function ExpertlyLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.8379 24.9606C16.6714 22.9391 17.9566 20.4822 18.571 17.8238L24.2667 20.4657C24.3728 20.4481 24.4733 20.4064 24.5606 20.3436C24.6478 20.2809 24.7194 20.1989 24.7698 20.104C24.8201 20.0091 24.8479 19.9039 24.8509 19.7965C24.8539 19.6892 24.832 19.5826 24.7871 19.485L19.4266 8.14301C19.3632 8.00575 19.2699 7.88442 19.1535 7.78793C19.037 7.69144 18.9004 7.62224 18.7537 7.58542C18.607 7.5486 18.4539 7.54509 18.3057 7.57515C18.1574 7.60521 18.0178 7.66808 17.897 7.75913L7.63363 15.6497C7.10981 16.0196 7.36125 16.9409 7.98285 16.92L14.0452 16.6931C14.0452 16.6931 13.2106 20.2912 8.35301 22.0047L8.27269 22.0326C2.61541 23.4285 -0.000202179 18.7452 -0.000202179 15.7509C-0.00718689 7.22169 7.2006 0.699166 15.1173 0.0570345C17.8181 -0.167956 20.5328 0.274916 23.0218 1.34656C25.5108 2.41821 27.6976 4.08568 29.3891 6.2018C31.0806 8.31791 32.2249 10.8176 32.7209 13.4803C33.2169 16.1429 33.0494 18.8867 32.2332 21.4693C31.4169 24.0519 29.9771 26.3941 28.0407 28.289C26.1043 30.184 23.7309 31.5734 21.13 32.3347C18.5291 33.096 15.7807 33.2058 13.1273 32.6544C10.4738 32.103 7.99705 30.9073 5.91549 29.1728C9.17716 28.7959 12.4772 27.6408 14.8379 24.9606Z" fill="url(#paint0_linear_expertly_intake)"/>
      <defs>
        <linearGradient id="paint0_linear_expertly_intake" x1="32.9998" y1="33" x2="-6.71734" y2="18.8377" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1"/>
          <stop offset="1" stopColor="#4F46E5"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

const differentiators = [
  {
    icon: Mic,
    title: 'Voice-first, not form-first',
    description: 'Customers explain their business in their own words. The AI follows up intelligently and captures structured answers without forcing them through a form.',
  },
  {
    icon: Clock,
    title: 'Self-serve for customers',
    description: 'No calendars. No coordination. Customers onboard on their schedule, 24/7.',
  },
  {
    icon: FileText,
    title: 'Structured every time',
    description: 'Every response is mapped to a defined onboarding schema. Clean inputs, ready for configuration.',
  },
  {
    icon: Brain,
    title: 'Built for real-world onboarding',
    description: 'People don\'t have all the answers in one call. Expertly Intake handles partial answers, callbacks, documents, and handoffs without losing context.',
  },
]

const capabilities = [
  {
    icon: Users,
    title: 'Multi-person onboarding',
    description: 'Different stakeholders contribute across separate calls. One shared record.',
  },
  {
    icon: Upload,
    title: 'Document & URL ingestion',
    description: 'Upload contracts, org charts, or policies. The AI proposes answers but never overwrites customer input without review.',
  },
  {
    icon: RefreshCw,
    title: 'Living sources',
    description: 'Link websites or service catalogs. Changes are detected and flagged.',
  },
  {
    icon: History,
    title: 'Full audit trail',
    description: 'Every answer is timestamped and sourced. Nothing is lost or guessed.',
  },
  {
    icon: BarChart3,
    title: 'Time & usage tracking',
    description: 'See exactly how long onboarding takes, by section and contributor. Measure and maintain your 80% time reduction.',
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
              <div className="flex flex-col">
                <span className="text-xl font-bold text-gray-900 leading-tight">Expertly Intake</span>
                <span className="text-xs text-indigo-600 font-medium -mt-0.5">Voice-First Client Onboarding</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/" className="text-gray-600 hover:text-gray-900 font-medium">
                Sign In
              </Link>
              <Link
                to="/"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-indigo-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 lg:pt-24">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Client onboarding that runs itself
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-tight">
              Client Onboarding
              <br />
              <span className="text-indigo-600">That Runs Itself</span>
            </h1>
            <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">
              Voice-first AI onboarding for subscription and service businesses.
            </p>
            <p className="mt-3 text-xl font-medium text-gray-900 max-w-2xl mx-auto">
              Cut onboarding time by <span className="text-indigo-600">80%</span>. No forms. No scheduling. No follow-ups.
            </p>

            {/* Visual flow */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
              <span className="px-5 py-2.5 bg-gray-900 text-white rounded-full font-semibold text-lg">New customer signs up</span>
              <ChevronRight className="hidden sm:block w-5 h-5 text-gray-400" />
              <span className="px-5 py-2.5 bg-indigo-100 text-indigo-700 rounded-full font-semibold text-lg">They call in and talk</span>
              <ChevronRight className="hidden sm:block w-5 h-5 text-gray-400" />
              <span className="px-5 py-2.5 bg-indigo-600 text-white rounded-full font-semibold text-lg">Onboarding data captured</span>
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-semibold text-lg shadow-lg shadow-indigo-600/25 hover:shadow-xl hover:shadow-indigo-600/30"
              >
                Automate Your Onboarding
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#problem"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all font-semibold text-lg"
              >
                See How It Works
              </a>
            </div>
          </div>

          {/* Hero Illustration */}
          <div className="mt-16 relative max-w-5xl mx-auto">
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* Left: Conversation */}
                <div className="bg-gray-50 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-gray-200">
                  <div className="flex items-center gap-2 mb-5">
                    <Phone className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Customer call</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <div className="bg-indigo-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%] text-sm">
                        What's the name of your organization?
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[85%] text-sm text-gray-700">
                        We're Acme Health Services, based out of Chicago. About 120 employees.
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-indigo-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%] text-sm">
                        And who's the primary point of contact for billing?
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[85%] text-sm text-gray-700">
                        That'd be Sarah Chen, she's our finance director. I can give you her email...
                      </div>
                    </div>
                  </div>
                </div>
                {/* Right: Structured data */}
                <div className="p-6 sm:p-8">
                  <div className="flex items-center gap-2 mb-5">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Onboarding record</span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Organization</div>
                      <div className="mt-1 text-sm font-medium text-gray-900">Acme Health Services</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Location</div>
                      <div className="mt-1 text-sm font-medium text-gray-900">Chicago, IL</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Company Size</div>
                      <div className="mt-1 text-sm font-medium text-gray-900">~120 employees</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Billing Contact</div>
                      <div className="mt-1 text-sm font-medium text-gray-900">Sarah Chen, Finance Director</div>
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
                        <Check className="w-3.5 h-3.5" />
                        4 of 12 fields captured — call in progress
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
              <div className="mt-2 text-gray-400 font-medium">Reduction in onboarding time</div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-bold text-white">Voice</div>
              <div className="mt-2 text-gray-400 font-medium">Customers talk, AI captures</div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-bold text-white">24/7</div>
              <div className="mt-2 text-gray-400 font-medium">Self-serve, on their schedule</div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-bold text-white">100%</div>
              <div className="mt-2 text-gray-400 font-medium">Structured, every time</div>
            </div>
          </div>
        </div>
      </div>

      {/* The Problem */}
      <div id="problem" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Stop running onboarding calls
            </h2>
            <h3 className="text-2xl sm:text-3xl font-semibold text-indigo-600 mt-2">
              Start sending a phone number
            </h3>
            <p className="mt-4 text-xl text-gray-600">
              Every new customer onboarding follows the same painful pattern:
              someone schedules a call, walks through a checklist, types answers, chases missing details,
              and repeats it all again next week.
            </p>
            <p className="mt-3 text-xl text-gray-600">
              <span className="font-semibold text-gray-900">Expertly Intake replaces that entire process.</span>{' '}
              Your customers call an AI onboarding agent, talk naturally about their business,
              and the system captures clean, structured onboarding data automatically — reducing
              onboarding time by <span className="font-semibold text-indigo-600">80%</span>.
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
                  <span className="text-gray-600">Schedule onboarding calls across time zones</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                  </span>
                  <span className="text-gray-600">Walk through checklists while typing notes</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                  </span>
                  <span className="text-gray-600">Chase missing info via email and Slack</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                  </span>
                  <span className="text-gray-600">Repeat the process for every new customer</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                  </span>
                  <span className="text-gray-600">Hire more onboarding staff as you grow</span>
                </li>
              </ul>
            </div>

            {/* After */}
            <div className="bg-indigo-600 rounded-2xl p-8 text-white">
              <div className="text-sm font-semibold text-indigo-200 uppercase tracking-wide mb-4">With Expertly Intake</div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-indigo-200" />
                  </span>
                  <span>Send a phone number instead of booking a call</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-indigo-200" />
                  </span>
                  <span>AI asks, listens, and captures structured data</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-indigo-200" />
                  </span>
                  <span>Customers call back anytime or loop in teammates</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-indigo-200" />
                  </span>
                  <span>Upload documents to fill gaps safely</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-indigo-200" />
                  </span>
                  <span>Receive a complete onboarding record, ready to use</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* What Makes This Different */}
      <div id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              What makes this different
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {differentiators.map((item, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-900 text-lg mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Designed for Complex Onboarding */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Designed for complex onboarding
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {capabilities.map((cap, i) => (
              <div key={i} className="flex items-start gap-4 p-5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <cap.icon className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{cap.title}</h3>
                  <p className="text-gray-600 text-sm">{cap.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-4">
            From signup to live, without the bottlenecks
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16 max-w-2xl mx-auto">
            How it works from the customer's point of view
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: '1',
                title: 'Create an Onboarding',
                desc: 'Choose a template and get a dedicated phone number.',
                icon: FileText,
              },
              {
                num: '2',
                title: 'Customer Calls In',
                desc: 'They talk naturally. The AI handles follow-ups and gaps.',
                icon: Phone,
              },
              {
                num: '3',
                title: 'Others Contribute',
                desc: 'Multiple people, multiple calls, shared context.',
                icon: Users,
              },
              {
                num: '4',
                title: 'Review & Go Live',
                desc: 'Structured onboarding data, ready for configuration or handoff.',
                icon: History,
              },
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="bg-white rounded-2xl p-6 h-full border border-gray-100 shadow-sm">
                  <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold mb-4">
                    {step.num}
                  </div>
                  <step.icon className="w-8 h-8 text-indigo-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 text-lg mb-2">{step.title}</h3>
                  <p className="text-gray-600 text-sm">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonial / Quote */}
      <div className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Quote className="w-12 h-12 text-indigo-200 mx-auto mb-6" />
          <blockquote className="text-2xl sm:text-3xl font-medium text-gray-900 leading-relaxed">
            "We used to block two hours per new customer just for onboarding.
            Now we send a phone number and{' '}
            <span className="text-indigo-600">it runs itself</span>."
          </blockquote>
          <div className="mt-8">
            <div className="font-semibold text-gray-900">Operations Lead</div>
            <div className="text-gray-500">SaaS Platform Provider</div>
          </div>
        </div>
      </div>

      {/* Use Cases */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold text-gray-900">One platform, every onboarding use case</h3>
            <p className="mt-2 text-gray-600">Template-driven and reusable across industries</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              'SaaS Customer Onboarding',
              'Law Firm Client Intake',
              'Medical Patient Intake',
              'Insurance Policy Capture',
              'Consulting Engagement Scoping',
              'Financial Services KYC',
              'Property Management Tenants',
              '+ Your Industry',
            ].map((useCase) => (
              <div key={useCase} className="flex items-center gap-2 px-5 py-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="font-medium text-gray-700">{useCase}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Security & Trust */}
      <div className="py-16 bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-gray-400" />
              <div>
                <div className="font-semibold text-gray-900">Secure Access Controls</div>
                <div className="text-sm text-gray-500">Role-based permissions, hashed intake codes</div>
              </div>
            </div>
            <div className="hidden md:block w-px h-12 bg-gray-200" />
            <div className="flex items-center gap-3">
              <History className="w-8 h-8 text-gray-400" />
              <div>
                <div className="font-semibold text-gray-900">Full Audit Trail</div>
                <div className="text-sm text-gray-500">Every answer, every revision, every source</div>
              </div>
            </div>
            <div className="hidden md:block w-px h-12 bg-gray-200" />
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-gray-400" />
              <div>
                <div className="font-semibold text-gray-900">Time Tracking Built In</div>
                <div className="text-sm text-gray-500">Track and bill by intake, section, or person</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 py-24">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Mic className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
            Customer onboarding
            <br />
            should run itself
          </h2>
          <p className="mt-6 text-xl text-indigo-100 max-w-xl mx-auto">
            Cut onboarding time by <span className="font-semibold text-white">80%</span>.
            <br />
            Give your customers a phone number instead of a project manager.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-indigo-600 rounded-xl hover:bg-indigo-50 transition-all font-semibold text-lg shadow-xl"
            >
              Get Started
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <ExpertlyLogo className="w-8 h-8" />
              <div className="flex flex-col">
                <span className="text-lg font-bold text-white leading-tight">Expertly Intake</span>
                <span className="text-xs text-indigo-400 font-medium -mt-0.5">Voice-First Client Onboarding</span>
              </div>
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
