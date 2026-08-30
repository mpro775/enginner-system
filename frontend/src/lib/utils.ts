import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { RequestStatus, MaintenanceType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type DurationUnit = "milliseconds" | "seconds" | "minutes" | "hours";

const durationUnitInMilliseconds: Record<DurationUnit, number> = {
  milliseconds: 1,
  seconds: 1000,
  minutes: 60_000,
  hours: 3_600_000,
};

/** Shared human-readable duration formatter for Admin Intelligence surfaces. */
export function formatDuration(
  value: number,
  unit: DurationUnit = "milliseconds",
): string {
  if (!Number.isFinite(value)) return "—";

  const diffMs = Math.max(0, value * durationUnitInMilliseconds[unit]);
  const totalSeconds = Math.floor(diffMs / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (totalSeconds < 60) return `${totalSeconds} ثانية`;
  if (totalSeconds < 3600) return `${Math.floor(totalSeconds / 60)} دقائق`;
  if (days > 0)
    return hours > 0 ? `${days} يوم و${hours} ساعة` : `${days} يوم`;
  return minutes > 0 ? `${hours} ساعة و${minutes} دقيقة` : `${hours} ساعة`;
}

export function formatDurationBetween(
  from: string | Date,
  to: string | Date = new Date(),
): string {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "—";
  return formatDuration(Math.max(0, end - start));
}

export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

export function getStatusLabel(status: RequestStatus): string {
  const labels: Record<RequestStatus, string> = {
    [RequestStatus.IN_PROGRESS]: "قيد التنفيذ",
    [RequestStatus.COMPLETED]: "منتهي",
    [RequestStatus.STOPPED]: "متوقف",
  };
  return labels[status] || status;
}

export function getStatusColor(status: RequestStatus): string {
  const colors: Record<RequestStatus, string> = {
    [RequestStatus.IN_PROGRESS]: "bg-blue-100 text-blue-800 border-blue-200",
    [RequestStatus.COMPLETED]: "bg-green-100 text-green-800 border-green-200",
    [RequestStatus.STOPPED]: "bg-orange-100 text-orange-800 border-orange-200",
  };
  return colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
}

export function getMaintenanceTypeLabel(type: MaintenanceType): string {
  const labels: Record<MaintenanceType, string> = {
    [MaintenanceType.EMERGENCY]: "طارئة",
    [MaintenanceType.PREVENTIVE]: "وقائية",
  };
  return labels[type] || type;
}

export function getMaintenanceTypeColor(type: MaintenanceType): string {
  const colors: Record<MaintenanceType, string> = {
    [MaintenanceType.EMERGENCY]: "bg-red-100 text-red-800 border-red-200",
    [MaintenanceType.PREVENTIVE]:
      "bg-purple-100 text-purple-800 border-purple-200",
  };
  return colors[type] || "bg-gray-100 text-gray-800 border-gray-200";
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: "مدير النظام",
    consultant: "استشاري",
    maintenance_manager: "مدير الصيانة",
    engineer: "مهندس",
    maintenance_safety_monitor: "مراقب الصيانة والسلامة",
    project_manager: "مدير المشروع",
  };
  return labels[role] || role;
}
