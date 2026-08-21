import { afterEach, describe, expect, it, vi } from "vitest";
import { onboardingLeagueSchema } from "../../../../shared/api/onboarding/onboardingSchema";
import { ownerLeague } from "../../test/commissionerFixtures";
import { roomStatusLabel, scheduledLeagues } from "./liveRoomDisplay";

describe("live room display", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("sorts only future drafts the user can manage", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-08-21T12:00:00.000Z");
    const league = (name: string, nextDraftAt: string, canManageLeague = true) =>
      onboardingLeagueSchema.parse({
        ...ownerLeague,
        canManageLeague,
        leagueId: name,
        leagueName: name,
        leagueSlug: name,
        nextDraftAt,
        seasonId: name,
      });

    expect(scheduledLeagues([
      league("Later", "2026-09-02T23:00:00.000Z"),
      league("Member", "2026-08-28T18:00:00.000Z", false),
      league("Past", "2026-08-20T18:00:00.000Z"),
      league("Zulu", "2026-08-29T18:00:00.000Z"),
      league("Earlier", "2026-08-29T18:00:00.000Z"),
    ]).map(candidate => candidate.leagueName)).toEqual(["Earlier", "Zulu", "Later"]);
  });

  it("labels room states", () => {
    expect(roomStatusLabel(null, false)).toBe("Setup in progress");
    expect(roomStatusLabel({ roomId: "room-1", status: "countdown" }, true)).toBe("Scheduled");
    expect(roomStatusLabel({ roomId: "room-1", status: "live" }, true)).toBe("Live");
    expect(roomStatusLabel({ roomId: "room-1", status: "paused" }, true)).toBe("Paused");
    expect(roomStatusLabel({ roomId: "room-1", status: "ended" }, true)).toBe("Draft ended");
  });
});
