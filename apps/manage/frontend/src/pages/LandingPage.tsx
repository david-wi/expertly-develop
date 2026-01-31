import { Link } from 'react-router-dom'
import {
  Users,
  Bot,
  Inbox,
  Zap,
  ShieldCheck,
  Workflow,
  ArrowRight,
  Check,
  Layers,
  Sparkles,
  Mail,
  MessageSquare,
  Ticket,
  Brain,
  TrendingUp,
  Bell,
} from 'lucide-react'

const capabilities = [
  {
    name: 'Map Your Processes',
    description: 'Define who does what, when, and how. Capture every workflow, approval chain, and handoff across your entire organization.',
    icon: Workflow,
  },
  {
    name: 'Build Your Bot Army',
    description: 'Gradually delegate steps to specialized bots. SalesBot, MarketingBot, SupportBot — each follows your playbooks and seeks approval when you want.',
    icon: Bot,
  },
  {
    name: 'Unified Task Hub',
    description: 'Every todo from email, Slack, Jira, and more — all in one place, mapped to the projects they belong to. Full context, always.',
    icon: Inbox,
  },
  {
    name: 'Proactive Head Starts',
    description: 'Even for tasks you\'ll do yourself, the system gathers info, drafts content, and pushes work forward before you even start.',
    icon: Zap,
  },
  {
    name: 'Multiply Leadership',
    description: 'Bots seek approval from your leads when needed. Extend their span of control exponentially while maintaining oversight.',
    icon: TrendingUp,
  },
  {
    name: 'Follow-Up Intelligence',
    description: 'Someone hasn\'t replied? The system notices and suggests nudges. Nothing falls through the cracks.',
    icon: Bell,
  },
]

const integrations = [
  { name: 'Email', icon: Mail },
  { name: 'Slack', icon: MessageSquare },
  { name: 'Jira', icon: Ticket },
  { name: 'Teamwork', icon: Ticket },
]

const benefits = [
  'Your AI Chief of Staff',
  'Processes on autopilot',
  'Bots that multiply you',
  'Full context everywhere',
  'Nothing falls through',
  'Scale without chaos',
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
                <Layers className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Expertly Manage</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
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
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-primary-50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
              Your AI-Powered{' '}
              <span className="text-primary-600">Chief of Staff</span>
            </h1>
            <p className="mt-3 text-lg font-medium text-primary-600 italic">
              Map your processes. Build your bot army. Let AI push everything forward.
            </p>
            <p className="mt-6 text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
              Define how your organization works — who does what, when, with what approvals.
              Then watch as bots take over more and more steps, your leaders multiply their reach,
              and every one of your initiatives gets proactively pushed forward.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-lg"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#how-it-works"
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
                  <Sparkles className="w-16 h-16 text-white/80 mx-auto" />
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

      {/* The Vision Section */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Imagine this...
            </h2>
            <p className="mt-6 text-xl text-gray-600 leading-relaxed">
              You have <span className="font-semibold text-gray-900">dozens of initiatives</span> to push forward.
              Emails to follow up on. Approvals waiting. Tasks scattered across tools.
            </p>
            <p className="mt-4 text-xl text-gray-600 leading-relaxed">
              Now imagine a <span className="font-semibold text-primary-600">Chief of Staff</span> who knows every project,
              proactively gathers what you need, drafts responses, reminds you to nudge people,
              and keeps everything moving — <span className="italic">even while you sleep</span>.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <Users className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">For You</h3>
              <p className="text-gray-600">
                Every task you own gets a head start. Context gathered, drafts prepared, next steps suggested.
                Iterate from AI's work or ignore it — but you're never starting from zero.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <Bot className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">For Your Bots</h3>
              <p className="text-gray-600">
                SalesBot handles outreach. MarketingBot manages campaigns. SupportBot triages tickets.
                Each follows your playbooks precisely and escalates when you want.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-6">
                <ShieldCheck className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">For Your Leaders</h3>
              <p className="text-gray-600">
                Your managers approve bot work instead of doing it themselves.
                Their span of control expands exponentially. Quality stays high.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Capabilities Grid */}
      <div id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Everything you need to run on autopilot
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              From process mapping to proactive AI assistance
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {capabilities.map((capability) => (
              <div
                key={capability.name}
                className="bg-gray-50 rounded-xl p-6 hover:bg-gray-100 transition-colors"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <capability.icon className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {capability.name}
                </h3>
                <p className="mt-2 text-gray-600">{capability.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Integrations Section */}
      <div className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Pull work from everywhere
            </h2>
            <p className="mt-2 text-gray-600">
              One unified inbox for all your scattered tasks
            </p>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-8">
            {integrations.map((integration) => (
              <div key={integration.name} className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                <integration.icon className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-700">{integration.name}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
              <span className="font-medium text-gray-500">+ more coming</span>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              From chaos to autopilot
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Four steps to transform how your organization operates
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                1
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Map Your Processes
              </h3>
              <p className="mt-3 text-gray-600">
                Define who does what, when, and how. Capture approval flows and handoffs.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                2
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Build Your Bots
              </h3>
              <p className="mt-3 text-gray-600">
                Gradually delegate steps to specialized bots that follow your playbooks.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                3
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Centralize Everything
              </h3>
              <p className="mt-3 text-gray-600">
                Pull todos from everywhere into one hub, mapped to projects for full context.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                4
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Let AI Push Forward
              </h3>
              <p className="mt-3 text-gray-600">
                Watch as your AI Chief of Staff proactively advances every initiative.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Brain className="w-16 h-16 text-white/80 mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Ready for your AI Chief of Staff?
          </h2>
          <p className="mt-4 text-xl text-primary-100 max-w-2xl mx-auto">
            Stop chasing tasks. Start building an organization that runs itself —
            with you and your leaders in control.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-600 rounded-lg hover:bg-primary-50 transition-colors font-semibold text-lg"
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
