import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock3,
  ExternalLink,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { formatAnalyticsDate } from "@/lib/analytics-time";
import { analyticsService, PreventiveCalendarItem } from "@/services/analytics";
import { TaskStatus } from "@/types";

type ViewMode = "month" | "week";
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

const statusConfig = {
  [TaskStatus.PENDING]: {
    label: "معلقة",
    icon: CircleDashed,
    className:
      "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  [TaskStatus.COMPLETED]: {
    label: "مكتملة",
    icon: CheckCircle2,
    className:
      "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
  },
  [TaskStatus.OVERDUE]: {
    label: "متأخرة",
    icon: AlertTriangle,
    className: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  [TaskStatus.CANCELLED]: {
    label: "ملغاة",
    icon: XCircle,
    className:
      "border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-300",
  },
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthRange(anchor: Date) {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  return { fromDate: isoDate(first), toDate: isoDate(last) };
}

function weekRange(anchor: Date) {
  const start = new Date(anchor);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(start.getTime() + 6 * DAY_MS);
  return { fromDate: isoDate(start), toDate: isoDate(end) };
}

function StatusPill({ status }: { status: TaskStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium",
        config.className,
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

export default function PreventiveCalendar() {
  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(
    () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`),
  );
  const [selected, setSelected] = useState<PreventiveCalendarItem | null>(null);
  const range = view === "month" ? monthRange(anchor) : weekRange(anchor);
  const {
    data: tasks = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["preventive-calendar", range],
    queryFn: () => analyticsService.getPreventiveCalendar(range),
  });
  const { data: summary } = useQuery({
    queryKey: ["preventive-summary", range],
    queryFn: () => analyticsService.getPreventiveSummary(range),
  });

  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, PreventiveCalendarItem[]>();
    for (const task of tasks) {
      const key = formatAnalyticsDate(new Date(task.date));
      grouped.set(key, [...(grouped.get(key) || []), task]);
    }
    return grouped;
  }, [tasks]);

  const move = (direction: number) =>
    setAnchor((current) => {
      const next = new Date(current);
      if (view === "month") next.setUTCMonth(next.getUTCMonth() + direction, 1);
      else next.setUTCDate(next.getUTCDate() + direction * 7);
      return next;
    });
  const periodTitle =
    view === "month"
      ? new Intl.DateTimeFormat("ar-SA", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(anchor)
      : `${range.fromDate} — ${range.toDate}`;

  return (
    <div className="space-y-6 animate-in">
      <Breadcrumbs items={[{ label: "تقويم الصيانة الوقائية" }]} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            تقويم الصيانة الوقائية
          </h1>
          <p className="text-sm text-muted-foreground">
            عرض إداري للمهام من دون تغيير دورة عملها
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/admin/scheduled-tasks">
            <ExternalLink className="ml-2 h-4 w-4" />
            إدارة المهام الحالية
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="المستحقة"
          value={summary?.scheduledDue || 0}
          icon={CalendarDays}
        />
        <SummaryCard
          title="المكتملة"
          value={summary?.completed || 0}
          icon={CheckCircle2}
          tone="text-green-600"
        />
        <SummaryCard
          title="المتأخرة"
          value={summary?.overdue || 0}
          icon={AlertTriangle}
          tone="text-red-600"
        />
        <SummaryCard
          title="القادمة خلال 7 أيام"
          value={summary?.upcoming || 0}
          icon={Clock3}
          tone="text-blue-600"
        />
        <SummaryCard
          title="نسبة الالتزام"
          value={`${summary?.compliancePercent || 0}%`}
          icon={CheckCircle2}
          tone="text-primary"
        />
      </div>

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{periodTitle}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              المتأخر محسوب تحليليًا من الموعد؛ هذه القراءة لا تغيّر حالة المهمة
              المخزنة.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-lg border p-1">
              <Button
                size="sm"
                variant={view === "month" ? "default" : "ghost"}
                onClick={() => setView("month")}
              >
                شهر
              </Button>
              <Button
                size="sm"
                variant={view === "week" ? "default" : "ghost"}
                onClick={() => setView("week")}
              >
                أسبوع
              </Button>
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={() => move(1)}
              aria-label="الفترة التالية"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setAnchor(
                  new Date(
                    `${new Date().toISOString().slice(0, 10)}T00:00:00Z`,
                  ),
                )
              }
            >
              اليوم
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => move(-1)}
              aria-label="الفترة السابقة"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid animate-pulse grid-cols-7 gap-2">
              {Array.from({ length: view === "month" ? 35 : 7 }).map(
                (_, index) => (
                  <div key={index} className="h-28 rounded-lg bg-muted" />
                ),
              )}
            </div>
          ) : isError ? (
            <div className="flex min-h-56 items-center justify-center text-destructive">
              تعذر تحميل مهام التقويم.
            </div>
          ) : view === "month" ? (
            <MonthGrid
              anchor={anchor}
              tasksByDate={tasksByDate}
              onSelect={setSelected}
            />
          ) : (
            <WeekGrid
              range={range}
              tasksByDate={tasksByDate}
              onSelect={setSelected}
            />
          )}
        </CardContent>
      </Card>

      {!isLoading && !isError && tasks.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            لا توجد صيانة وقائية مجدولة في الفترة المحددة.
          </CardContent>
        </Card>
      )}

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>{selected?.taskCode}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <StatusPill status={selected.status} />
              <dl className="grid grid-cols-[90px_1fr] gap-2">
                <dt className="text-muted-foreground">التاريخ</dt>
                <dd>
                  {new Date(selected.date).toLocaleDateString("ar-SA", {
                    dateStyle: "full",
                  })}
                </dd>
                <dt className="text-muted-foreground">المهندس</dt>
                <dd>{selected.engineer || "غير معيّن"}</dd>
                <dt className="text-muted-foreground">الموقع</dt>
                <dd>{selected.location}</dd>
                <dt className="text-muted-foreground">القسم</dt>
                <dd>{selected.department}</dd>
                <dt className="text-muted-foreground">النظام</dt>
                <dd>{selected.system}</dd>
                <dt className="text-muted-foreground">الآلة</dt>
                <dd>{selected.machine}</dd>
              </dl>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              إغلاق
            </Button>
            {selected && (
              <Button asChild>
                <Link to={`/app/admin/scheduled-tasks/${selected.id}/edit`}>
                  فتح المهمة الحالية
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  tone = "text-primary",
}: {
  title: string;
  value: string | number;
  icon: typeof CalendarDays;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className={cn("rounded-lg bg-muted p-2", tone)}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthGrid({
  anchor,
  tasksByDate,
  onSelect,
}: {
  anchor: Date;
  tasksByDate: Map<string, PreventiveCalendarItem[]>;
  onSelect: (task: PreventiveCalendarItem) => void;
}) {
  const first = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1),
  );
  const gridStart = new Date(first.getTime() - first.getUTCDay() * DAY_MS);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[780px]">
        <div className="grid grid-cols-7 gap-2">
          {WEEK_DAYS.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 42 }).map((_, index) => {
            const date = new Date(gridStart.getTime() + index * DAY_MS);
            const key = isoDate(date);
            const dayTasks = tasksByDate.get(key) || [];
            const outside = date.getUTCMonth() !== anchor.getUTCMonth();
            return (
              <div
                key={key}
                className={cn(
                  "min-h-28 rounded-lg border p-2",
                  outside && "bg-muted/30 text-muted-foreground",
                )}
              >
                <span className="text-xs font-medium">{date.getUTCDate()}</span>
                <div className="mt-1 space-y-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <TaskButton
                      key={task.id}
                      task={task}
                      onClick={() => onSelect(task)}
                    />
                  ))}
                  {dayTasks.length > 3 && (
                    <p className="text-[10px] text-muted-foreground">
                      +{dayTasks.length - 3} مهام
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekGrid({
  range,
  tasksByDate,
  onSelect,
}: {
  range: { fromDate: string; toDate: string };
  tasksByDate: Map<string, PreventiveCalendarItem[]>;
  onSelect: (task: PreventiveCalendarItem) => void;
}) {
  const start = new Date(`${range.fromDate}T00:00:00Z`);
  return (
    <div className="grid gap-3 lg:grid-cols-7">
      {Array.from({ length: 7 }).map((_, index) => {
        const date = new Date(start.getTime() + index * DAY_MS);
        const key = isoDate(date);
        const dayTasks = tasksByDate.get(key) || [];
        return (
          <div key={key} className="min-h-48 rounded-lg border p-3">
            <div className="border-b pb-2">
              <p className="text-xs text-muted-foreground">
                {WEEK_DAYS[index]}
              </p>
              <p className="font-bold">{date.getUTCDate()}</p>
            </div>
            <div className="mt-2 space-y-2">
              {dayTasks.map((task) => (
                <TaskButton
                  key={task.id}
                  task={task}
                  onClick={() => onSelect(task)}
                />
              ))}
              {dayTasks.length === 0 && (
                <p className="py-6 text-center text-[11px] text-muted-foreground">
                  لا مهام
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskButton({
  task,
  onClick,
}: {
  task: PreventiveCalendarItem;
  onClick: () => void;
}) {
  const config = statusConfig[task.status];
  const Icon = config.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-md border p-2 text-right text-[10px] transition hover:shadow",
        config.className,
      )}
      title={`${task.taskCode} — ${config.label}`}
    >
      <span className="flex items-center gap-1 font-semibold">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{task.title}</span>
      </span>
      <span className="mt-0.5 block truncate opacity-80">
        {config.label} · {task.machine}
      </span>
    </button>
  );
}
