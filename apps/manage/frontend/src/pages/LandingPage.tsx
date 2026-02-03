import { Link } from 'react-router-dom'
import {
  Users,
  Bot,
  Inbox,
  Zap,
  ShieldCheck,
  Workflow,
  ArrowRight,
  ChevronRight,
  Layers,
  Mail,
  MessageSquare,
  Ticket,
  Brain,
  TrendingUp,
  Bell,
  Sparkles,
  Target,
  Cpu,
  BarChart3,
  Shield,
  Rocket,
} from 'lucide-react'

const capabilities = [
  {
    name: 'Map Your Processes',
    description: 'Define who does what, when, and how. Capture every workflow, approval chain, and handoff across your entire organization.',
    icon: Workflow,
  },
  {
    name: 'Deploy AI Specialists',
    description: 'Gradually delegate steps to specialized AI. Sales, Marketing, Support — each follows your playbooks and seeks approval when needed.',
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
    description: 'AI specialists seek approval from your leads when needed. Extend their span of control exponentially while maintaining oversight.',
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
  { text: 'Mission Control', icon: Target },
  { text: 'Processes on autopilot', icon: Cpu },
  { text: 'AI multiplies your team', icon: Sparkles },
  { text: 'Full context everywhere', icon: BarChart3 },
  { text: 'Nothing falls through', icon: Shield },
  { text: 'Scale without chaos', icon: Rocket },
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
              Mission Control for
              <br />
              <span className="text-primary-600">the Amplified Team</span>
            </h1>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 text-lg">
              <span className="px-4 py-2 bg-gray-900 text-white rounded-full font-semibold">You</span>
              <ChevronRight className="hidden sm:block w-5 h-5 text-gray-400" />
              <span className="px-4 py-2 bg-primary-100 text-primary-700 rounded-full font-semibold">Your inner circle</span>
              <ChevronRight className="hidden sm:block w-5 h-5 text-gray-400" />
              <span className="px-4 py-2 bg-primary-600 text-white rounded-full font-semibold">AI specialists multiplying each one</span>
            </div>
            <p className="mt-6 text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
              Build a leaner, better organization. Work with the talented people you love working with —
              each one amplified by AI specialists who handle the rote work, gather context,
              and push every initiative forward while your team focuses on what actually matters.
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

          {/* Hero Image */}
          <div className="mt-16 relative">
            <div className="bg-gradient-to-b from-primary-100 to-primary-50 rounded-2xl shadow-xl overflow-hidden border border-primary-200">
              <img
                src="/images/bot-office.png"
                alt="A friendly robot office where bots handle tasks like organizing papers, typing, serving coffee, and checking off task boards"
                className="w-full h-auto m-4 rounded-lg"
                style={{ maxWidth: 'calc(100% - 2rem)' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Bar */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
            {benefits.map((benefit) => (
              <div key={benefit.text} className="flex items-center gap-2 text-white/90 hover:text-white transition-colors">
                <benefit.icon className="w-4 h-4 text-primary-400" />
                <span className="text-sm font-medium">{benefit.text}</span>
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
              The future isn't a bigger org. It's a better one.
            </h2>
            <p className="mt-6 text-xl text-gray-600 leading-relaxed">
              Imagine working only with the people you love working with — your <span className="font-semibold text-gray-900">inner circle</span> of
              talented, driven people. Each one focused on the challenging, creative, rewarding parts of their job.
            </p>
            <p className="mt-4 text-xl text-gray-600 leading-relaxed">
              The rote work? <span className="font-semibold text-primary-600">Handled by AI specialists</span>.
              Follow-ups? Automatic. Context-gathering? Done before they start.
              Your superstars stay superstars — <span className="italic">and accomplish more than teams twice their size</span>.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="group bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-200 transition-all duration-300">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Users className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">For You</h3>
              <p className="text-gray-600 leading-relaxed">
                Every task you own gets a head start. Context gathered, drafts prepared, next steps suggested.
                Iterate from AI's work or ignore it — but you're never starting from zero.
              </p>
            </div>

            <div className="group bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-xl hover:border-purple-200 transition-all duration-300">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Bot className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">For Your AI Specialists</h3>
              <p className="text-gray-600 leading-relaxed">
                Sales AI handles outreach. Marketing AI manages campaigns. Support AI triages tickets.
                Each follows your playbooks precisely and escalates when needed.
              </p>
            </div>

            <div className="group bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-xl hover:border-green-200 transition-all duration-300">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <ShieldCheck className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">For Your Leaders</h3>
              <p className="text-gray-600 leading-relaxed">
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

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((capability) => (
              <div
                key={capability.name}
                className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg hover:border-primary-200 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center group-hover:bg-primary-600 group-hover:scale-110 transition-all duration-300">
                  <capability.icon className="w-6 h-6 text-primary-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-gray-900">
                  {capability.name}
                </h3>
                <p className="mt-2 text-gray-600 leading-relaxed">{capability.description}</p>
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
              <span className="font-medium text-gray-500">+ more</span>
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

          <div className="mt-16 relative">
            {/* Connecting line - hidden on mobile */}
            <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-primary-200 via-primary-400 to-primary-200" />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
              <div className="text-center relative">
                <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold shadow-lg shadow-primary-600/30 relative z-10">
                  1
                </div>
                <h3 className="mt-6 text-xl font-semibold text-gray-900">
                  Map Your Processes
                </h3>
                <p className="mt-3 text-gray-600">
                  Define who does what, when, and how. Capture approval flows and handoffs.
                </p>
              </div>
              <div className="text-center relative">
                <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold shadow-lg shadow-primary-600/30 relative z-10">
                  2
                </div>
                <h3 className="mt-6 text-xl font-semibold text-gray-900">
                  Deploy AI Specialists
                </h3>
                <p className="mt-3 text-gray-600">
                  Gradually delegate steps to specialized AI that follows your playbooks.
                </p>
              </div>
              <div className="text-center relative">
                <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold shadow-lg shadow-primary-600/30 relative z-10">
                  3
                </div>
                <h3 className="mt-6 text-xl font-semibold text-gray-900">
                  Unify in Mission Control
                </h3>
                <p className="mt-3 text-gray-600">
                  Pull todos from everywhere into one hub, mapped to projects for full context.
                </p>
              </div>
              <div className="text-center relative">
                <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold shadow-lg shadow-primary-600/30 relative z-10">
                  4
                </div>
                <h3 className="mt-6 text-xl font-semibold text-gray-900">
                  Let AI Push Forward
                </h3>
                <p className="mt-3 text-gray-600">
                  Watch as your AI specialists proactively advance every initiative.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-purple-800 py-24">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-20 h-20 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
            Ready to build your Amplified Team?
          </h2>
          <p className="mt-6 text-xl text-primary-100 max-w-2xl mx-auto leading-relaxed">
            Work with the people you love. Let AI specialists handle the rest.
            <br className="hidden sm:block" />
            Your inner circle, multiplied.
          </p>
          <Link
            to="/"
            className="mt-10 inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-600 rounded-xl hover:bg-primary-50 hover:scale-105 transition-all duration-300 font-semibold text-lg shadow-xl shadow-black/20"
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
