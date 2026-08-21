import { describe, expect, it } from "vitest";
import type { AccountDashboardLeague } from "../api/accountDashboardSchema";
import {
  draftStatus,
  formatCount,
  providerLabel,
  readinessStatus,
  roleLabel,
  upcomingDrafts,
} from "./accountDashboardDisplay";

const league = (name: string, startsAt?: string): AccountDashboardLeague => ({
  draft: startsAt === undefined ? {} : { startsAt },
  draftFormat: "snake",
  leagueId: name,
  leagueName: name,
  leagueSlug: name,
  membershipRole: "member",
  metrics: { completedMocks: 0, historicalImportSeasons: 0, savedSimulationOutcomes: 0, simulationRuns: 0, simulationsCompleted: 0 },
  provider: "mockd",
  readiness: { leagueSetup: "ready", liveDraft: "ready", teamClaim: "ready" },
  seasonId: name,
  seasonStatus: "published",
  seasonYear: 2026,
  teamCount: 10,
});

describe("account dashboard display", () => {
  it("labels every live draft state", () => {
    expect(draftStatus({ status: "countdown" })).toBe("Draft scheduled");
    expect(draftStatus({ status: "ended" })).toBe("Draft complete");
    expect(draftStatus({ status: "live" })).toBe("Draft live");
    expect(draftStatus({ status: "paused" })).toBe("Draft paused");
    expect(draftStatus({ status: "setup" })).toBe("Draft room ready");
    expect(draftStatus({ startsAt: "2099-01-01T00:00:00.000Z" })).toBe("Draft scheduled");
    expect(draftStatus({})).toBe("Not scheduled");
  });

  it("labels readiness, roles, providers and counts", () => {
    const roles: AccountDashboardLeague["membershipRole"][] = ["owner", "admin", "member", "observer"];
    const providers: AccountDashboardLeague["provider"][] = ["mockd", "espn", "sleeper", "yahoo"];
    expect(readinessStatus("ready")).toBe("Ready");
    expect(readinessStatus("needs_attention")).toBe("Needs attention");
    expect(roles.map(roleLabel)).toEqual(["League owner", "League admin", "Manager", "Observer"]);
    expect(providers.map(providerLabel)).toEqual(["Sunday Games", "ESPN", "Sleeper", "Yahoo"]);
    expect(formatCount(1, "league")).toBe("1 league");
    expect(formatCount(2, "league")).toBe("2 leagues");
    expect(formatCount(2, "saved", "saved")).toBe("2 saved");
  });

  it("sorts future drafts and excludes missing, past, active, and ended drafts", () => {
    const now = Date.parse("2026-08-22T00:00:00.000Z");
    expect(upcomingDrafts([
      league("Later", "2026-09-01T00:00:00.000Z"),
      league("Zulu", "2026-08-30T00:00:00.000Z"),
      league("Alpha", "2026-08-30T00:00:00.000Z"),
      league("Past", "2026-08-01T00:00:00.000Z"),
      { ...league("Already live", "2026-08-30T00:00:00.000Z"), draft: { startsAt: "2026-08-30T00:00:00.000Z", status: "live" } },
      { ...league("Already ended", "2026-08-30T00:00:00.000Z"), draft: { startsAt: "2026-08-30T00:00:00.000Z", status: "ended" } },
      league("Missing"),
    ], now).map(item => item.leagueName)).toEqual(["Alpha", "Zulu", "Later"]);
  });
});
