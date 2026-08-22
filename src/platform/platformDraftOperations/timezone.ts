interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const partsFor = (date: Date, timezone: string): Record<string, number> =>
  Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date)
    .filter(part => part.type !== "literal")
    .map(part => [part.type, Number(part.value)]));

const utcForZonedMidnight = (date: CalendarDate, timezone: string): Date => {
  const target = Date.UTC(date.year, date.month - 1, date.day);
  let instant = target;
  for (let pass = 0; pass < 3; pass += 1) {
    const parts = partsFor(new Date(instant), timezone);
    const represented = Date.UTC(
      parts.year ?? 0,
      (parts.month ?? 1) - 1,
      parts.day ?? 1,
      parts.hour ?? 0,
      parts.minute ?? 0,
      parts.second ?? 0,
    );
    instant += target - represented;
  }
  return new Date(instant);
};

const nextCalendarDate = ({ year, month, day }: CalendarDate): CalendarDate => {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
};

const calendarDateAfter = (
  { year, month, day }: CalendarDate,
  days: number,
): CalendarDate => {
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
};

export const platformDayWindow = (
  now: Date,
  timezone: string,
): { start: Date; end: Date } => {
  const parts = partsFor(now, timezone);
  const calendarDate = {
    year: parts.year ?? 0,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
  };
  return {
    start: utcForZonedMidnight(calendarDate, timezone),
    end: utcForZonedMidnight(nextCalendarDate(calendarDate), timezone),
  };
};

export const platformDayStartAfter = (
  now: Date,
  timezone: string,
  days: number,
): Date => {
  const parts = partsFor(now, timezone);
  return utcForZonedMidnight(calendarDateAfter({
    year: parts.year ?? 0,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
  }, days), timezone);
};

export const assertOperationalTimezone = (timezone: string): void => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
  } catch {
    throw new Error(`Invalid platform draft operations timezone: ${timezone}.`);
  }
};
