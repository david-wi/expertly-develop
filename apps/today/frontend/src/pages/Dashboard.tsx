import { useTasks } from '../hooks/useTasks';
import { useUnansweredQuestions } from '../hooks/useQuestions';
import { TaskList } from '../components/dashboard/TaskList';
import { QuestionsList } from '../components/dashboard/QuestionsList';
import { ClaudeWorkingStatus } from '../components/dashboard/ClaudeWorkingStatus';
import { DraftsToReview } from '../components/dashboard/DraftsToReview';
import { WaitingOn } from '../components/dashboard/WaitingOn';
import { ThisWeek } from '../components/dashboard/ThisWeek';
import { MonitorsSummary } from '../components/dashboard/MonitorsSummary';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Link } from 'react-router-dom';

export function Dashboard() {
  // Fetch tasks
  const { data: queuedTasks = [], isLoading: tasksLoading } = useTasks({
    status: 'queued',
    limit: 5,
  });
  const { data: workingTasks = [] } = useTasks({ status: 'working', limit: 1 });
  const { data: blockedTasks = [] } = useTasks({ status: 'blocked', limit: 5 });

  // Fetch questions
  const { data: questions = [], isLoading: questionsLoading } = useUnansweredQuestions(10);

  const claudeWorkingOn = workingTasks[0] || null;

  if (tasksLoading || questionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--theme-text-heading)]">Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back. Here's what's happening today.</p>
        </div>
        <Link to="/tasks/new">
          <Button>New Task</Button>
        </Link>
      </div>

      {/* Main 6-panel grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Panel 1: Claude's Current Work */}
        <div className="lg:col-span-2">
          <ClaudeWorkingStatus task={claudeWorkingOn} />
        </div>

        {/* Panel 2: Quick Stats */}
        <Card title="Quick Stats">
          <div className="grid grid-cols-2 gap-4">
            <StatItem label="Queued" value={queuedTasks.length} color="blue" />
            <StatItem label="Working" value={workingTasks.length} color="primary" />
            <StatItem label="Blocked" value={blockedTasks.length} color="yellow" />
            <StatItem label="Questions" value={questions.length} color="orange" />
          </div>
        </Card>

        {/* Panel 3: Priority Tasks */}
        <TaskList
          tasks={queuedTasks}
          title="Priority Tasks"
          emptyMessage="All clear! No pending tasks."
        />

        {/* Panel 4: Questions for You */}
        <QuestionsList
          questions={questions}
          title="Questions for You"
          emptyMessage="No questions pending."
        />

        {/* Panel 5: This Week */}
        <ThisWeek maxItems={6} />

        {/* Panel 6: Drafts to Review */}
        <DraftsToReview maxItems={4} />

        {/* Panel 7: Waiting On */}
        <WaitingOn maxItems={5} />

        {/* Panel 8: Monitors */}
        <MonitorsSummary />

        {/* Panel 9: Blocked Tasks (if any) */}
        {blockedTasks.length > 0 && (
          <TaskList
            tasks={blockedTasks}
            title="Blocked Tasks"
            emptyMessage="No blocked tasks."
          />
        )}

        {/* Panel 9: Quick Actions */}
        <Card title="Quick Actions">
          <div className="space-y-2">
            <Link to="/tasks/new" className="block">
              <Button variant="secondary" className="w-full justify-start">
                <PlusIcon className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            </Link>
            <Link to="/people/new" className="block">
              <Button variant="secondary" className="w-full justify-start">
                <PersonIcon className="w-4 h-4 mr-2" />
                Add Person
              </Button>
            </Link>
            <Link to="/clients/new" className="block">
              <Button variant="secondary" className="w-full justify-start">
                <BuildingIcon className="w-4 h-4 mr-2" />
                Add Client
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'blue' | 'primary' | 'yellow' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    primary: 'bg-primary-50 text-primary-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    orange: 'bg-orange-50 text-orange-700',
  };

  return (
    <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
