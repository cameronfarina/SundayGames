import { test } from "@playwright/test";
import { leagueConfig } from "../../config/league.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../../src/platform/leagueSeason.js";
import { pageForLocalFixtureUser } from "../support/platform-readiness/accounts.js";
import { api, expectOk } from "../support/platform-readiness/api.js";
import { exerciseCompletedAuctionMockResults } from "../support/platform-readiness/completedAuction.js";
import { isDeployedSmoke, provisioningToken } from "../support/platform-readiness/environment.js";
import { teamByOwner } from "../support/platform-readiness/seasons.js";
import type { SeasonBody } from "../support/platform-readiness/types.js";

test("completed auction mock shows every team's priced Week 1 roster", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const { page, account } = await pageForLocalFixtureUser(browser, "completed.mock.e2e@example.com");
  const owners = ["Alpha", "Bravo", "Charlie", "Delta"];
  const baseSeason = buildCurrentMockdLeagueSeason(owners, {
    ...leagueConfig,
    teams: owners.length,
    rosterSize: 4,
    lineup: { QB: 1, RB: 1, WR: 1, BENCH: 1 },
    rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 1, K: 0, DST: 0 },
  }, {
    leagueName: "Completed mock E2E",
    setupStatus: "published",
  });
  const leagueId = `${baseSeason.leagueId}-completed-mock`;
  const seasonId = `${leagueId}-season-${baseSeason.seasonYear}`;
  const season: LeagueSeason = {
    ...baseSeason,
    id: seasonId,
    leagueId,
    league: {
      ...baseSeason.league,
      id: leagueId,
      externalLeagueId: `${baseSeason.league.externalLeagueId}-completed-mock`,
    },
    teams: baseSeason.teams.map((team, index) => ({
      ...team,
      id: `${seasonId}-team-${index + 1}`,
      leagueSeasonId: seasonId,
      ownerId: `${team.ownerId}-completed-mock`,
    })),
  };
  const claimedTeam = teamByOwner(season, "Alpha");
  const createdSeason = expectOk(await api<SeasonBody>(page, "/seasons", {
    method: "POST",
    headers: { "x-mockd-provisioning-token": provisioningToken },
    body: {
      season,
      memberships: [{
        userId: account.id,
        leagueId: season.leagueId,
        role: "admin",
        ownerId: claimedTeam.ownerId,
        teamId: claimedTeam.id,
      }],
    },
  })).season;

  await exerciseCompletedAuctionMockResults(page, createdSeason, claimedTeam.id);
});
