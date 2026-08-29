export const ANALYTICS_TIMEZONE =
  import.meta.env.VITE_ANALYTICS_TIMEZONE || "Asia/Riyadh";

export function formatAnalyticsDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: ANALYTICS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}
