import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import {
  applyLeagueSetupImportToSeason,
  parseLeagueSetupImport,
} from "../src/platform/leagueSetupImport.js";

describe("platform league setup import application", () => {
  it("preserves settings and draft order on a copied season", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder.slice(0, 3), {
      ...leagueConfig,
      teams: 3,
    }, {
      leagueName: "Auction Crew",
      seasonYear: 2027,
      setupStatus: "published",
      draft: { scheduledAt: "2027-08-23T23:00:00.000Z", timezone: "America/New_York" },
    });
    const [firstTeam, secondTeam, thirdTeam] = season.teams;
    if (firstTeam === undefined || secondTeam === undefined || thirdTeam === undefined) {
      throw new Error("Expected three draft order team fixtures.");
    }
    const customDraftOrderSeason = {
      ...season,
      teams: [
        { ...firstTeam, draftOrderPosition: 3 },
        { ...secondTeam, draftOrderPosition: 1 },
        { ...thirdTeam, draftOrderPosition: 2 },
      ],
    };
    const parsed = parseLeagueSetupImport([
      "owner,team,email,role",
      "Owner11,Owner11's Team,owner11@example.com,owner",
      "Owner04,Owner04's Champs,owner04@example.com,member",
      "Owner01,,owner01@example.com,admin",
    ].join("\n"), { expectedTeamCount: 3 });

    const applied = applyLeagueSetupImportToSeason(customDraftOrderSeason, parsed.records);
    const [appliedFirst, appliedSecond, appliedThird] = applied.season.teams;
    if (appliedFirst === undefined || appliedSecond === undefined || appliedThird === undefined) {
      throw new Error("Expected three applied team fixtures.");
    }

    expect(applied.season).not.toBe(customDraftOrderSeason);
    expect(applied.season.settings).toEqual(customDraftOrderSeason.settings);
    expect(applied.season.settings).not.toBe(customDraftOrderSeason.settings);
    expect(applied.season.draft).toEqual(customDraftOrderSeason.draft);
    expect(applied.season.teams.map(team => team.id)).toEqual([
      `${season.id}-team-01-owner11`,
      `${season.id}-team-02-owner04`,
      firstTeam.id,
    ]);
    expect(applied.season.teams.map(team => team.ownerId)).toEqual([
      "owner-owner11",
      "owner-owner04",
      firstTeam.ownerId,
    ]);
    expect(applied.season.teams.map(team => team.draftOrderPosition)).toEqual([3, 1, 2]);
    expect(applied.memberships).toEqual([
      {
        leagueId: season.leagueId,
        ownerId: appliedFirst.ownerId,
        teamId: appliedFirst.id,
        ownerDisplayName: "Owner11",
        teamDisplayName: "Owner11's Team",
        email: "owner11@example.com",
        role: "owner",
      },
      {
        leagueId: season.leagueId,
        ownerId: appliedSecond.ownerId,
        teamId: appliedSecond.id,
        ownerDisplayName: "Owner04",
        teamDisplayName: "Owner04's Champs",
        email: "owner04@example.com",
        role: "member",
      },
      {
        leagueId: season.leagueId,
        ownerId: appliedThird.ownerId,
        teamId: appliedThird.id,
        ownerDisplayName: "Owner01",
        teamDisplayName: "Owner01",
        email: "owner01@example.com",
        role: "admin",
      },
    ]);
  });

  it("preserves identities when legacy owner rows are reordered", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder.slice(0, 3), {
      ...leagueConfig,
      teams: 3,
    }, { leagueName: "Auction Crew", seasonYear: 2027, setupStatus: "published" });
    const existingByOwner = new Map(season.teams.map(team => [team.ownerDisplayName, team]));
    const parsed = parseLeagueSetupImport([
      "owner,team,email,role",
      "Owner02,Owner02's Champs,owner02@example.com,member",
      "Owner03,Owner03 Ballers,owner03@example.com,admin",
      "Owner01,Owner01's Team,owner01@example.com,owner",
    ].join("\n"), { expectedTeamCount: 3 });

    const applied = applyLeagueSetupImportToSeason(season, parsed.records);
    const expectedIdentities = ["Owner02", "Owner03", "Owner01"].map(ownerDisplayName => {
      const existing = existingByOwner.get(ownerDisplayName);
      if (existing === undefined) throw new Error(`Missing ${ownerDisplayName} team fixture.`);
      return { ownerDisplayName, id: existing.id, ownerId: existing.ownerId };
    });

    expect(applied.season.teams.map(team => ({
      ownerDisplayName: team.ownerDisplayName,
      id: team.id,
      ownerId: team.ownerId,
    }))).toEqual(expectedIdentities);
    expect(applied.season.teams.map(team => team.draftOrderPosition)).toEqual(
      season.teams.map(team => team.draftOrderPosition),
    );
  });

  it("creates identities for genuinely new legacy owner rows", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder.slice(0, 2), {
      ...leagueConfig,
      teams: 2,
    }, { leagueName: "Auction Crew", seasonYear: 2027, setupStatus: "published" });
    const parsed = parseLeagueSetupImport([
      "owner,team,email,role",
      "Owner02,Owner02's Champs,owner02@example.com,member",
      "Alex,Expansion Team,alex@example.com,member",
    ].join("\n"), { expectedTeamCount: 2 });

    const applied = applyLeagueSetupImportToSeason(season, parsed.records);
    const newAlexTeam = applied.season.teams.find(team => team.ownerDisplayName === "Alex");
    if (newAlexTeam === undefined) throw new Error("Expected an Alex team fixture.");

    expect(newAlexTeam).toMatchObject({
      id: `${season.id}-team-02-alex`,
      ownerId: "owner-alex",
      draftOrderPosition: 2,
    });
    expect(season.teams.map(team => team.id)).not.toContain(newAlexTeam.id);
  });
});
