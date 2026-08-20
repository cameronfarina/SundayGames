import { describe, expect, it } from "vitest";

import type { FantasyTeam } from "../src/platform/leagueSeason.js";
import type { StoredLeagueSnapshot } from "../src/platform/leagueConnections.js";
import type { PlatformLeagueMembership } from "../src/platform/leagueSetup.js";
import { existingTeamsForImport } from "../src/platform/http/routes/leagueConnections/importTeamMapping.js";

const existingTeam = (
  id: string,
  position: number,
  displayName: string,
  ownerDisplayName: string,
): FantasyTeam => ({
  id,
  leagueSeasonId: "season-existing",
  ownerId: `owner-${id}`,
  ownerDisplayName,
  displayName,
  draftOrderPosition: position,
});

const snapshot = (
  connectionId: string,
  teams: ReadonlyArray<{ id: string; name: string; owners?: readonly string[] }>,
): StoredLeagueSnapshot => ({
  connectionId,
  syncedAt: "2026-08-20T00:00:00.000Z",
  settings: {
    name: "Imported League",
    season: "2026",
    teamCount: teams.length,
    rosterPositions: ["QB"],
    scoring: {},
  },
  teams: teams.map(team => ({
    providerTeamId: team.id,
    name: team.name,
    ownerNames: [...(team.owners ?? [])],
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    players: [],
  })),
  matchups: [],
});

const generatedTeams = (count: number): FantasyTeam[] => Array.from(
  { length: count },
  (_unused, index) => existingTeam(
    `generated-${index + 1}`,
    index + 1,
    `Generated ${index + 1}`,
    `Generated Owner ${index + 1}`,
  ),
);

const membership = (teamId: string): PlatformLeagueMembership => ({
  userId: `user-${teamId}`,
  leagueId: "league-existing",
  role: "member",
  teamId,
});

describe("league sync import team mapping", () => {
  it("uses existing draft order when an unclaimed manual league has no prior provider mapping", () => {
    const existing = [
      existingTeam("team-b", 2, "Second", "Bob"),
      existingTeam("team-a", 1, "First", "Alice"),
    ];
    const result = existingTeamsForImport({
      existingTeams: existing,
      generatedTeams: generatedTeams(2),
      memberships: [],
      previousSnapshot: null,
      snapshot: snapshot("connection", [
        { id: "provider-9", name: "Provider Nine" },
        { id: "provider-3", name: "Provider Three" },
      ]),
    });

    expect(result).toMatchObject({ status: "ready" });
    if (result.status === "ready") {
      expect(result.existingByGeneratedIndex.map(team => team.id)).toEqual(["team-a", "team-b"]);
    }
  });

  it("preserves a claimed team when its provider team name matches", () => {
    const existing = [
      existingTeam("team-a", 1, "Sunday Smashers", "Alice"),
      existingTeam("team-b", 2, "Other Team", "Bob"),
    ];
    const result = existingTeamsForImport({
      existingTeams: existing,
      generatedTeams: generatedTeams(2),
      memberships: [membership("team-a")],
      previousSnapshot: null,
      snapshot: snapshot("connection", [
        { id: "provider-b", name: "Other Team" },
        { id: "provider-a", name: " sunday   smashers " },
      ]),
    });

    expect(result).toMatchObject({ status: "ready" });
    if (result.status === "ready") {
      expect(result.existingByGeneratedIndex.map(team => team.id)).toEqual(["team-b", "team-a"]);
    }
  });

  it("preserves a claimed team when a provider owner matches an existing manager", () => {
    const claimed = {
      ...existingTeam("team-a", 1, "Different Name", "Primary Manager"),
      managerDisplayNames: ["Primary Manager", "Cameron Farina"],
    };
    const result = existingTeamsForImport({
      existingTeams: [claimed, existingTeam("team-b", 2, "Other Team", "Bob")],
      generatedTeams: generatedTeams(2),
      memberships: [membership("team-a")],
      previousSnapshot: null,
      snapshot: snapshot("connection", [
        { id: "provider-b", name: "Provider B", owners: ["Bob"] },
        { id: "provider-a", name: "Provider A", owners: ["Cameron Farina"] },
      ]),
    });

    expect(result).toMatchObject({ status: "ready" });
    if (result.status === "ready") {
      expect(result.existingByGeneratedIndex.map(team => team.id)).toEqual(["team-b", "team-a"]);
    }
  });

  it("refuses to guess when a claimed team cannot be matched", () => {
    const result = existingTeamsForImport({
      existingTeams: [
        existingTeam("team-a", 1, "Manual Name", "Alice"),
        existingTeam("team-b", 2, "Other Manual Name", "Bob"),
      ],
      generatedTeams: generatedTeams(2),
      memberships: [membership("team-a")],
      previousSnapshot: null,
      snapshot: snapshot("connection", [
        { id: "provider-1", name: "Provider One", owners: ["Carol"] },
        { id: "provider-2", name: "Provider Two", owners: ["Dan"] },
      ]),
    });

    expect(result).toEqual({
      status: "needs_attention",
      message: "Sunday Games could not safely match the claimed team “Manual Name”. Rename it to match the provider league or import into a new league.",
    });
  });

  it("uses provider team ids from the prior snapshot when provider order changes", () => {
    const existing = [
      existingTeam("team-a", 1, "First", "Alice"),
      existingTeam("team-b", 2, "Second", "Bob"),
    ];
    const previousSnapshot = snapshot("connection", [
      { id: "provider-a", name: "First" },
      { id: "provider-b", name: "Second" },
    ]);
    const result = existingTeamsForImport({
      existingTeams: existing,
      generatedTeams: generatedTeams(2),
      memberships: [membership("team-a")],
      previousSnapshot,
      snapshot: snapshot("connection", [
        { id: "provider-b", name: "Second" },
        { id: "provider-a", name: "First" },
      ]),
    });

    expect(result).toMatchObject({ status: "ready" });
    if (result.status === "ready") {
      expect(result.existingByGeneratedIndex.map(team => team.id)).toEqual(["team-b", "team-a"]);
    }
  });
});
