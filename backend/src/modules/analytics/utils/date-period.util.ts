export interface AnalyticsPeriod {
  from: Date;
  toExclusive: Date;
  previousFrom: Date;
  previousToExclusive: Date;
  comparisonMode: "previous_equal_period" | "previous_month_to_date" | "previous_year_to_date";
}

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function zonedParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return parts as unknown as DateParts;
}

function zonedDateTimeToUtc(parts: DateParts, timeZone: string): Date {
  const targetAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let guess = targetAsUtc;

  // Two passes also handle IANA zones that observe daylight-saving changes.
  for (let pass = 0; pass < 2; pass += 1) {
    const actual = zonedParts(new Date(guess), timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    guess += targetAsUtc - actualAsUtc;
  }

  return new Date(guess);
}

function dateOnlyParts(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: 0,
    minute: 0,
    second: 0,
  };
}

export function startOfZonedDay(date: Date, timeZone: string): Date {
  const parts = zonedParts(date, timeZone);
  return zonedDateTimeToUtc(
    { ...parts, hour: 0, minute: 0, second: 0 },
    timeZone,
  );
}

export function addZonedDays(date: Date, days: number, timeZone: string): Date {
  const parts = zonedParts(date, timeZone);
  const shifted = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days),
  );
  return zonedDateTimeToUtc(
    {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
    },
    timeZone,
  );
}

function parseBoundary(
  value: string,
  timeZone: string,
  endExclusive: boolean,
): Date {
  const dateParts = dateOnlyParts(value);
  if (dateParts) {
    const start = zonedDateTimeToUtc(dateParts, timeZone);
    return endExclusive ? addZonedDays(start, 1, timeZone) : start;
  }
  return new Date(value);
}

function shiftZonedDate(
  date: Date,
  amount: number,
  unit: "month" | "year",
  timeZone: string,
): Date {
  const parts = zonedParts(date, timeZone);
  const targetYear = parts.year + (unit === "year" ? amount : 0);
  const targetMonthIndex = parts.month - 1 + (unit === "month" ? amount : 0);
  const normalized = new Date(Date.UTC(targetYear, targetMonthIndex, 1));
  const year = normalized.getUTCFullYear();
  const month = normalized.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return zonedDateTimeToUtc(
    { ...parts, year, month, day: Math.min(parts.day, lastDay) },
    timeZone,
  );
}

export function resolveAnalyticsPeriod(
  fromDate: string | undefined,
  toDate: string | undefined,
  timeZone: string,
  now = new Date(),
  comparisonPreset: "custom" | "month_to_date" | "year_to_date" = "custom",
): AnalyticsPeriod {
  const tomorrow = addZonedDays(startOfZonedDay(now, timeZone), 1, timeZone);
  const from = fromDate
    ? parseBoundary(fromDate, timeZone, false)
    : addZonedDays(tomorrow, -30, timeZone);
  const toExclusive = toDate ? parseBoundary(toDate, timeZone, true) : tomorrow;
  const duration = Math.max(toExclusive.getTime() - from.getTime(), DAY_MS);

  if (comparisonPreset === "year_to_date") {
    return {
      from,
      toExclusive,
      previousFrom: shiftZonedDate(from, -1, "year", timeZone),
      previousToExclusive: shiftZonedDate(
        toExclusive,
        -1,
        "year",
        timeZone,
      ),
      comparisonMode: "previous_year_to_date",
    };
  }
  if (comparisonPreset === "month_to_date") {
    return {
      from,
      toExclusive,
      previousFrom: shiftZonedDate(from, -1, "month", timeZone),
      previousToExclusive: shiftZonedDate(
        toExclusive,
        -1,
        "month",
        timeZone,
      ),
      comparisonMode: "previous_month_to_date",
    };
  }

  return {
    from,
    toExclusive,
    previousFrom: new Date(from.getTime() - duration),
    previousToExclusive: new Date(from),
    comparisonMode: "previous_equal_period",
  };
}

export function startOfCurrentMonth(timeZone: string, now = new Date()): Date {
  const parts = zonedParts(now, timeZone);
  return zonedDateTimeToUtc(
    {
      year: parts.year,
      month: parts.month,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone,
  );
}
