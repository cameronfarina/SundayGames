import { describe, expect, it, vi } from "vitest";
import {
  buildPlatformDraftSchedule,
  createDiscordDraftDigestPoster,
  discordDraftDigestPayload,
  platformDraftOperationsConfigFromEnv,
  platformDraftQueryWindow,
  platformDayWindow,
  type PlatformDraftOperationsRecord,
} from "../src/platform/platformDraftOperations.js";

const record = (
  overrides: Partial<PlatformDraftOperationsRecord> = {},
): PlatformDraftOperationsRecord => ({
  draftFormat: "auction",
  endedAt: null,
  leagueId: "league-1",
  leagueName: "Sunday Games",
  roomId: "room-1",
  roomStatus: "setup",
  seasonId: "season-2026",
  seasonName: "2026 season",
  seasonYear: 2026,
  startedAt: null,
  startsAt: new Date("2026-08-22T23:00:00.000Z"),
  teamCount: 12,
  ...overrides,
});

describe("platform draft operations", () => {
  it("uses the configured operational timezone for today's boundary", () => {
    expect(platformDayWindow(
      new Date("2026-08-22T12:00:00.000Z"),
      "America/New_York",
    )).toEqual({
      end: new Date("2026-08-23T04:00:00.000Z"),
      start: new Date("2026-08-22T04:00:00.000Z"),
    });
  });

  it("handles daylight-saving boundaries without assuming a 24-hour day", () => {
    expect(platformDayWindow(
      new Date("2026-11-01T12:00:00.000Z"),
      "America/New_York",
    )).toEqual({
      end: new Date("2026-11-02T05:00:00.000Z"),
      start: new Date("2026-11-01T04:00:00.000Z"),
    });
  });

  it("queries 30 full operational calendar days across daylight-saving changes", () => {
    expect(platformDraftQueryWindow(
      new Date("2026-11-01T12:00:00.000Z"),
      "America/New_York",
    )).toEqual({
      from: new Date("2026-11-01T04:00:00.000Z"),
      to: new Date("2026-12-02T05:00:00.000Z"),
    });
  });

  it("clamps an already-live draft's overlap window to the operational day", () => {
    const schedule = buildPlatformDraftSchedule([record({
      roomStatus: "live",
      startedAt: new Date("2026-08-22T03:30:00.000Z"),
      startsAt: new Date("2026-08-22T03:00:00.000Z"),
    })], {
      now: new Date("2026-08-22T12:00:00.000Z"),
      timezone: "America/New_York",
    });

    expect(schedule.summary.peakWindow).toEqual({
      endsAt: "2026-08-22T12:00:00.000Z",
      startsAt: "2026-08-22T04:00:00.000Z",
    });
  });

  it("never reports a peak below the drafts that are still live", () => {
    const schedule = buildPlatformDraftSchedule([
      record({
        leagueId: "league-early",
        roomStatus: "live",
        seasonId: "season-early",
        startsAt: new Date("2026-08-22T12:00:00.000Z"),
      }),
      record({
        leagueId: "league-late",
        roomStatus: "paused",
        seasonId: "season-late",
        startsAt: new Date("2026-08-22T16:00:00.000Z"),
      }),
    ], {
      now: new Date("2026-08-22T20:00:00.000Z"),
      timezone: "UTC",
    });

    expect(schedule.summary).toMatchObject({ liveNow: 2, peakConcurrentDrafts: 2 });
  });

  it("uses an early live room's actual start in the current overlap", () => {
    const schedule = buildPlatformDraftSchedule([record({
      roomStatus: "live",
      startedAt: new Date("2026-08-22T18:00:00.000Z"),
      startsAt: new Date("2026-08-22T23:00:00.000Z"),
    })], {
      now: new Date("2026-08-22T20:00:00.000Z"),
      timezone: "UTC",
    });

    expect(schedule.summary).toMatchObject({ liveNow: 1, peakConcurrentDrafts: 1 });
    expect(schedule.summary.peakWindow?.startsAt).toBe("2026-08-22T18:00:00.000Z");
  });

  it("counts active carryovers separately from drafts scheduled today", () => {
    const schedule = buildPlatformDraftSchedule([
      record({
        roomStatus: "live",
        startsAt: new Date("2026-08-21T23:00:00.000Z"),
      }),
    ], {
      now: new Date("2026-08-22T12:00:00.000Z"),
      timezone: "UTC",
    });

    expect(schedule.today).toHaveLength(1);
    expect(schedule.summary).toMatchObject({ liveNow: 1, scheduledToday: 0 });
  });

  it("separates today from upcoming and reports overlapping draft windows", () => {
    const now = new Date("2026-08-22T12:00:00.000Z");
    const schedule = buildPlatformDraftSchedule([
      record(),
      record({
        draftFormat: "snake",
        leagueId: "league-2",
        leagueName: "Night Owls",
        roomId: null,
        roomStatus: null,
        seasonId: "season-2",
        startsAt: new Date("2026-08-23T00:00:00.000Z"),
      }),
      record({
        leagueId: "league-3",
        leagueName: "Tomorrow League",
        roomId: "room-3",
        roomStatus: "countdown",
        seasonId: "season-3",
        startsAt: new Date("2026-08-24T00:00:00.000Z"),
      }),
      record({
        leagueId: "league-4",
        leagueName: "Tomorrow League Two",
        roomId: null,
        roomStatus: null,
        seasonId: "season-4",
        startsAt: new Date("2026-08-24T00:30:00.000Z"),
      }),
      record({
        leagueId: "league-5",
        leagueName: "Tomorrow League Three",
        roomId: "room-5",
        seasonId: "season-5",
        startsAt: new Date("2026-08-24T01:00:00.000Z"),
      }),
    ], { now, timezone: "America/New_York" });

    expect(schedule.today).toHaveLength(2);
    expect(schedule.upcoming).toHaveLength(3);
    expect(schedule.today[1]).toMatchObject({
      draftFormat: "snake",
      readiness: "room_not_created",
      roomId: null,
    });
    expect(schedule.summary).toMatchObject({
      liveNow: 0,
      peakConcurrentDrafts: 2,
      roomsNotCreated: 1,
      scheduledToday: 2,
      scheduledUpcoming: 3,
    });
    expect(schedule.summary.peakWindow).toEqual({
      endsAt: "2026-08-23T02:00:00.000Z",
      startsAt: "2026-08-23T00:00:00.000Z",
    });
  });

  it("reads creator IDs and digest settings without deriving access from league roles", () => {
    const triggerToken = "secure-trigger-token-for-draft-ops";
    const config = platformDraftOperationsConfigFromEnv({
      MOCKD_PLATFORM_ADMIN_ACCOUNT_IDS: "account-creator, account-support",
      MOCKD_PLATFORM_DRAFT_DIGEST_TRIGGER_TOKEN: triggerToken,
      MOCKD_PLATFORM_DRAFT_DIGEST_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token",
      MOCKD_PLATFORM_DRAFT_OPERATIONS_TIMEZONE: "America/Chicago",
    });

    expect([...config.administratorAccountIds]).toEqual(["account-creator", "account-support"]);
    expect(config).toMatchObject({
      digestTriggerToken: triggerToken,
      digestWebhookUrl: "https://discord.com/api/webhooks/123/token",
      timezone: "America/Chicago",
    });
  });

  it("rejects a weak scheduled-trigger secret", () => {
    expect(() => platformDraftOperationsConfigFromEnv({
      MOCKD_PLATFORM_DRAFT_DIGEST_TRIGGER_TOKEN: "too-short",
    })).toThrow("at least 32 characters");
  });

  it("requires the digest trigger token and webhook together", () => {
    expect(() => platformDraftOperationsConfigFromEnv({
      MOCKD_PLATFORM_DRAFT_DIGEST_TRIGGER_TOKEN: "x".repeat(32),
    })).toThrow("configured together");
  });

  it("rejects non-Discord and malformed Discord webhook destinations", () => {
    const base = {
      MOCKD_PLATFORM_DRAFT_DIGEST_TRIGGER_TOKEN: "x".repeat(32),
    };
    expect(() => platformDraftOperationsConfigFromEnv({
      ...base,
      MOCKD_PLATFORM_DRAFT_DIGEST_WEBHOOK_URL: "https://127.0.0.1/api/webhooks/123/token",
    })).toThrow("Discord webhook URL");
    expect(() => platformDraftOperationsConfigFromEnv({
      ...base,
      MOCKD_PLATFORM_DRAFT_DIGEST_WEBHOOK_URL: "not a url",
    })).toThrow("Discord webhook URL");
  });

  it("posts Discord-compatible content to the configured webhook", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const post = createDiscordDraftDigestPoster({
      fetcher,
      webhookUrl: "https://discord.com/api/webhooks/123/token",
    });

    await post({ content: "One draft today." });

    expect(fetcher).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        body: JSON.stringify({
          allowed_mentions: { parse: [] },
          content: "One draft today.",
        }),
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("neutralizes mentions and formatting in league names", () => {
    const schedule = buildPlatformDraftSchedule([record({
      leagueName: "@everyone\n**Incident resolved**",
    })], {
      now: new Date("2026-08-22T12:00:00.000Z"),
      timezone: "America/New_York",
    });

    expect(discordDraftDigestPayload(schedule).content).toContain(
      "＠everyone \\*\\*Incident resolved\\*\\*",
    );
  });

  it("rejects a direct non-Discord poster destination", () => {
    expect(() => createDiscordDraftDigestPoster({
      webhookUrl: "https://example.com/api/webhooks/123/token",
    })).toThrow("Discord webhook URL");
  });
});
