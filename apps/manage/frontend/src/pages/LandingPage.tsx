import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChevronRight,
  Layers,
  Mail,
  MessageSquare,
  Ticket,
  Brain,
  Check,
  Quote,
  Play,
  Users,
  Bot,
  Sparkles,
} from 'lucide-react'

const integrations = [
  { name: 'Email', icon: Mail },
  { name: 'Slack', icon: MessageSquare },
  { name: 'Jira', icon: Ticket },
  { name: 'Teamwork', icon: Ticket },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Expertly Manage</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/" className="text-gray-600 hover:text-gray-900 font-medium">
                Sign In
              </Link>
              <Link
                to="/"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 lg:pt-24">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-tight">
              Mission Control for
              <br />
              <span className="text-primary-600">the Amplified Team</span>
            </h1>

            {/* Visual tagline */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
              <span className="px-5 py-2.5 bg-gray-900 text-white rounded-full font-semibold text-lg">You</span>
              <ChevronRight className="hidden sm:block w-5 h-5 text-gray-400" />
              <span className="px-5 py-2.5 bg-primary-100 text-primary-700 rounded-full font-semibold text-lg">Your best people</span>
              <ChevronRight className="hidden sm:block w-5 h-5 text-gray-400" />
              <span className="px-5 py-2.5 bg-primary-600 text-white rounded-full font-semibold text-lg">AI multiplying each one</span>
            </div>

            <p className="mt-8 text-xl text-gray-600 max-w-2xl mx-auto">
              Multiply what your best people can achieve—excellently.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all font-semibold text-lg shadow-lg shadow-primary-600/25 hover:shadow-xl hover:shadow-primary-600/30"
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

          {/* Hero Image */}
          <div className="mt-16 relative max-w-5xl mx-auto">
            <div className="bg-gradient-to-b from-primary-100 to-primary-50 rounded-2xl shadow-2xl overflow-hidden border border-primary-200">
              <img
                src="/images/bot-office.png"
                alt="AI specialists and humans working together in mission control"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar - Big Numbers */}
      <div className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl sm:text-5xl font-bold text-white">Multiply</div>
              <div className="mt-2 text-gray-400 font-medium">what your key people achieve</div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-bold text-white">Capture</div>
              <div className="mt-2 text-gray-400 font-medium">every task, nothing slips</div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-bold text-white">24/7</div>
              <div className="mt-2 text-gray-400 font-medium">AI pushing work forward</div>
            </div>
          </div>
        </div>
      </div>

      {/* The Model - Visual Diagram */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              The future isn't more headcount.
              <br />
              <span className="text-primary-600">It's more leverage.</span>
            </h2>
          </div>

          {/* Three Ring Diagram */}
          <div className="relative max-w-4xl mx-auto">
            {/* Outer ring - AI Specialists */}
            <div className="absolute inset-0 rounded-full border-4 border-dashed border-primary-200 opacity-60" />

            {/* The visual representation */}
            <div className="relative py-16">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">

                {/* Left - You */}
                <div className="text-center lg:text-right">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-900 rounded-full mb-4">
                    <Users className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">You</h3>
                  <p className="mt-2 text-gray-600">
                    At the center. In control.<br />
                    Focused on what matters.
                  </p>
                </div>

                {/* Center - Inner Circle */}
                <div className="text-center bg-primary-50 rounded-3xl p-8 border-2 border-primary-200">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-600 rounded-full mb-4">
                    <Sparkles className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">Your Inner Circle</h3>
                  <p className="mt-2 text-gray-600">
                    The talented people you love working with.<br />
                    Each one amplified by AI.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <span className="px-3 py-1 bg-white rounded-full text-sm font-medium text-gray-700">Sales lead</span>
                    <span className="px-3 py-1 bg-white rounded-full text-sm font-medium text-gray-700">Ops manager</span>
                    <span className="px-3 py-1 bg-white rounded-full text-sm font-medium text-gray-700">Creative director</span>
                  </div>
                </div>

                {/* Right - AI Specialists */}
                <div className="text-center lg:text-left">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-600 rounded-full mb-4">
                    <Bot className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">AI Specialists</h3>
                  <p className="mt-2 text-gray-600">
                    Handle repetitive work, chase follow-ups,<br />
                    and keep everything moving.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center lg:justify-start gap-2">
                    <span className="px-3 py-1 bg-purple-100 rounded-full text-sm font-medium text-purple-700">Sales AI</span>
                    <span className="px-3 py-1 bg-purple-100 rounded-full text-sm font-medium text-purple-700">Support AI</span>
                    <span className="px-3 py-1 bg-purple-100 rounded-full text-sm font-medium text-purple-700">Ops AI</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What Changes - Before/After */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-16">
            What changes
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Before */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Without Expertly Manage</div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                  </span>
                  <span className="text-gray-600">Tasks scattered across 10 different tools</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                  </span>
                  <span className="text-gray-600">Constant context switching kills focus</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                  </span>
                  <span className="text-gray-600">Things fall through cracks weekly</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                  </span>
                  <span className="text-gray-600">Need more headcount to scale</span>
                </li>
              </ul>
            </div>

            {/* After */}
            <div className="bg-primary-600 rounded-2xl p-8 text-white">
              <div className="text-sm font-semibold text-primary-200 uppercase tracking-wide mb-4">With Expertly Manage</div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-primary-200" />
                  </span>
                  <span>One unified command center for everything</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-primary-200" />
                  </span>
                  <span>AI gathers context before you even start</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-primary-200" />
                  </span>
                  <span>Automatic follow-ups, nothing forgotten</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1">
                    <Check className="w-5 h-5 text-primary-200" />
                  </span>
                  <span>Scale your impact without scaling headcount</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Social Proof */}
      <div className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Quote className="w-12 h-12 text-primary-200 mx-auto mb-6" />
          <blockquote className="text-2xl sm:text-3xl font-medium text-gray-900 leading-relaxed">
            "We're handling twice the client load we did last year—
            <span className="text-primary-600">same team</span>.
            The AI takes care of all the coordination that used to eat everyone's day."
          </blockquote>
          <div className="mt-8">
            <div className="font-semibold text-gray-900">Operations Lead</div>
            <div className="text-gray-500">Professional Services Firm</div>
          </div>
        </div>
      </div>

      {/* How It Works - Simplified */}
      <div id="how-it-works" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-4">
            How it works
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16 max-w-2xl mx-auto">
            From scattered chaos to smooth autopilot in four steps
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { num: '1', title: 'Map Your Workflows', desc: 'Define who does what, when, and how. Capture approvals, handoffs, and escalation paths.' },
              { num: '2', title: 'Deploy AI Specialists', desc: 'Assign repetitive tasks to AI that follows your playbooks and asks for help when needed.' },
              { num: '3', title: 'Centralize Your Tasks', desc: 'Pull todos from email, Slack, Jira, and more into one hub with full context attached.' },
              { num: '4', title: 'Watch AI Drive Progress', desc: 'AI drafts responses, chases follow-ups, and advances work—even while you sleep.' },
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="bg-white rounded-2xl p-6 h-full border border-gray-100 shadow-sm">
                  <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold mb-4">
                    {step.num}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-lg mb-2">{step.title}</h3>
                  <p className="text-gray-600 text-sm">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h3 className="text-lg font-semibold text-gray-900">Pulls work from everywhere</h3>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {integrations.map((integration) => (
              <div key={integration.name} className="flex items-center gap-2 px-5 py-3 bg-gray-50 rounded-xl">
                <integration.icon className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-700">{integration.name}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 px-5 py-3 bg-gray-50 rounded-xl">
              <span className="font-medium text-gray-500">+ more</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div id="demo" className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-purple-800 py-24">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
            Ready to amplify your team?
          </h2>
          <p className="mt-6 text-xl text-primary-100 max-w-xl mx-auto">
            Give your team superpowers. Let AI handle the busywork.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary-600 rounded-xl hover:bg-primary-50 transition-all font-semibold text-lg shadow-xl"
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
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">Expertly Manage</span>
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
