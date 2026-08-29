import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  PauseCircle,
  RefreshCcw,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { analyticsService, PeriodComparison } from "@/services/analytics";

function DashboardSkeleton() {
  return (
    <div
      className="space-y-6 animate-pulse"
      aria-label="جاري تحميل لوحة العمليات"
    >
      <div className="h-16 rounded-xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-32 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 rounded-xl bg-muted" />
        <div className="h-80 rounded-xl bg-muted" />
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  suffix,
  icon: Icon,
  comparison,
  lowerIsBetter = false,
}: {
  title: string;
  value: number;
  suffix?: string;
  icon: typeof FileText;
  comparison: PeriodComparison;
  lowerIsBetter?: boolean;
}) {
  const changed =
    comparison.percentChange !== null && comparison.percentChange !== 0;
  const increasing = (comparison.percentChange || 0) > 0;
  const favourable = changed && (lowerIsBetter ? !increasing : increasing);
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold">
              {value.toLocaleString("ar-SA")}
              {suffix}
            </p>
          </div>
          <span className="rounded-xl bg-primary/10 p-3 text-primary">
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs">
          {!comparison.comparable ? (
            <span className="text-muted-foreground">
              لا توجد بيانات كافية للمقارنة
            </span>
          ) : (
            <span
              className={cn(
                "flex items-center gap-1 font-medium",
                favourable ? "text-green-600" : "text-red-600",
              )}
            >
              {increasing ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownLeft className="h-3.5 w-3.5" />
              )}
              {Math.abs(comparison.percentChange || 0).toLocaleString("ar-SA")}%
              عن الفترة السابقة
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const attentionLinks = [
  {
    key: "emergency",
    label: "طوارئ مفتوحة",
    icon: ShieldAlert,
    href: "/app/requests?maintenanceType=emergency&status=in_progress",
    tone: "text-red-600 bg-red-500/10",
  },
  {
    key: "stopped",
    label: "طلبات متوقفة",
    icon: PauseCircle,
    href: "/app/requests?status=stopped",
    tone: "text-orange-600 bg-orange-500/10",
  },
  {
    key: "aging",
    label: "طلبات بعمر 72+ ساعة",
    icon: Clock3,
    href: "/app/admin/analytics",
    tone: "text-amber-700 bg-amber-500/10",
  },
  {
    key: "overdue",
    label: "مهام وقائية متأخرة",
    icon: AlertTriangle,
    href: "/app/admin/preventive-calendar",
    tone: "text-red-600 bg-red-500/10",
  },
  {
    key: "upcoming",
    label: "مهام تستحق خلال 7 أيام",
    icon: CalendarClock,
    href: "/app/admin/preventive-calendar",
    tone: "text-blue-600 bg-blue-500/10",
  },
  {
    key: "complaints",
    label: "بلاغات غير معالجة",
    icon: AlertCircle,
    href: "/app/complaints",
    tone: "text-purple-600 bg-purple-500/10",
  },
  {
    key: "repeat",
    label: "آلات ذات أعطال متكررة",
    icon: RefreshCcw,
    href: "/app/admin/analytics",
    tone: "text-rose-600 bg-rose-500/10",
  },
] as const;

export default function AdminOperationsDashboard() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-operations-dashboard"],
    queryFn: () => analyticsService.getOperationsDashboard(),
  });

  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) {
    return (
      <Card>
        <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div>
            <h2 className="font-semibold">تعذر تحميل مركز العمليات</h2>
            <p className="text-sm text-muted-foreground">
              يمكن إعادة المحاولة دون التأثير على بقية النظام.
            </p>
          </div>
          <Button onClick={() => refetch()}>إعادة المحاولة</Button>
        </CardContent>
      </Card>
    );
  }

  const attentionValues: Record<
    (typeof attentionLinks)[number]["key"],
    number
  > = {
    emergency: data.emergencyOpen,
    stopped: data.stoppedRequests,
    aging: data.aging.threeDaysOrMore,
    overdue: data.overduePreventive,
    upcoming: data.upcomingPreventive7Days,
    complaints: data.unresolvedComplaints,
    repeat: data.repeatFailureMachines,
  };
  const agingData = [
    { name: "أقل من 4س", value: data.aging.under4Hours, fill: "#22c55e" },
    { name: "4–24س", value: data.aging.fourTo24Hours, fill: "#0099B7" },
    { name: "1–3 أيام", value: data.aging.oneTo3Days, fill: "#f59e0b" },
    { name: "72س+", value: data.aging.threeDaysOrMore, fill: "#ef4444" },
  ];

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            مركز عمليات الصيانة
          </h1>
          <p className="text-sm text-muted-foreground">
            صورة تشغيلية موحدة لآخر 30 يومًا — التوقيت {data.timezone}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCcw
              className={cn("ml-2 h-4 w-4", isFetching && "animate-spin")}
            />
            تحديث
          </Button>
          <Button asChild>
            <Link to="/app/admin/analytics">التحليلات التفصيلية</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          title="إجمالي الطلبات"
          value={data.totalRequests}
          icon={FileText}
          comparison={data.comparisons.totalRequests}
        />
        <KpiCard
          title="الطلبات المفتوحة"
          value={data.openRequests}
          icon={Wrench}
          comparison={data.comparisons.openRequests}
          lowerIsBetter
        />
        <KpiCard
          title="الطارئة المفتوحة"
          value={data.emergencyOpen}
          icon={ShieldAlert}
          comparison={data.comparisons.emergencyRequests}
          lowerIsBetter
        />
        <KpiCard
          title="الطلبات المتوقفة"
          value={data.stoppedRequests}
          icon={PauseCircle}
          comparison={data.comparisons.stoppedRequests}
          lowerIsBetter
        />
        <KpiCard
          title="متوسط زمن إنجاز الطلب"
          value={data.avgCompletionTimeHours}
          suffix=" س"
          icon={Clock3}
          comparison={data.comparisons.avgCompletionTime}
          lowerIsBetter
        />
        <KpiCard
          title="الالتزام بالصيانة الوقائية"
          value={data.preventiveCompliance}
          suffix="%"
          icon={CheckCircle2}
          comparison={data.comparisons.preventiveCompliance}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>يحتاج انتباهك الآن</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {attentionLinks.map((item) => {
            const Icon = item.icon;
            const value = attentionValues[item.key];
            return (
              <Link
                key={item.key}
                to={item.href}
                className="group flex items-center gap-3 rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className={cn("rounded-lg p-2", item.tone)}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-2xl font-bold">
                    {value.toLocaleString("ar-SA")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.label}
                  </span>
                </span>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>اتجاه الطلبات</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {data.trends.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trends}>
                  <defs>
                    <linearGradient id="opsTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#0099B7"
                        stopOpacity={0.35}
                      />
                      <stop offset="95%" stopColor="#0099B7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="الطلبات"
                    stroke="#0099B7"
                    fill="url(#opsTrend)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="emergency"
                    name="الطارئة"
                    stroke="#ef4444"
                    fill="transparent"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                لا توجد بيانات طلبات في الفترة الحالية.
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>التراكم الزمني للطلبات المفتوحة</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {agingData.some((item) => item.value) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={agingData}
                  layout="vertical"
                  margin={{ right: 15, left: 15 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={75} />
                  <Tooltip />
                  <Bar dataKey="value" name="الطلبات" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                لا توجد طلبات مفتوحة.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>أبرز الأعطال المتكررة</CardTitle>
        </CardHeader>
        <CardContent>
          {data.topRecurringFailures.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.topRecurringFailures.map((machine) => (
                <Link
                  to={`/app/admin/machines/${machine.machineId}`}
                  key={machine.machineId}
                  className="rounded-lg border p-4 hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{machine.machineName}</span>
                    <span className="rounded-full bg-red-500/10 px-2 py-1 text-xs font-bold text-red-600">
                      {machine.failureCount} أعطال
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {machine.systemName}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              لا توجد آلات ذات أعطال طارئة متكررة في الفترة الحالية.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
