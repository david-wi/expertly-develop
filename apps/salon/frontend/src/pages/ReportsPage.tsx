import { Card, CardHeader } from '../components/ui';
import { BarChart3, Users, Calendar, DollarSign } from 'lucide-react';

export function ReportsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-warm-800 mb-6">Reports</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Today's Appointments"
          value="12"
          icon={Calendar}
          color="primary"
        />
        <StatCard
          title="Today's Revenue"
          value="$847"
          icon={DollarSign}
          color="accent"
        />
        <StatCard
          title="New Clients (Week)"
          value="8"
          icon={Users}
          color="success"
        />
        <StatCard
          title="Cancellation Rate"
          value="3.2%"
          icon={BarChart3}
          color="warm"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader title="Revenue by Service" subtitle="This month" />
          <div className="h-64 flex items-center justify-center text-warm-400">
            Chart placeholder - Revenue by service
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Staff Utilization" subtitle="This week" />
          <div className="h-64 flex items-center justify-center text-warm-400">
            Chart placeholder - Staff utilization
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Appointments by Day" subtitle="Last 30 days" />
          <div className="h-64 flex items-center justify-center text-warm-400">
            Chart placeholder - Appointments trend
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Top Services" subtitle="This month" />
          <div className="space-y-3">
            {[
              { name: 'Haircut', count: 45, revenue: 2250 },
              { name: 'Color', count: 28, revenue: 3360 },
              { name: 'Highlights', count: 18, revenue: 2700 },
              { name: 'Blowout', count: 32, revenue: 1280 },
            ].map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-warm-800">{service.name}</p>
                  <p className="text-sm text-warm-500">
                    {service.count} appointments
                  </p>
                </div>
                <p className="font-semibold text-accent-600">
                  ${service.revenue}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'primary' | 'accent' | 'success' | 'warm';
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  const colorStyles = {
    primary: 'bg-primary-100 text-primary-600',
    accent: 'bg-accent-100 text-accent-600',
    success: 'bg-success-100 text-success-600',
    warm: 'bg-warm-200 text-warm-600',
  };

  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colorStyles[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm text-warm-500">{title}</p>
          <p className="text-2xl font-bold text-warm-800">{value}</p>
        </div>
      </div>
    </Card>
  );
}
