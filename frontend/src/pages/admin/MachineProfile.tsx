import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  Clock3,
  Component,
  MapPin,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { DetailSkeleton } from "@/components/shared/AdminSkeletons";
import { Pagination } from "@/components/shared/Pagination";
import { analyticsService } from "@/services/analytics";
import { formatDateTime, formatDuration } from "@/lib/utils";

const RECURRENCE_THRESHOLDS = {
  watch: 2,
  high: 5,
} as const;

function healthLevel(failures: number) {
  if (failures >= RECURRENCE_THRESHOLDS.high)
    return { label: "تكرار مرتفع", className: "bg-red-500/10 text-red-700" };
  if (failures >= RECURRENCE_THRESHOLDS.watch)
    return {
      label: "تحت المراقبة",
      className: "bg-amber-500/10 text-amber-700",
    };
  return { label: "طبيعي", className: "bg-green-500/10 text-green-700" };
}

export default function MachineProfile() {
  const { id = "" } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["machine-profile", id, page],
    queryFn: () => analyticsService.getMachineProfile(id, page),
    enabled: Boolean(id),
  });

  if (isLoading) return <DetailSkeleton />;
  if (isError || !data)
    return (
      <Card>
        <CardContent className="py-12 text-center text-destructive">
          تعذر تحميل ملف الآلة أو أن الآلة غير موجودة.
        </CardContent>
      </Card>
    );

  const level = healthLevel(data.health.failuresLast30Days);
  return (
    <div className="space-y-6 animate-in">
      <Breadcrumbs
        items={[
          { label: "الإدارة" },
          { label: "الآلات", href: "/app/admin/machines" },
          { label: data.machine.name },
        ]}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold sm:text-3xl">
              {data.machine.name}
            </h1>
            <Badge className={level.className}>{level.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {data.machine.system} ·{" "}
            {data.machine.location || "لا يوجد موقع مرتبط"} ·{" "}
            {data.machine.department || "لا يوجد قسم مرتبط"}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={`/app/admin/machines`}>العودة إلى الآلات</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HealthCard
          title="إجمالي أعمال الصيانة"
          value={data.health.totalMaintenance}
          icon={Wrench}
        />
        <HealthCard
          title="الصيانة الطارئة"
          value={data.health.emergencyMaintenance}
          icon={AlertTriangle}
          tone="text-red-600"
        />
        <HealthCard
          title="الصيانة الوقائية"
          value={data.health.preventiveMaintenance}
          icon={ShieldCheck}
          tone="text-green-600"
        />
        <HealthCard
          title="متوسط زمن الإنجاز"
          value={formatDuration(data.health.avgCompletionTimeHours, "hours")}
          icon={Clock3}
        />
        <HealthCard
          title="أعطال طارئة / آخر 30 يومًا"
          value={`${data.health.failuresLast30Days} طلب`}
          icon={AlertTriangle}
          tone="text-amber-600"
        />
        <HealthCard
          title="أعطال طارئة / آخر 90 يومًا"
          value={`${data.health.failuresLast90Days} طلب`}
          icon={CalendarClock}
          tone="text-red-600"
        />
        <HealthCard
          title="آخر صيانة"
          value={
            data.health.lastMaintenanceAt
              ? formatDateTime(data.health.lastMaintenanceAt)
              : "لا توجد"
          }
          icon={CalendarClock}
        />
        <HealthCard
          title="عدد المكونات"
          value={data.machine.components.length}
          icon={Component}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>المعلومات الأساسية</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">النظام</p>
            <p className="font-medium">{data.machine.system}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              السياق التشغيلي الأخير
            </p>
            <p className="flex items-center gap-1 font-medium">
              <MapPin className="h-4 w-4" />
              {data.machine.location || "—"} / {data.machine.department || "—"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">الوصف</p>
            <p className="font-medium">
              {data.machine.description || "لا يوجد وصف"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="mb-2 text-xs text-muted-foreground">المكونات</p>
            <div className="flex flex-wrap gap-2">
              {data.machine.components.length ? (
                data.machine.components.map((item) => (
                  <Badge key={item} variant="secondary">
                    {item}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  لا توجد مكونات مسجلة.
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سجل الصيانة</CardTitle>
        </CardHeader>
        <CardContent>
          {data.timeline.length ? (
            <div className="space-y-3">
              {data.timeline.map((item) => (
                <Link
                  key={item.id}
                  to={`/app/requests/${item.id}`}
                  className="block rounded-xl border p-4 transition hover:-translate-y-0.5 hover:bg-muted/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{item.requestCode}</span>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        {item.maintenanceType === "emergency"
                          ? "طارئة"
                          : "وقائية"}
                      </Badge>
                      <Badge variant="secondary">
                        {item.status === "completed"
                          ? "مكتملة"
                          : item.status === "stopped"
                            ? "متوقفة"
                            : "قيد التنفيذ"}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.reasonSummary}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDateTime(item.openedAt)} ·{" "}
                    {item.engineerName || "غير معيّن"}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Wrench className="mx-auto mb-3 h-9 w-9 opacity-40" />
              لا يوجد سجل صيانة لهذه الآلة.
            </div>
          )}
          {data.timelineMeta.totalPages > 1 && (
            <div className="mt-5">
              <Pagination
                currentPage={page}
                totalPages={data.timelineMeta.totalPages}
                onPageChange={setPage}
                showInfo
                total={data.timelineMeta.total}
                limit={data.timelineMeta.limit}
                itemLabel="سجل"
              />
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        مستوى التكرار بصري ومحسوب فقط: طبيعي أقل من{" "}
        {RECURRENCE_THRESHOLDS.watch}، مراقبة من {RECURRENCE_THRESHOLDS.watch}،
        مرتفع من {RECURRENCE_THRESHOLDS.high} أعطال طارئة خلال 30 يومًا. التوقيت{" "}
        {data.timezone}.
      </p>
    </div>
  );
}

function HealthCard({
  title,
  value,
  icon: Icon,
  tone = "text-primary",
}: {
  title: string;
  value: string | number;
  icon: typeof Wrench;
  tone?: string;
}) {
  return (
    <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex items-center gap-3 p-4">
        <span className={`rounded-lg bg-muted p-2 ${tone}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="truncate text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
