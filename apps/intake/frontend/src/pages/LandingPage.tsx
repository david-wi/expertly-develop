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

const features = [
  {
    icon: Mic,
    title: 'Voice-First Capture',
    description: 'New customers call a dedicated number and talk naturally about their business. The AI agent asks the right follow-ups and maps every answer to your onboarding template.',
  },
  {
    icon: Brain,
    title: 'AI That Understands Context',
    description: 'The agent captures how your customer actually describes their business — their terminology, their edge cases — so your configuration reflects reality, not a sanitized form.',
  },
  {
    icon: Upload,
    title: 'Document & URL Ingestion',
    description: 'Customers can upload contracts, org charts, or policy docs. AI extracts onboarding details and proposes answers — never silently overwrites what the customer already told you.',
  },
  {
    icon: Users,
    title: 'Multi-Person Onboarding',
    description: 'The billing contact starts the call, then hands off to IT for technical details and ops for workflow questions. Everyone contributes across separate calls — the record stays unified.',
  },
  {
    icon: RefreshCw,
    title: 'Living URL Sources',
    description: 'Link to the customer\'s website, service catalog, or policy pages. The system detects changes on refresh and flags what needs updating in your onboarding record.',
  },
  {
    icon: BarChart3,
    title: 'Time & Usage Tracking',
    description: 'See exactly how much time each onboarding takes — by section, by contributor, by call. Track your cost-per-onboarding and identify where customers get stuck.',
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
              Customer Onboarding
              <br />
              <span className="text-indigo-600">Without the Slog</span>
            </h1>
            <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">
              Every subscription and service business has the same problem: before you can
              start serving a new customer, someone has to sit down with them and capture
              their details.
            </p>
            <p className="mt-3 text-xl text-gray-600 max-w-2xl mx-auto">
              Expertly Intake replaces that manual process with a voice-first AI agent your
              customers call directly. Structured onboarding data — without the back-and-forth.
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
              <div className="text-4xl sm:text-5xl font-bold text-white">Voice</div>
              <div className="mt-2 text-gray-400 font-medium">Customers talk, AI captures</div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-bold text-white">Self-serve</div>
              <div className="mt-2 text-gray-400 font-medium">Customers do it themselves</div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-bold text-white">24/7</div>
              <div className="mt-2 text-gray-400 font-medium">Customers onboard on their schedule</div>
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
              Client onboarding is{' '}
              <span className="text-red-500">stuck in the past</span>
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              You signed a new customer. Now someone on your team has to schedule a call,
              walk through a checklist, type up the answers, chase what they missed, and do
              it all again next week for the next customer.
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
                  <span className="text-gray-600">Schedule onboarding calls, block calendars, coordinate across time zones</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                  </span>
                  <span className="text-gray-600">Walk through a checklist and manually type up the answers</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                  </span>
                  <span className="text-gray-600">Chase missing details across follow-up emails and Slack threads</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                  </span>
                  <span className="text-gray-600">Repeat the entire process for every new customer that signs up</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                  </span>
                  <span className="text-gray-600">Hire dedicated onboarding staff as you grow — or watch quality drop</span>
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
                  <span>Send the customer a phone number — they call and talk on their schedule</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-indigo-200" />
                  </span>
                  <span>AI asks the right questions and captures structured onboarding data</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-indigo-200" />
                  </span>
                  <span>Customer can call back anytime — or hand off to a colleague for their part</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-indigo-200" />
                  </span>
                  <span>Upload docs to fill gaps — AI proposes answers, never silently overwrites</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-indigo-200" />
                  </span>
                  <span>Get a structured onboarding record ready for configuration</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Built for the messy reality of client onboarding
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              Not another form builder. A complete system for onboarding new customers
              with structured data capture — across voice, documents, and multiple people.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-900 text-lg mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-4">
            How it works
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16 max-w-2xl mx-auto">
            From signup to configured — across however many people and calls it takes
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: '1',
                title: 'Create an Onboarding',
                desc: 'Pick a template for your service, get a dedicated phone number. Send it to your new customer with their onboarding link.',
                icon: FileText,
              },
              {
                num: '2',
                title: 'Customer Calls In',
                desc: 'They talk naturally about their business. The AI agent asks smart follow-ups, captures structured answers, and handles "I\'ll get back to you on that."',
                icon: Phone,
              },
              {
                num: '3',
                title: 'Multiple People, Multiple Calls',
                desc: 'The main contact starts, then hands off to colleagues for their areas. Upload documents to fill gaps. Everyone contributes on their own time.',
                icon: Users,
              },
              {
                num: '4',
                title: 'Review & Go Live',
                desc: 'Get a structured onboarding summary with every answer sourced and timestamped. Push the data to your configuration workflow.',
                icon: History,
              },
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="bg-gray-50 rounded-2xl p-6 h-full border border-gray-100">
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
      <div className="py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Quote className="w-12 h-12 text-indigo-200 mx-auto mb-6" />
          <blockquote className="text-2xl sm:text-3xl font-medium text-gray-900 leading-relaxed">
            "We used to block two hours per new customer just to walk through an onboarding checklist.
            Now we send them a phone number and the{' '}
            <span className="text-indigo-600">onboarding runs itself</span>.{' '}
            Structured data, every time, without tying up our team."
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
            Give your new customers a phone number instead of a project manager.
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
