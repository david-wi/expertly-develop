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
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-white" />
              </div>
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
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-white" />
              </div>
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
