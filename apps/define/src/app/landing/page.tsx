import Link from 'next/link';
import {
  Play,
  FileText,
  Users,
  GitBranch,
  ArrowRight,
  Check,
  Package,
  Sparkles,
  Shield,
} from 'lucide-react';

const features = [
  {
    name: 'Product Management',
    description: 'Organize requirements by product with clear hierarchies. Keep everything structured and easy to navigate.',
    icon: Package,
  },
  {
    name: 'Requirements Tracking',
    description: 'Track requirements from draft to verified status. See which ones need attention at a glance.',
    icon: FileText,
  },
  {
    name: 'Release Planning',
    description: 'Create release snapshots to track what requirements are included in each version.',
    icon: Shield,
  },
  {
    name: 'AI Assistance',
    description: 'Use AI to parse and structure requirements from natural language descriptions. Save hours of manual work.',
    icon: Sparkles,
  },
  {
    name: 'Version Control',
    description: 'Every change is tracked. Review the complete history of how requirements evolved over time.',
    icon: GitBranch,
  },
  {
    name: 'Team Collaboration',
    description: 'Work together seamlessly with role-based access. Keep stakeholders informed and aligned.',
    icon: Users,
  },
];

const benefits = [
  'Keep requirements organized',
  'Track changes over time',
  'AI-powered parsing',
  'Release planning',
  'Jira integration',
  'Faster time to market',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Play className="w-4 h-4 text-white fill-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Expertly Define</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/"
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
              Requirements Management,{' '}
              <span className="text-primary-600">Powered by AI</span>
            </h1>
            <p className="mt-6 text-xl text-gray-600 leading-relaxed">
              Keep product requirements, code, tests, and delivery work connected over time.
              Stop losing track of what needs to be built and why.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/"
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
                  <FileText className="w-16 h-16 text-white/80 mx-auto" />
                  <p className="mt-4 text-white/60 text-sm">Product Demo</p>
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
              Everything you need for requirements management
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Powerful features that keep your team aligned from idea to delivery.
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
              Three steps to organized requirements
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Getting started is simple. Here is how it works.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                1
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Create Your Product
              </h3>
              <p className="mt-3 text-gray-600">
                Set up your product workspace. Define the scope and invite your team members.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                2
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Add Requirements
              </h3>
              <p className="mt-3 text-gray-600">
                Use AI to parse requirements from documents or add them manually with rich details.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                3
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Track and Ship
              </h3>
              <p className="mt-3 text-gray-600">
                Monitor progress, create release snapshots, and sync with Jira when ready.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">
            Ready to streamline your requirements?
          </h2>
          <p className="mt-4 text-lg text-primary-100">
            Join teams who ship faster with organized, traceable requirements.
          </p>
          <Link
            href="/"
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
                <Play className="w-4 h-4 text-white fill-white" />
              </div>
              <span className="text-lg font-bold text-white">Expertly Define</span>
            </div>
            <p className="text-gray-400 text-sm">
              Part of the Expertly suite of products.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
