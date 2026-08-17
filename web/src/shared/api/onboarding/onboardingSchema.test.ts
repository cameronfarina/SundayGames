import { describe, expect, it } from "vitest";
import { onboardingSchema } from "./onboardingSchema";

const league = {
  canManageLeague: true,
  leagueId: "league-1",
  leagueName: "Sunday Games",
  leagueSlug: "sunday-games",
  liveDraft: { roomId: "room-1", status: "setup" },
  membership: {
    ownerDisplayName: "Owner11",
    ownerId: "owner-1",
    role: "owner",
    teamDisplayName: "Short King",
    teamId: "team-1",
  },
  nextDraftAt: "2026-08-30T23:00:00.000Z",
  readiness: {
    leagueSetup: "ready",
    liveDraft: "ready",
    teamClaim: "ready",
  },
  seasonId: "season-1",
  seasonYear: 2026,
};

describe("onboarding schema", () => {
  it("accepts the complete authenticated league contract", () => {
    const result = onboardingSchema.parse({
      account: { email: "user@example.com", id: "account-1" },
      leagues: [league, { ...league, liveDraft: null, membership: { role: "observer" } }],
    });

    expect(result.leagues).toHaveLength(2);
    expect(result.leagues[0]?.membership.teamDisplayName).toBe("Short King");
  });

  it("rejects invalid account, membership, readiness, room, and season data", () => {
    const result = onboardingSchema.safeParse({
      account: { email: "invalid", id: "account-1" },
      leagues: [{
        ...league,
        liveDraft: { roomId: "room-1", status: "unknown" },
        membership: { role: "commissioner" },
        readiness: { ...league.readiness, teamClaim: "later" },
        seasonYear: 2026.5,
      }],
    });

    expect(result.success).toBe(false);
  });
});
