const DEFAULT_REPORT_TIME_ZONE = "Asia/Riyadh";

export function getReportTimeZone(): string {
  return (
    process.env.REPORTS_TIMEZONE ||
    process.env.ANALYTICS_TIMEZONE ||
    DEFAULT_REPORT_TIME_ZONE
  );
}

export function formatReportDateTime(
  value: Date | string | null | undefined,
): string {
  if (!value) return "غير متوفر";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "غير متوفر";
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    timeZone: getReportTimeZone(),
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatReportDate(
  value: Date | string | null | undefined,
): string {
  if (!value) return "غير متوفر";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "غير متوفر";
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    timeZone: getReportTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
