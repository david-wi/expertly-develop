import { Link } from 'react-router-dom'
import {
  Calendar,
  Zap,
  Inbox,
  Bot,
  ShieldCheck,
  Workflow,
  ArrowRight,
  Check,
  Layers,
  Sparkles,
  Mail,
  MessageSquare,
  Ticket,
} from 'lucide-react'

const features = [
  {
    name: 'Scheduled Workflows',
    description: 'Define what needs to happen and when. Daily reports, weekly reviews, monthly audits — all running automatically on your schedule.',
    icon: Calendar,
  },
  {
    name: 'Event-Driven Triggers',
    description: 'React instantly when things happen. New email? Slack message? Jira ticket? Trigger the right workflow automatically.',
    icon: Zap,
  },
  {
    name: 'Unified Inbox',
    description: 'One place for everything. Pull in tasks from email, Slack, Teamwork, Jira, and more. Never miss what matters.',
    icon: Inbox,
  },
  {
    name: 'Bot Execution',
    description: 'Let bots handle the routine work. They follow your playbooks, execute tasks, and escalate when needed.',
    icon: Bot,
  },
  {
    name: 'Human Approval Gates',
    description: 'Stay in control. Review and approve bot actions before they go live. Automation with oversight.',
    icon: ShieldCheck,
  },
  {
    name: 'Playbook Builder',
    description: 'Define exactly how work should be done. Step-by-step procedures that bots and humans follow consistently.',
    icon: Workflow,
  },
]

const integrations = [
  { name: 'Email', icon: Mail },
  { name: 'Slack', icon: MessageSquare },
  { name: 'Jira', icon: Ticket },
  { name: 'Teamwork', icon: Ticket },
]

const benefits = [
  'Run on autopilot',
  'Never miss a deadline',
  'Unified task inbox',
  'Bots do the work',
  'You stay in control',
  'Scale effortlessly',
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
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
              Put Your Organization on{' '}
              <span className="text-primary-600">Autopilot</span>
            </h1>
            <p className="mt-3 text-lg font-medium text-primary-600 italic">
              Scheduled and event-driven workflows that run themselves
            </p>
            <p className="mt-6 text-xl text-gray-600 leading-relaxed">
              Schedule recurring tasks, react to events from email and Slack,
              let bots handle the routine work — while you stay in control as the approver.
              One unified inbox for everything that needs your attention.
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

      {/* Features Section */}
      <div id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Automation that keeps you in control
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Schedule workflows, react to events, and let bots do the heavy lifting — with your approval.
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

      {/* Integrations Section */}
      <div className="py-16 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Connect Your Tools
            </h2>
            <p className="mt-2 text-gray-600">
              Pull tasks from the tools your team already uses
            </p>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-8">
            {integrations.map((integration) => (
              <div key={integration.name} className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <integration.icon className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-700">{integration.name}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <span className="font-medium text-gray-500">+ more coming</span>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Set it up once. Let it run forever.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                1
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Define Your Workflows
              </h3>
              <p className="mt-3 text-gray-600">
                Schedule recurring tasks or set up event triggers. Connect your email, Slack, and project tools. Build playbooks for how work gets done.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                2
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                Bots Execute
              </h3>
              <p className="mt-3 text-gray-600">
                Tasks arrive automatically. Bots pick them up and follow your playbooks. Routine work happens without you lifting a finger.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold">
                3
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                You Approve
              </h3>
              <p className="mt-3 text-gray-600">
                Review bot work in your unified inbox. Approve, adjust, or escalate. Stay in control while automation does the heavy lifting.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">
            Ready to put your organization on autopilot?
          </h2>
          <p className="mt-4 text-lg text-primary-100">
            Join teams who run scheduled workflows, react to events automatically, and let bots handle the routine.
          </p>
          <Link
            to="/"
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
