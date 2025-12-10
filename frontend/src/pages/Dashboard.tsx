import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Wrench,
  TrendingUp,
  Calendar,
  StopCircle,
} from "lucide-react";
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
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/StatCard";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { statisticsService } from "@/services/statistics";
import { useAuthStore } from "@/store/auth";
import { Role } from "@/types";

// KSU Brand Colors palette
const STATUS_COLORS = {
  in_progress: "#0099B7", // KSU Teal - in progress
  completed: "#22c55e", // Green - completed
  stopped: "#f97316", // Orange - stopped
};

const TYPE_COLORS = {
  emergency: "#ef4444", // Red - emergency
  preventive: "#0099B7", // KSU Teal - preventive
};

const TREND_COLORS = [
  "#0099B7",
  "#22c55e",
  "#ef4444",
  "#00B8DB",
  "#f97316",
  "#007A94",
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
  if (percent === 0) return null;

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

// Custom legend component
const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex flex-wrap justify-center gap-3 mt-4">
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

// Custom tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-foreground">{payload[0].name}</p>
        <p className="text-lg font-bold text-primary">{payload[0].value}</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === Role.ADMIN;
  const isConsultant = user?.role === Role.CONSULTANT;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => statisticsService.getDashboard(),
  });

  const { data: trendsData } = useQuery({
    queryKey: ["trends"],
    queryFn: () => statisticsService.getTrends({ period: "monthly" }),
    enabled: isAdmin,
  });

  if (isLoading) {
    return <PageLoader />;
  }

  const statusChartData = [
    {
      name: "قيد التنفيذ",
      value: stats?.inProgress || 0,
      color: STATUS_COLORS.in_progress,
    },
    {
      name: "منتهي",
      value: stats?.completed || 0,
      color: STATUS_COLORS.completed,
    },
    {
      name: "متوقف",
      value: stats?.stopped || 0,
      color: STATUS_COLORS.stopped,
    },
  ];

  const typeChartData = [
    {
      name: "طارئة",
      value: stats?.emergencyRequests || 0,
      color: TYPE_COLORS.emergency,
    },
    {
      name: "وقائية",
      value: stats?.preventiveRequests || 0,
      color: TYPE_COLORS.preventive,
    },
  ];

  // Check if there's any data to show
  const hasStatusData = statusChartData.some((item) => item.value > 0);
  const hasTypeData = typeChartData.some((item) => item.value > 0);
  const trendsPieData =
    trendsData?.map((item, index) => ({
      name: item.period,
      value: item.total,
      color: TREND_COLORS[index % TREND_COLORS.length],
    })) || [];

  return (
    <div className="space-y-4 sm:space-y-6 animate-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          لوحة التحكم
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          نظرة عامة على طلبات الصيانة والإحصائيات
        </p>
      </div>

      {/* Stats Cards - KSU Brand Colors */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="إجمالي الطلبات"
          value={stats?.totalRequests || 0}
          icon={FileText}
          description={`${stats?.todayRequests || 0} طلب اليوم`}
          iconClassName="bg-[#0099B7]/10 text-[#0099B7] dark:bg-[#0099B7]/30 dark:text-[#00B8DB]"
        />
        <StatCard
          title="قيد التنفيذ"
          value={stats?.inProgress || 0}
          icon={Activity}
          iconClassName="bg-[#0099B7]/10 text-[#007A94] dark:bg-[#0099B7]/30 dark:text-[#00B8DB]"
        />
        <StatCard
          title="مكتملة"
          value={stats?.completed || 0}
          icon={CheckCircle2}
          iconClassName="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        />
        <StatCard
          title="متوقفة"
          value={stats?.stopped || 0}
          icon={StopCircle}
          iconClassName="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
        />
      </div>

      {/* Secondary Stats - KSU Brand Colors */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="طلبات طارئة"
          value={stats?.emergencyRequests || 0}
          icon={AlertTriangle}
          iconClassName="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        />
        <StatCard
          title="طلبات وقائية"
          value={stats?.preventiveRequests || 0}
          icon={Wrench}
          iconClassName="bg-[#0099B7]/10 text-[#0099B7] dark:bg-[#0099B7]/30 dark:text-[#00B8DB]"
        />
        <StatCard
          title="هذا الأسبوع"
          value={stats?.thisWeekRequests || 0}
          icon={Calendar}
          iconClassName="bg-[#007A94]/15 text-[#007A94] dark:bg-[#007A94]/25 dark:text-[#00B8DB]"
        />
        <StatCard
          title="متوسط وقت الإنجاز"
          value={`${stats?.avgCompletionTimeHours || 0} س`}
          icon={TrendingUp}
          iconClassName="bg-[#0099B7]/10 text-[#007A94] dark:bg-[#0099B7]/30 dark:text-[#00B8DB]"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Status Distribution */}
        <Card className="dark:border-border/50">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">
              توزيع الطلبات حسب الحالة
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {hasStatusData ? (
              <div className="h-[250px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      labelLine={false}
                      label={renderCustomLabel}
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          className="transition-opacity hover:opacity-80"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend content={<CustomLegend />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] sm:h-[280px] flex items-center justify-center">
                <p className="text-muted-foreground text-sm">
                  لا توجد بيانات للعرض
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Type Distribution */}
        <Card className="dark:border-border/50">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">
              توزيع الطلبات حسب النوع
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {hasTypeData ? (
              <div className="h-[250px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeChartData}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      labelLine={false}
                      label={renderCustomLabel}
                    >
                      {typeChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          className="transition-opacity hover:opacity-80"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend content={<CustomLegend />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] sm:h-[280px] flex items-center justify-center">
                <p className="text-muted-foreground text-sm">
                  لا توجد بيانات للعرض
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trends Chart - Admin/Consultant */}
      {(isAdmin || isConsultant) && trendsPieData.length > 0 && (
        <Card className="dark:border-border/50">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">
              اتجاهات الطلبات الشهرية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] sm:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={trendsPieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    labelLine={false}
                    label={renderCustomLabel}
                  >
                    {trendsPieData.map((entry, index) => (
                      <Cell
                        key={`trend-${index}`}
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
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: number, _name, props: any) => {
                      const item = props?.payload;
                      const emergency = trendsData?.find(
                        (t) => t.period === item?.name
                      )?.emergency;
                      const preventive = trendsData?.find(
                        (t) => t.period === item?.name
                      )?.preventive;
                      return [
                        value,
                        `إجمالي (${emergency ?? 0} طارئة / ${preventive ?? 0} وقائية)`,
                      ];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: 16 }}
                    formatter={(value) => (
                      <span className="text-xs sm:text-sm text-foreground">
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
