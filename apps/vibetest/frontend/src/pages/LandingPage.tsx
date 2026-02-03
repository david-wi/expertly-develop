import { Link } from 'react-router-dom'
import {
  FlaskConical,
  FolderKanban,
  Play,
  Settings,
  Zap,
  LayoutDashboard,
  GitBranch,
  ArrowRight,
  Check,
  Target,
  Sparkles,
} from 'lucide-react'

function ExpertlyLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.8379 24.9606C16.6714 22.9391 17.9566 20.4822 18.571 17.8238L24.2667 20.4657C24.3728 20.4481 24.4733 20.4064 24.5606 20.3436C24.6478 20.2809 24.7194 20.1989 24.7698 20.104C24.8201 20.0091 24.8479 19.9039 24.8509 19.7965C24.8539 19.6892 24.832 19.5826 24.7871 19.485L19.4266 8.14301C19.3632 8.00575 19.2699 7.88442 19.1535 7.78793C19.037 7.69144 18.9004 7.62224 18.7537 7.58542C18.607 7.5486 18.4539 7.54509 18.3057 7.57515C18.1574 7.60521 18.0178 7.66808 17.897 7.75913L7.63363 15.6497C7.10981 16.0196 7.36125 16.9409 7.98285 16.92L14.0452 16.6931C14.0452 16.6931 13.2106 20.2912 8.35301 22.0047L8.27269 22.0326C2.61541 23.4285 -0.000202179 18.7452 -0.000202179 15.7509C-0.00718689 7.22169 7.2006 0.699166 15.1173 0.0570345C17.8181 -0.167956 20.5328 0.274916 23.0218 1.34656C25.5108 2.41821 27.6976 4.08568 29.3891 6.2018C31.0806 8.31791 32.2249 10.8176 32.7209 13.4803C33.2169 16.1429 33.0494 18.8867 32.2332 21.4693C31.4169 24.0519 29.9771 26.3941 28.0407 28.289C26.1043 30.184 23.7309 31.5734 21.13 32.3347C18.5291 33.096 15.7807 33.2058 13.1273 32.6544C10.4738 32.103 7.99705 30.9073 5.91549 29.1728C9.17716 28.7959 12.4772 27.6408 14.8379 24.9606Z" fill="url(#paint0_linear_expertly_vibetest)"/>
      <defs>
        <linearGradient id="paint0_linear_expertly_vibetest" x1="32.9998" y1="33" x2="-6.71734" y2="18.8377" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9648FF"/>
          <stop offset="1" stopColor="#2C62F9"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

const features = [
  {
    name: 'Test Projects',
    description: 'Organize your tests into logical projects. Group test suites by application, feature, or team for better management.',
    icon: FolderKanban,
  },
  {
    name: 'Test Runs',
    description: 'Execute comprehensive test runs with detailed reporting. Track pass/fail rates, execution time, and error logs.',
    icon: Play,
  },
  {
    name: 'Environment Setup',
    description: 'Configure test environments with ease. Support for multiple browsers, devices, and custom configurations.',
    icon: Settings,
  },
  {
    name: 'Quick Start',
    description: 'Get up and running in minutes. Pre-built templates and intuitive wizards help you start testing faster.',
    icon: Zap,
  },
  {
    name: 'Dashboard',
    description: 'Real-time visibility into test health. Monitor trends, identify flaky tests, and track quality metrics.',
    icon: LayoutDashboard,
  },
  {
    name: 'CI/CD Integration',
    description: 'Seamless integration with your pipeline. Connect to GitHub, GitLab, Jenkins, and other popular CI/CD tools.',
    icon: GitBranch,
  },
]

const benefits = [
  'Catch bugs before production',
  'Reduce manual testing time',
  'Improve code quality',
  'Faster release cycles',
  'Better test coverage',
  'Confident deployments',
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
              <span className="text-xl font-bold text-gray-900">Expertly VibeTest</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/login"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-primary-50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
              Automated Testing,{' '}
              <span className="text-primary-600">Simplified</span>
            </h1>
            <p className="mt-6 text-xl text-gray-600 leading-relaxed">
              Comprehensive quality assurance for your applications.
              Run tests faster, catch bugs earlier, and ship with confidence.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-lg"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors font-medium text-lg"
              >
                See How It Works
              </a>
            </div>
          </div>

          {/* Hero Image Placeholder */}
          <div className="mt-16 relative">
            <div className="bg-gradient-to-b from-primary-100 to-primary-50 rounded-2xl shadow-xl overflow-hidden border border-primary-200">
              <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 m-4 rounded-lg">
                <div className="text-center">
                  <FlaskConical className="w-16 h-16 text-white/80 mx-auto" />
                  <p className="mt-4 text-white/60 text-sm">Test Execution Dashboard</p>
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
                <Check className="w-5 h-5 text-primary-400" />
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
              Everything you need for quality assurance
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Powerful features that make testing effortless and comprehensive.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.name}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-primary-600" />
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
              Three steps to better testing
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Getting started is simple. Here's how it works.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                1
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Create a Project
              </h3>
              <p className="mt-3 text-gray-600">
                Set up your test project in seconds. Import existing tests or start fresh with our templates.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                2
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Configure Environment
              </h3>
              <p className="mt-3 text-gray-600">
                Define your test environments. Set up browsers, devices, and custom variables.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                3
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Run & Monitor
              </h3>
              <p className="mt-3 text-gray-600">
                Execute tests and watch results in real-time. Get detailed reports and actionable insights.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Why Choose Us Section */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Why teams choose VibeTest
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Built by developers, for developers. We understand the challenges of maintaining test quality at scale.
              </p>
              <ul className="mt-8 space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Target className="w-3.5 h-3.5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Precision Testing</p>
                    <p className="text-gray-600">Pinpoint failures with detailed error traces and screenshots.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">AI-Powered Insights</p>
                    <p className="text-gray-600">Smart analysis identifies flaky tests and suggests improvements.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap className="w-3.5 h-3.5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Blazing Fast</p>
                    <p className="text-gray-600">Parallel execution and smart caching for lightning-fast results.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-8 text-white">
              <div className="text-center">
                <FlaskConical className="w-12 h-12 mx-auto opacity-80" />
                <p className="mt-4 text-3xl font-bold">95%</p>
                <p className="text-primary-100">Faster test execution</p>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold">10x</p>
                  <p className="text-sm text-primary-100">Better coverage</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">50%</p>
                  <p className="text-sm text-primary-100">Fewer bugs in prod</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">
            Ready to transform your testing workflow?
          </h2>
          <p className="mt-4 text-lg text-primary-100">
            Join teams who ship faster and with more confidence.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-white text-primary-600 rounded-lg hover:bg-primary-50 transition-colors font-medium text-lg"
          >
            Start Your Free Trial
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <ExpertlyLogo className="w-8 h-8" />
              <span className="text-lg font-bold text-white">Expertly VibeTest</span>
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
