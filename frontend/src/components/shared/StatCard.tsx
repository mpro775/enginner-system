import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  iconClassName?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
  iconClassName,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-4 sm:p-6 transition-all duration-300 hover:shadow-lg dark:border-border/50 dark:hover:shadow-primary/5",
        className
      )}
    >
      <div className="flex items-start sm:items-center justify-between gap-2">
        <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
            {title}
          </p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground truncate">
            {value}
          </p>
          {description && (
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              {description}
            </p>
          )}
          {trend && (
            <p
              className={cn(
                "text-[10px] sm:text-xs font-medium",
                trend.isPositive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div
          className={cn(
            "rounded-lg sm:rounded-full p-2 sm:p-3 flex-shrink-0",
            iconClassName || "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
        </div>
      </div>
    </div>
  );
}
