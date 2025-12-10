import { useQuery } from "@tanstack/react-query";
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
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { statisticsService } from "@/services/statistics";
import { useAuthStore } from "@/store/auth";
import { Role } from "@/types";

// KSU Brand Colors palette
const COLORS = [
  "#0099B7", // KSU Teal (Primary)
  "#22c55e", // Green
  "#007A94", // KSU Teal Dark
  "#ef4444", // Red
  "#00B8DB", // KSU Teal Light
  "#f97316", // Orange
];

// Custom label for pie chart - only show percentage inside
const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  if (percent === 0 || percent < 0.05) return null; // Hide labels for very small slices

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-semibold"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// Custom legend component for pie charts
const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex flex-wrap justify-center gap-3 pb-2">
      {payload?.map((entry: any, index: number) => (
        <div key={`legend-${index}`} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs sm:text-sm text-foreground/80">
            {entry.value}:{" "}
            <span className="font-semibold text-foreground">
              {entry.payload?.value || 0}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
};

export default function Statistics() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === Role.ADMIN;

  const { data: engineerStats, isLoading: loadingEngineer } = useQuery({
    queryKey: ["stats-by-engineer"],
    queryFn: () => statisticsService.getByEngineer(),
  });

  const { data: locationStats, isLoading: loadingLocation } = useQuery({
    queryKey: ["stats-by-location"],
    queryFn: () => statisticsService.getByLocation(),
    enabled: isAdmin,
  });

  const { data: systemStats, isLoading: loadingSystem } = useQuery({
    queryKey: ["stats-by-system"],
    queryFn: () => statisticsService.getBySystem(),
    enabled: isAdmin,
  });

  const { data: topMachines, isLoading: loadingMachines } = useQuery({
    queryKey: ["top-failing-machines"],
    queryFn: () => statisticsService.getTopFailingMachines({}, 10),
    enabled: isAdmin,
  });

  const { data: trends, isLoading: loadingTrends } = useQuery({
    queryKey: ["stats-trends"],
    queryFn: () => statisticsService.getTrends({ period: "monthly" }),
    enabled: isAdmin,
  });

  const isLoading =
    loadingEngineer ||
    loadingLocation ||
    loadingSystem ||
    loadingMachines ||
    loadingTrends;

  if (isLoading) {
    return <PageLoader />;
  }

  const engineerChartData =
    engineerStats?.map((stat, index) => ({
      name: stat.engineerName,
      value: stat.totalRequests,
      completed: stat.byStatus.completed,
      pending: stat.byStatus.inProgress,
      color: COLORS[index % COLORS.length],
    })) || [];

  const locationChartData =
    locationStats?.map((stat, index) => ({
      name: stat.locationName,
      value: stat.count,
      color: COLORS[index % COLORS.length],
    })) || [];

  const systemChartData =
    systemStats?.map((stat, index) => ({
      name: stat.systemName,
      value: stat.count,
      color: COLORS[index % COLORS.length],
    })) || [];

  const trendsChartData = trends || [];
  const isFewTrendPoints = trendsChartData.length <= 2;

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
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={engineerChartData}
                  cx="50%"
                  cy="45%"
                  innerRadius={70}
                  outerRadius={120}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  labelLine={false}
                  label={renderCustomLabel}
                >
                  {engineerChartData.map((entry, index) => (
                    <Cell
                      key={`engineer-${index}`}
                      fill={entry.color}
                      className="transition-opacity hover:opacity-80"
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name, props: any) => {
                    const { payload } = props || {};
                    return [
                      value,
                      `إجمالي (${payload?.completed || 0} مكتمل / ${
                        payload?.pending || 0
                      } قيد التنفيذ)`,
                    ];
                  }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: 8, paddingBottom: 0 }}
                  formatter={(value, entry: any) => (
                    <span className="text-xs sm:text-sm text-foreground">
                      {value}: {entry?.payload?.value || 0}
                    </span>
                  )}
                />
              </PieChart>
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
              {locationChartData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={locationChartData}
                        cx="50%"
                        cy="40%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        labelLine={false}
                        label={renderCustomLabel}
                      >
                        {locationChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            className="transition-opacity hover:opacity-80"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend content={<CustomLegend />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">
                    لا توجد بيانات للعرض
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* By System */}
          <Card>
            <CardHeader>
              <CardTitle>الطلبات حسب النظام</CardTitle>
            </CardHeader>
            <CardContent>
              {systemChartData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={systemChartData}
                        cx="50%"
                        cy="40%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        labelLine={false}
                        label={renderCustomLabel}
                      >
                        {systemChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            className="transition-opacity hover:opacity-80"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend content={<CustomLegend />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">
                    لا توجد بيانات للعرض
                  </p>
                </div>
              )}
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
                {isFewTrendPoints ? (
                  <BarChart
                    data={trendsChartData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: 8, paddingBottom: 0 }}
                      formatter={(value) => (
                        <span className="text-xs sm:text-sm text-foreground">
                          {value}
                        </span>
                      )}
                    />
                    <Bar dataKey="total" name="إجمالي" fill="#0099B7" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" name="مكتمل" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="emergency" name="طارئ" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart
                    data={trendsChartData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border/50"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: 8, paddingBottom: 0 }}
                      formatter={(value) => (
                        <span className="text-xs sm:text-sm text-foreground">
                          {value}
                        </span>
                      )}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="إجمالي"
                      stroke="#0099B7"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      name="مكتمل"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="emergency"
                      name="طارئ"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                )}
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
                      <span className="inline-flex items-center justify-center rounded-full bg-[#0099B7]/10 px-2.5 py-0.5 text-[#0099B7] font-semibold">
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
