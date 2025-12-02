import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { statisticsService } from '@/services/statistics';
import { useAuthStore } from '@/store/auth';
import { Role } from '@/types';

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Statistics() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === Role.ADMIN;

  const { data: engineerStats, isLoading: loadingEngineer } = useQuery({
    queryKey: ['stats-by-engineer'],
    queryFn: () => statisticsService.getByEngineer(),
  });

  const { data: locationStats, isLoading: loadingLocation } = useQuery({
    queryKey: ['stats-by-location'],
    queryFn: () => statisticsService.getByLocation(),
    enabled: isAdmin,
  });

  const { data: systemStats, isLoading: loadingSystem } = useQuery({
    queryKey: ['stats-by-system'],
    queryFn: () => statisticsService.getBySystem(),
    enabled: isAdmin,
  });

  const { data: topMachines, isLoading: loadingMachines } = useQuery({
    queryKey: ['top-failing-machines'],
    queryFn: () => statisticsService.getTopFailingMachines({}, 10),
    enabled: isAdmin,
  });

  const { data: trends, isLoading: loadingTrends } = useQuery({
    queryKey: ['stats-trends'],
    queryFn: () => statisticsService.getTrends({ period: 'monthly' }),
    enabled: isAdmin,
  });

  const isLoading = loadingEngineer || loadingLocation || loadingSystem || loadingMachines || loadingTrends;

  if (isLoading) {
    return <PageLoader />;
  }

  const engineerChartData = engineerStats?.map((stat) => ({
    name: stat.engineerName,
    total: stat.totalRequests,
    completed: stat.byStatus.completed,
    pending: stat.byStatus.pendingReview + stat.byStatus.inProgress,
  })) || [];

  const locationChartData = locationStats?.map((stat, index) => ({
    name: stat.locationName,
    value: stat.count,
    color: COLORS[index % COLORS.length],
  })) || [];

  const systemChartData = systemStats?.map((stat, index) => ({
    name: stat.systemName,
    value: stat.count,
    color: COLORS[index % COLORS.length],
  })) || [];

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">الإحصائيات</h2>
        <p className="text-muted-foreground">تحليل تفصيلي لطلبات الصيانة</p>
      </div>

      {/* Engineer Stats */}
      <Card>
        <CardHeader>
          <CardTitle>إحصائيات المهندسين</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={engineerChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="completed" name="مكتمل" stackId="a" fill="#22c55e" />
                <Bar dataKey="pending" name="قيد الإنجاز" stackId="a" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* By Location */}
          <Card>
            <CardHeader>
              <CardTitle>الطلبات حسب الموقع</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={locationChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {locationChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* By System */}
          <Card>
            <CardHeader>
              <CardTitle>الطلبات حسب النظام</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={systemChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {systemChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trends */}
      {isAdmin && trends && trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>الاتجاهات الشهرية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" name="إجمالي" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="completed" name="مكتمل" stroke="#22c55e" strokeWidth={2} />
                  <Line type="monotone" dataKey="emergency" name="طارئ" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Failing Machines */}
      {isAdmin && topMachines && topMachines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>أكثر الآلات تعطلاً</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="data-table">
              <thead>
                <tr>
                  <th>الآلة</th>
                  <th>النظام</th>
                  <th>عدد الأعطال</th>
                </tr>
              </thead>
              <tbody>
                {topMachines.map((machine) => (
                  <tr key={machine.machineId}>
                    <td className="font-medium">{machine.machineName}</td>
                    <td>{machine.systemName}</td>
                    <td>
                      <span className="inline-flex items-center justify-center rounded-full bg-red-100 px-2.5 py-0.5 text-red-800 font-semibold">
                        {machine.failureCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}





