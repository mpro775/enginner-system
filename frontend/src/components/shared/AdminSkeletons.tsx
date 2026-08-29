import { cn } from "@/lib/utils";

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

export function KpiCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="جاري تحميل المؤشرات"
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonBlock key={index} className="h-28" />
      ))}
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return <SkeletonBlock className={cn("h-80", className)} />;
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="space-y-2 rounded-xl border p-4"
      aria-label="جاري تحميل الجدول"
    >
      <SkeletonBlock className="h-10" />
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonBlock key={index} className="h-12" />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-label="جاري تحميل التفاصيل">
      <SkeletonBlock className="h-8 w-64" />
      <KpiCardSkeleton count={4} />
      <div className="grid gap-5 lg:grid-cols-3">
        <SkeletonBlock className="h-72 lg:col-span-2" />
        <SkeletonBlock className="h-72" />
      </div>
    </div>
  );
}
