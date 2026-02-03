import { Link } from 'react-router-dom'
import {
  Scissors,
  Calendar,
  Users,
  Clock,
  Gift,
  Globe,
  ArrowRight,
  Check,
  BarChart3,
  Sparkles,
} from 'lucide-react'

function ExpertlyLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.8379 24.9606C16.6714 22.9391 17.9566 20.4822 18.571 17.8238L24.2667 20.4657C24.3728 20.4481 24.4733 20.4064 24.5606 20.3436C24.6478 20.2809 24.7194 20.1989 24.7698 20.104C24.8201 20.0091 24.8479 19.9039 24.8509 19.7965C24.8539 19.6892 24.832 19.5826 24.7871 19.485L19.4266 8.14301C19.3632 8.00575 19.2699 7.88442 19.1535 7.78793C19.037 7.69144 18.9004 7.62224 18.7537 7.58542C18.607 7.5486 18.4539 7.54509 18.3057 7.57515C18.1574 7.60521 18.0178 7.66808 17.897 7.75913L7.63363 15.6497C7.10981 16.0196 7.36125 16.9409 7.98285 16.92L14.0452 16.6931C14.0452 16.6931 13.2106 20.2912 8.35301 22.0047L8.27269 22.0326C2.61541 23.4285 -0.000202179 18.7452 -0.000202179 15.7509C-0.00718689 7.22169 7.2006 0.699166 15.1173 0.0570345C17.8181 -0.167956 20.5328 0.274916 23.0218 1.34656C25.5108 2.41821 27.6976 4.08568 29.3891 6.2018C31.0806 8.31791 32.2249 10.8176 32.7209 13.4803C33.2169 16.1429 33.0494 18.8867 32.2332 21.4693C31.4169 24.0519 29.9771 26.3941 28.0407 28.289C26.1043 30.184 23.7309 31.5734 21.13 32.3347C18.5291 33.096 15.7807 33.2058 13.1273 32.6544C10.4738 32.103 7.99705 30.9073 5.91549 29.1728C9.17716 28.7959 12.4772 27.6408 14.8379 24.9606Z" fill="url(#paint0_linear_expertly_salon)"/>
      <defs>
        <linearGradient id="paint0_linear_expertly_salon" x1="32.9998" y1="33" x2="-6.71734" y2="18.8377" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9648FF"/>
          <stop offset="1" stopColor="#2C62F9"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

const features = [
  {
    name: 'Smart Scheduling',
    description: 'Intuitive calendar with drag-and-drop booking. Manage appointments, breaks, and staff availability effortlessly.',
    icon: Calendar,
  },
  {
    name: 'Client Management',
    description: 'Keep detailed client profiles with service history, preferences, and notes. Build lasting relationships.',
    icon: Users,
  },
  {
    name: 'Waitlist Management',
    description: 'Never lose a booking. Automatically fill cancellations from your waitlist and notify clients.',
    icon: Clock,
  },
  {
    name: 'Promotions & Loyalty',
    description: 'Create targeted promotions and loyalty programs. Reward your best clients and drive repeat visits.',
    icon: Gift,
  },
  {
    name: 'Website Builder',
    description: 'Create a beautiful booking website for your salon. Let clients book 24/7 without phone calls.',
    icon: Globe,
  },
  {
    name: 'Reports & Insights',
    description: 'Track revenue, staff performance, and client trends. Make data-driven decisions for your business.',
    icon: BarChart3,
  },
]

const benefits = [
  'Online booking 24/7',
  'Reduce no-shows',
  'Grow client base',
  'Staff management',
  'Automated reminders',
  'Business insights',
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
              <span className="text-xl font-bold text-gray-900">Expertly Salon</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/login"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Sign In
              </Link>
              <Link
                to="/login"
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
              Salon Management,{' '}
              <span className="text-primary-600">Simplified</span>
            </h1>
            <p className="mt-6 text-xl text-gray-600 leading-relaxed">
              Run your salon like a pro. Bookings, clients, staff, and marketing—all
              in one beautiful platform designed for beauty professionals.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-lg"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
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
            <div className="bg-gradient-to-b from-primary-100 to-primary-50 rounded-2xl shadow-xl overflow-hidden border border-primary-200">
              <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 m-4 rounded-lg">
                <div className="text-center">
                  <Scissors className="w-16 h-16 text-white/80 mx-auto" />
                  <p className="mt-4 text-white/60 text-sm">Salon Dashboard</p>
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
              Everything you need to run your salon
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Powerful features designed specifically for beauty professionals.
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
              Get started in three easy steps
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              From signup to fully booked in no time.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                1
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Set Up Your Salon
              </h3>
              <p className="mt-3 text-gray-600">
                Add your services, staff, and business hours. Import existing client data if you have it.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                2
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Launch Online Booking
              </h3>
              <p className="mt-3 text-gray-600">
                Create your booking website and share it with clients. Accept bookings 24/7 automatically.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                3
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Grow Your Business
              </h3>
              <p className="mt-3 text-gray-600">
                Use promotions, loyalty programs, and insights to retain clients and attract new ones.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonial Section */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Built for beauty professionals
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                We understand the unique challenges of running a salon. That's why we built features that actually help.
              </p>
              <ul className="mt-8 space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Reduce No-Shows</p>
                    <p className="text-gray-600">Automated SMS and email reminders keep your chair filled.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Save Time</p>
                    <p className="text-gray-600">Let clients book themselves. Focus on what you do best.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <BarChart3 className="w-3.5 h-3.5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Grow Revenue</p>
                    <p className="text-gray-600">Identify top services, peak times, and growth opportunities.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-8 text-white">
              <div className="text-center">
                <Scissors className="w-12 h-12 mx-auto opacity-80" />
                <p className="mt-4 text-3xl font-bold">50%</p>
                <p className="text-primary-100">Reduction in no-shows</p>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold">24/7</p>
                  <p className="text-sm text-primary-100">Online booking</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">3x</p>
                  <p className="text-sm text-primary-100">More repeat clients</p>
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
            Ready to transform your salon?
          </h2>
          <p className="mt-4 text-lg text-primary-100">
            Join thousands of salons that run their business with Expertly.
          </p>
          <Link
            to="/login"
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
              <span className="text-lg font-bold text-white">Expertly Salon</span>
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
