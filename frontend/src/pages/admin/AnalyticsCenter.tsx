import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { ANALYTICS_TIMEZONE, formatAnalyticsDate } from "@/lib/analytics-time";
import {
  analyticsService,
  AnalyticsFilters,
  RankingPoint,
} from "@/services/analytics";
import {
  departmentsService,
  locationsService,
  machinesService,
  systemsService,
} from "@/services/reference-data";

type Tab = "overview" | "performance" | "aging" | "distributions" | "patterns";
const COLORS = ["#0099B7", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];
const DAY_LABELS = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

function dateInZone(date: Date) {
  return formatAnalyticsDate(date);
}

function presetDates(preset: "month" | "previous" | "30days" | "year") {
  const today = dateInZone(new Date());
  const [year, month] = today.split("-").map(Number);
  if (preset === "month")
    return {
      fromDate: `${year}-${String(month).padStart(2, "0")}-01`,
      toDate: today,
    };
  if (preset === "year") return { fromDate: `${year}-01-01`, toDate: today };
  if (preset === "30days") {
    const from = new Date();
    from.setDate(from.getDate() - 29);
    return { fromDate: dateInZone(from), toDate: today };
  }
  const firstCurrent = new Date(Date.UTC(year, month - 1, 1));
  const lastPrevious = new Date(firstCurrent.getTime() - 24 * 60 * 60 * 1000);
  const previousYear = lastPrevious.getUTCFullYear();
  const previousMonth = lastPrevious.getUTCMonth() + 1;
  return {
    fromDate: `${previousYear}-${String(previousMonth).padStart(2, "0")}-01`,
    toDate: `${previousYear}-${String(previousMonth).padStart(2, "0")}-${String(lastPrevious.getUTCDate()).padStart(2, "0")}`,
  };
}

function SectionSkeleton() {
  return (
    <div className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-28 rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function Metric({
  title,
  value,
  hint,
}: {
  title: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <span title={hint}>
            <Info className="h-4 w-4 text-muted-foreground" />
          </span>
        </div>
        <p className="mt-3 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

const formatChartLabel = (value: string) => {
  if (!value) return "";
  const parts = value
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  const arabic =
    parts.find((part) => /[\u0600-\u06FF]/.test(part)) ?? parts[0] ?? value;

  return arabic.length > 24 ? `${arabic.slice(0, 22)}…` : arabic;
};

function RankingChart({
  title,
  data,
}: {
  title: string;
  data: RankingPoint[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {data.length ? (
          <div dir="ltr" className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  interval={0}
                  tickMargin={8}
                  tick={{ fontSize: 11 }}
                  tickFormatter={formatChartLabel}
                />
                <Tooltip
                  formatter={(value: any) => [value, "الطلبات"]}
                  labelFormatter={(label: any) => label}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    direction: "rtl",
                    textAlign: "right",
                  }}
                />
                <Bar
                  dataKey="count"
                  name="الطلبات"
                  fill="#0099B7"
                  radius={[0, 5, 5, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty text="لا توجد بيانات تصنيف في الفترة المحددة." />
        )}
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-32 items-center justify-center text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export default function AnalyticsCenter() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [filters, setFilters] = useState<AnalyticsFilters>(() => ({
    ...presetDates("30days"),
    machineId: searchParams.get("machineId") || undefined,
  }));
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics-overview", filters],
    queryFn: () =>
      analyticsService.getOverview({ ...filters, period: "daily" }),
  });
  const { data: repeatFailures } = useQuery({
    queryKey: ["repeat-failures", filters],
    queryFn: () =>
      analyticsService.getRepeatFailures({ ...filters, days: 30, limit: 10 }),
  });
  const { data: locations } = useQuery({
    queryKey: ["analytics-locations"],
    queryFn: () => locationsService.getAll(),
  });
  const { data: departments } = useQuery({
    queryKey: ["analytics-departments"],
    queryFn: () => departmentsService.getAll(),
  });
  const { data: systems } = useQuery({
    queryKey: ["analytics-systems"],
    queryFn: () => systemsService.getAll(),
  });
  const { data: machines } = useQuery({
    queryKey: ["analytics-machines"],
    queryFn: () => machinesService.getAll(),
  });

  const updateFilter = (key: keyof AnalyticsFilters, value: string) =>
    setFilters((current) => ({
      ...current,
      [key]: value === "all" || !value ? undefined : value,
    }));
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "overview", label: "نظرة عامة" },
    { key: "performance", label: "الأداء" },
    { key: "aging", label: "التراكم الزمني" },
    { key: "distributions", label: "التوزيعات" },
    { key: "patterns", label: "الأنماط الزمنية" },
  ];

  const heatmap = useMemo(() => {
    const lookup = new Map<string, number>();
    let max = 0;
    for (const point of data?.heatmaps.dayHour.points || []) {
      lookup.set(`${point.dayOfWeek}-${point.hour}`, point.count);
      max = Math.max(max, point.count);
    }
    return { lookup, max };
  }, [data]);

  return (
    <div className="space-y-6 animate-in">
      <Breadcrumbs items={[{ label: "مركز التحليلات" }]} />
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">مركز التحليلات</h1>
        <p className="text-sm text-muted-foreground">
          تحليل تفصيلي قابل للتصفية لعمليات الصيانة
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4" />
            نطاق التحليل
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["month", "هذا الشهر"],
                ["previous", "الشهر السابق"],
                ["30days", "آخر 30 يومًا"],
                ["year", "هذا العام"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant="outline"
                onClick={() =>
                  setFilters((current) => ({ ...current, ...presetDates(key) }))
                }
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <Label htmlFor="analytics-from">من</Label>
              <Input
                id="analytics-from"
                type="date"
                value={filters.fromDate || ""}
                onChange={(event) =>
                  updateFilter("fromDate", event.target.value)
                }
              />
            </div>
            <div>
              <Label htmlFor="analytics-to">إلى</Label>
              <Input
                id="analytics-to"
                type="date"
                value={filters.toDate || ""}
                onChange={(event) => updateFilter("toDate", event.target.value)}
              />
            </div>
            <FilterSelect
              label="الموقع"
              value={filters.locationId}
              items={(locations || []).map((item) => ({
                id: item.id,
                name: item.name,
              }))}
              onChange={(value) => updateFilter("locationId", value)}
            />
            <FilterSelect
              label="القسم"
              value={filters.departmentId}
              items={(departments || []).map((item) => ({
                id: item.id,
                name: item.name,
              }))}
              onChange={(value) => updateFilter("departmentId", value)}
            />
            <FilterSelect
              label="النظام"
              value={filters.systemId}
              items={(systems || []).map((item) => ({
                id: item.id,
                name: item.name,
              }))}
              onChange={(value) => updateFilter("systemId", value)}
            />
            <FilterSelect
              label="الآلة"
              value={filters.machineId}
              items={(machines || []).map((item) => ({
                id: item.id,
                name: item.name,
              }))}
              onChange={(value) => updateFilter("machineId", value)}
            />
          </div>
        </CardContent>
      </Card>

      <div
        className="flex gap-2 overflow-x-auto rounded-xl border bg-card p-2"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "whitespace-nowrap rounded-lg px-4 py-2 text-sm transition",
              activeTab === tab.key
                ? "bg-primary text-primary-foreground shadow"
                : "hover:bg-muted",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SectionSkeleton />
      ) : isError || !data ? (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p>تعذر تحميل بيانات التحليلات.</p>
            <Button onClick={() => refetch()}>إعادة المحاولة</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric
                  title="متوسط زمن إنجاز الطلب"
                  value={`${data.kpis.avgCompletionTimeHours} س`}
                  hint="closedAt - openedAt للطلبات المكتملة"
                />
                <Metric
                  title="أقل زمن إنجاز"
                  value={`${data.kpis.minCompletionTimeHours} س`}
                  hint="أقصر مدة بين فتح الطلب وإغلاقه"
                />
                <Metric
                  title="أعلى زمن إنجاز"
                  value={`${data.kpis.maxCompletionTimeHours} س`}
                  hint="أطول مدة بين فتح الطلب وإغلاقه"
                />
                <Metric
                  title="متوسط عمر الطلب المفتوح"
                  value={`${data.kpis.openRequestAverageAgeHours} س`}
                  hint="الوقت منذ openedAt للطلبات المفتوحة والمتوقفة"
                />
                <Metric
                  title="معدل الإنجاز"
                  value={`${data.kpis.completionRate}%`}
                  hint="المكتمل من إجمالي طلبات الفترة"
                />
                <Metric
                  title="معدل التوقف"
                  value={`${data.kpis.stopRate}%`}
                  hint="المتوقف من إجمالي طلبات الفترة"
                />
                <Metric
                  title="نسبة الطارئ إلى الوقائي"
                  value={data.kpis.emergencyPreventiveRatio ?? "—"}
                  hint="عدد الطوارئ مقسومًا على عدد الطلبات الوقائية"
                />
                <Metric
                  title="الالتزام الوقائي"
                  value={
                    data.kpis.preventiveCompliance === null
                      ? "لا توجد مهام مستحقة"
                      : `${data.kpis.preventiveCompliance}%`
                  }
                  hint="المهام الوقائية المكتملة من المستحقة، مع استبعاد الملغاة"
                />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>الاتجاه العام</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  {data.trends.length ? (
                    <div dir="ltr" className="h-full w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={data.trends}
                          margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                          <YAxis allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              direction: "rtl",
                              textAlign: "right",
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="total"
                            name="الإجمالي"
                            stroke="#0099B7"
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey="completed"
                            name="المكتمل"
                            stroke="#22c55e"
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey="emergency"
                            name="الطارئ"
                            stroke="#ef4444"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <Empty text="لا توجد بيانات اتجاهات للفترة المحددة." />
                  )}
                </CardContent>
              </Card>
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">
                    الأعطال الطارئة المتكررة — آخر 30 يومًا
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {repeatFailures?.machines.length ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {repeatFailures.machines.map((machine) => (
                        <Link
                          key={machine.machineId}
                          to={`/app/admin/machines/${machine.machineId}`}
                          className="rounded-xl border p-4 transition hover:-translate-y-0.5 hover:bg-muted/40"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {machine.machineName}
                            </span>
                            <span className="text-sm font-bold text-red-600">
                              {machine.currentCount}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {machine.systemName}
                          </p>
                          <p className="mt-2 text-xs">
                            الفترة السابقة: {machine.previousCount} · التغير:{" "}
                            {machine.percentChange === null
                              ? "غير قابل للمقارنة"
                              : `${machine.percentChange}%`}
                          </p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Empty text="لا توجد أعطال طارئة متكررة ضمن الفترة المحددة." />
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "performance" && (
            <div className="grid gap-6 xl:grid-cols-2">
              <RankingChart
                title="الطلبات حسب المهندس"
                data={data.rankings.requestsPerEngineer}
              />
              <RankingChart
                title="الطلبات حسب القسم"
                data={data.rankings.requestsPerDepartment}
              />
              <RankingChart
                title="الطلبات حسب الموقع"
                data={data.rankings.requestsPerLocation}
              />
              <RankingChart
                title="الطلبات حسب النظام"
                data={data.rankings.requestsPerSystem}
              />
              <RankingChart
                title="الطلبات حسب الآلة"
                data={data.rankings.requestsPerMachine}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">مؤشرات الوقائي</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Metric
                    title="المستحقة"
                    value={data.preventive.scheduledDue}
                    hint="المهام الواقعة في الفترة باستثناء الملغاة"
                  />
                  <Metric
                    title="المكتملة"
                    value={data.preventive.completed}
                    hint="المهام المكتملة"
                  />
                  <Metric
                    title="المتأخرة"
                    value={data.preventive.overdue}
                    hint="موعدها مضى ولم تكتمل أو تلغَ"
                  />
                  <Metric
                    title="الملغاة"
                    value={data.preventive.cancelled}
                    hint="مستبعدة من معادلة الالتزام"
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "aging" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>توزيع عمر الطلبات المفتوحة</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex h-12 overflow-hidden rounded-xl bg-muted">
                    {(
                      [
                        ["under4Hours", "أقل من 4س", "bg-green-500"],
                        ["fourTo24Hours", "4–24س", "bg-primary"],
                        ["oneTo3Days", "1–3 أيام", "bg-amber-500"],
                        ["threeDaysOrMore", "72س+", "bg-red-500"],
                      ] as const
                    ).map(([key, label, color]) => {
                      const value = data.aging.buckets[key];
                      const width = data.aging.totalOpen
                        ? (value / data.aging.totalOpen) * 100
                        : 0;
                      return width ? (
                        <div
                          key={key}
                          className={cn(
                            "flex items-center justify-center whitespace-nowrap px-2 text-xs font-semibold text-white",
                            color,
                          )}
                          style={{ width: `${width}%` }}
                          title={`${label}: ${value}`}
                        >
                          {value}
                        </div>
                      ) : null;
                    })}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <span>أقل من 4س: {data.aging.buckets.under4Hours}</span>
                    <span>4–24س: {data.aging.buckets.fourTo24Hours}</span>
                    <span>1–3 أيام: {data.aging.buckets.oneTo3Days}</span>
                    <span className="text-red-600">
                      72س+: {data.aging.buckets.threeDaysOrMore}
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>أقدم الطلبات المفتوحة</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {data.aging.oldestOpenRequests.length ? (
                    <table className="data-table min-w-[650px]">
                      <thead>
                        <tr>
                          <th>الطلب</th>
                          <th>العمر</th>
                          <th>الحالة</th>
                          <th>الآلة</th>
                          <th>الموقع</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.aging.oldestOpenRequests.map((request) => (
                          <tr key={request.id}>
                            <td>{request.requestCode}</td>
                            <td
                              className={cn(
                                request.ageHours >= 72 &&
                                  "font-bold text-red-600",
                              )}
                            >
                              {request.ageHours} س
                            </td>
                            <td>
                              {request.status === "stopped"
                                ? "متوقف"
                                : "قيد التنفيذ"}
                            </td>
                            <td>{request.machine}</td>
                            <td>{request.location}</td>
                            <td>
                              <Button asChild size="sm" variant="ghost">
                                <Link to={`/app/requests/${request.id}`}>
                                  فتح
                                  <ArrowLeft className="mr-1 h-3 w-3" />
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <Empty text="لا توجد طلبات مفتوحة في الفترة المحددة." />
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "distributions" && (
            <div className="grid gap-6 xl:grid-cols-2">
              <RankingChart
                title="التوزيع حسب الموقع"
                data={data.rankings.requestsPerLocation}
              />
              <RankingChart
                title="التوزيع حسب النظام"
                data={data.rankings.requestsPerSystem}
              />
              <Card>
                <CardHeader>
                  <CardTitle>تركيب أنواع الصيانة</CardTitle>
                </CardHeader>
                <CardContent className="h-72">
                  <div dir="ltr" className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "طارئة", value: data.kpis.emergencyRequests },
                            {
                              name: "وقائية",
                              value: data.kpis.preventiveRequests,
                            },
                          ]}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={60}
                          outerRadius={95}
                        >
                          {[0, 1].map((index) => (
                            <Cell key={index} fill={COLORS[index]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            direction: "rtl",
                            textAlign: "right",
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>مقارنة الفترة الحالية بالسابقة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(data.comparisons).map(([key, comparison]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <span className="text-sm">
                        {
                          {
                            totalRequests: "إجمالي الطلبات",
                            emergencyRequests: "الطوارئ",
                            avgCompletionTime: "متوسط الإنجاز",
                            preventiveCompliance: "الالتزام الوقائي",
                            repeatFailures: "الأعطال المتكررة",
                          }[key]
                        }
                      </span>
                      <span className="text-sm font-semibold">
                        {comparison.current}{" "}
                        <span className="text-muted-foreground">
                          مقابل {comparison.previous}
                        </span>{" "}
                        {comparison.percentChange === null
                          ? "—"
                          : `${comparison.percentChange > 0 ? "+" : ""}${comparison.percentChange}%`}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "patterns" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>خريطة الطوارئ: اليوم × الساعة</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    اليوم 0 = الأحد، والحساب حسب{" "}
                    {data.heatmaps.dayHour.timezone}
                  </p>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <div className="min-w-[780px]">
                    <div
                      className="mb-1 grid gap-1"
                      style={{
                        gridTemplateColumns:
                          "80px repeat(24, minmax(24px, 1fr))",
                      }}
                    >
                      <span />
                      {Array.from({ length: 24 }).map((_, hour) => (
                        <span
                          key={hour}
                          className="text-center text-[10px] text-muted-foreground"
                        >
                          {hour}
                        </span>
                      ))}
                    </div>
                    {DAY_LABELS.map((day, dayIndex) => (
                      <div
                        key={day}
                        className="mb-1 grid gap-1"
                        style={{
                          gridTemplateColumns:
                            "80px repeat(24, minmax(24px, 1fr))",
                        }}
                      >
                        <span className="flex items-center text-xs">{day}</span>
                        {Array.from({ length: 24 }).map((_, hour) => {
                          const value =
                            heatmap.lookup.get(`${dayIndex}-${hour}`) || 0;
                          const opacity = heatmap.max
                            ? 0.12 + (value / heatmap.max) * 0.88
                            : 0.06;
                          return (
                            <div
                              key={hour}
                              title={`${day}، الساعة ${hour}:00 — ${value} طلب`}
                              className="flex aspect-square items-center justify-center rounded text-[9px]"
                              style={{
                                backgroundColor: `rgb(239 68 68 / ${opacity})`,
                                color: opacity > 0.55 ? "white" : "inherit",
                              }}
                            >
                              {value || ""}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <LocationSystemHeatmap points={data.heatmaps.locationSystem} />
            </div>
          )}
        </>
      )}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        كل الحسابات الزمنية موحدة حسب {data?.timezone || ANALYTICS_TIMEZONE}.
        متوسط الإنجاز يعني الزمن من فتح الطلب إلى إغلاقه.
      </p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value?: string;
  items: Array<{ id: string; name: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value || "all"} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">الكل</SelectItem>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function LocationSystemHeatmap({
  points,
}: {
  points: Array<{
    locationId: string;
    locationName: string;
    systemId: string;
    systemName: string;
    count: number;
  }>;
}) {
  const locations = [
    ...new Map(
      points.map((point) => [point.locationId, point.locationName]),
    ).entries(),
  ];
  const systems = [
    ...new Map(
      points.map((point) => [point.systemId, point.systemName]),
    ).entries(),
  ];
  const lookup = new Map(
    points.map((point) => [
      `${point.locationId}-${point.systemId}`,
      point.count,
    ]),
  );
  const max = Math.max(0, ...points.map((point) => point.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle>خريطة الموقع × النظام</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {points.length ? (
          <table className="min-w-full border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="p-2 text-right">الموقع \ النظام</th>
                {systems.map(([id, name]) => (
                  <th key={id} className="min-w-24 p-2 text-center font-medium">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locations.map(([locationId, locationName]) => (
                <tr key={locationId}>
                  <th className="whitespace-nowrap p-2 text-right font-medium">
                    {locationName}
                  </th>
                  {systems.map(([systemId]) => {
                    const value = lookup.get(`${locationId}-${systemId}`) || 0;
                    const opacity = max ? 0.1 + (value / max) * 0.9 : 0.05;
                    return (
                      <td
                        key={systemId}
                        className="rounded p-3 text-center font-semibold"
                        style={{
                          backgroundColor: `rgb(0 153 183 / ${opacity})`,
                          color: opacity > 0.58 ? "white" : "inherit",
                        }}
                      >
                        {value || "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty text="لا توجد بيانات مواقع وأنظمة للفترة المحددة." />
        )}
      </CardContent>
    </Card>
  );
}
