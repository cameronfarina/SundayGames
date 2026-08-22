import { z } from "zod";

const nullableDate = z.iso.datetime().nullable();

export const platformDraftOperationsItemSchema = z.object({
  roomId: z.string().nullable(),
  roomStatus: z.enum(["setup", "countdown", "live", "paused", "ended"]).nullable(),
  readiness: z.enum(["room_ready", "room_not_created"]),
  leagueId: z.string(),
  leagueName: z.string(),
  seasonId: z.string(),
  seasonName: z.string(),
  seasonYear: z.number().int(),
  draftFormat: z.enum(["auction", "snake"]),
  teamCount: z.number().int().nonnegative(),
  startsAt: z.iso.datetime(),
  startedAt: nullableDate,
  endedAt: nullableDate,
});

export const platformDraftScheduleSchema = z.object({
  generatedAt: z.iso.datetime(),
  timezone: z.string(),
  today: z.array(platformDraftOperationsItemSchema),
  upcoming: z.array(platformDraftOperationsItemSchema),
  summary: z.object({
    scheduledToday: z.number().int().nonnegative(),
    scheduledUpcoming: z.number().int().nonnegative(),
    roomsNotCreated: z.number().int().nonnegative(),
    liveNow: z.number().int().nonnegative(),
    peakConcurrentDrafts: z.number().int().nonnegative(),
    estimatedDraftDurationMinutes: z.number().int().positive(),
    peakWindow: z.object({
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
    }).nullable(),
  }),
});

export type PlatformDraftOperationsItem = z.infer<typeof platformDraftOperationsItemSchema>;
export type PlatformDraftSchedule = z.infer<typeof platformDraftScheduleSchema>;
