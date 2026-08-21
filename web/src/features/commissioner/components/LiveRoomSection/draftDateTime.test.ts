import { afterEach, describe, expect, it, vi } from "vitest";
import {
  browserTimeZone,
  dateTimeLocalToIsoInstant,
  isoInstantToDateTimeLocal,
} from "./draftDateTime";

const scheduledAt = "2026-08-30T19:00:00.000Z";

afterEach(() => { vi.unstubAllEnvs(); });

describe.each([
  { localDateTime: "2026-08-30T21:00", timeZone: "Europe/Rome" },
  { localDateTime: "2026-08-30T15:00", timeZone: "America/New_York" },
])("draft date and time in $timeZone", ({ localDateTime, timeZone }) => {
  it("round-trips the scheduled instant in the identified browser time zone", () => {
    vi.stubEnv("TZ", timeZone);

    expect(browserTimeZone()).toBe(timeZone);
    expect(isoInstantToDateTimeLocal(scheduledAt)).toBe(localDateTime);
    expect(dateTimeLocalToIsoInstant(localDateTime)).toBe(scheduledAt);
  });

  it("keeps the original precision when the minute field is unchanged", () => {
    vi.stubEnv("TZ", timeZone);
    const preciseScheduledAt = "2026-08-30T19:00:45.123Z";

    expect(dateTimeLocalToIsoInstant(localDateTime, preciseScheduledAt)).toBe(preciseScheduledAt);
  });
});

describe.each([
  { localDateTime: "2026-03-29T02:30", timeZone: "Europe/Rome" },
  { localDateTime: "2026-03-08T02:30", timeZone: "America/New_York" },
])("skipped draft hour in $timeZone", ({ localDateTime, timeZone }) => {
  it("rejects a local time that does not exist", () => {
    vi.stubEnv("TZ", timeZone);

    expect(() => dateTimeLocalToIsoInstant(localDateTime)).toThrow(
      `That time does not exist in ${timeZone} because the clocks change. Choose another time.`,
    );
  });
});

describe.each([
  {
    firstOccurrence: "2026-10-25T00:30:00.000Z",
    localDateTime: "2026-10-25T02:30",
    originalInstant: "2026-10-25T01:30:00.000Z",
    timeZone: "Europe/Rome",
  },
  {
    firstOccurrence: "2026-11-01T05:30:00.000Z",
    localDateTime: "2026-11-01T01:30",
    originalInstant: "2026-11-01T06:30:00.000Z",
    timeZone: "America/New_York",
  },
])("repeated draft hour in $timeZone", ({ firstOccurrence, localDateTime, originalInstant, timeZone }) => {
  it("keeps the original instant when the local field is unchanged", () => {
    vi.stubEnv("TZ", timeZone);

    expect(dateTimeLocalToIsoInstant(localDateTime, originalInstant)).toBe(originalInstant);
  });

  it("uses the first occurrence for a newly entered ambiguous time", () => {
    vi.stubEnv("TZ", timeZone);

    expect(dateTimeLocalToIsoInstant(localDateTime)).toBe(firstOccurrence);
  });
});
