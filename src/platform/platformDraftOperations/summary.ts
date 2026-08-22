import type {
  PlatformDraftOperationsItem,
  PlatformDraftOperationsRecord,
  PlatformDraftSchedule,
} from "./contracts.js";
import {
  assertOperationalTimezone,
  platformDayStartAfter,
  platformDayWindow,
} from "./timezone.js";

const defaultEstimatedDraftDurationMinutes = 180;
const upcomingDays = 30;
const activeStatuses = new Set(["live", "paused"]);

const itemFor = (record: PlatformDraftOperationsRecord): PlatformDraftOperationsItem => ({
  ...record,
  readiness: record.roomId === null ? "room_not_created" : "room_ready",
  startsAt: record.startsAt.toISOString(),
  startedAt: record.startedAt?.toISOString() ?? null,
  endedAt: record.endedAt?.toISOString() ?? null,
});

const peakWindowFor = (
  records: readonly PlatformDraftOperationsRecord[],
  durationMinutes: number,
  dayStart: Date,
  dayEnd: Date,
  now: Date,
): { count: number; window: { startsAt: string; endsAt: string } | null } => {
  const changes = new Map<number, number>();
  for (const record of records) {
    const isActive = activeStatuses.has(record.roomStatus ?? "");
    const actualStart = isActive && record.startedAt !== null
      ? record.startedAt.getTime()
      : record.startsAt.getTime();
    const start = Math.max(actualStart, dayStart.getTime());
    const estimatedEnd = actualStart + durationMinutes * 60_000;
    const activeEnd = isActive
      ? Math.max(estimatedEnd, now.getTime())
      : estimatedEnd;
    const end = Math.min(
      dayEnd.getTime(),
      Math.max(actualStart, record.endedAt?.getTime() ?? activeEnd),
    );
    if (end <= start) continue;
    changes.set(start, (changes.get(start) ?? 0) + 1);
    changes.set(end, (changes.get(end) ?? 0) - 1);
  }
  const times = [...changes.keys()].sort((left, right) => left - right);
  let active = 0;
  let peak = 0;
  let peakStart: number | undefined;
  let peakEnd: number | undefined;
  for (const time of times) {
    active += changes.get(time) ?? 0;
    if (active > peak) {
      peak = active;
      peakStart = time;
      peakEnd = undefined;
    } else if (peakStart !== undefined && peakEnd === undefined && active < peak) {
      peakEnd = time;
    }
  }
  return {
    count: peak,
    window: peakStart === undefined || peakEnd === undefined ? null : {
      startsAt: new Date(peakStart).toISOString(),
      endsAt: new Date(peakEnd).toISOString(),
    },
  };
};

export interface BuildPlatformDraftScheduleOptions {
  now: Date;
  timezone: string;
  estimatedDraftDurationMinutes?: number | undefined;
}

export const buildPlatformDraftSchedule = (
  records: readonly PlatformDraftOperationsRecord[],
  options: BuildPlatformDraftScheduleOptions,
): PlatformDraftSchedule => {
  assertOperationalTimezone(options.timezone);
  const { start, end } = platformDayWindow(options.now, options.timezone);
  const durationMinutes = options.estimatedDraftDurationMinutes
    ?? defaultEstimatedDraftDurationMinutes;
  const ordered = [...records].sort((left, right) =>
    left.startsAt.getTime() - right.startsAt.getTime()
      || left.leagueName.localeCompare(right.leagueName));
  const scheduledTodayRecords = ordered.filter(record =>
    record.startsAt >= start && record.startsAt < end);
  const todayRecords = ordered.filter(record =>
    scheduledTodayRecords.includes(record) || activeStatuses.has(record.roomStatus ?? ""));
  const todayIds = new Set(todayRecords.map(record => record.seasonId));
  const upcomingRecords = ordered.filter(record =>
    record.startsAt >= end
      && !todayIds.has(record.seasonId)
      && !activeStatuses.has(record.roomStatus ?? "")
      && record.roomStatus !== "ended");
  const peak = peakWindowFor(todayRecords, durationMinutes, start, end, options.now);
  return {
    generatedAt: options.now.toISOString(),
    timezone: options.timezone,
    today: todayRecords.map(itemFor),
    upcoming: upcomingRecords.map(itemFor),
    summary: {
      scheduledToday: scheduledTodayRecords.length,
      scheduledUpcoming: upcomingRecords.length,
      roomsNotCreated: scheduledTodayRecords.filter(record => record.roomId === null).length,
      liveNow: ordered.filter(record => activeStatuses.has(record.roomStatus ?? "")).length,
      peakConcurrentDrafts: peak.count,
      estimatedDraftDurationMinutes: durationMinutes,
      peakWindow: peak.window,
    },
  };
};

export const platformDraftQueryWindow = (now: Date, timezone: string) => {
  const { start } = platformDayWindow(now, timezone);
  return { from: start, to: platformDayStartAfter(now, timezone, upcomingDays + 1) };
};
