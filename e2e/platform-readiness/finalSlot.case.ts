import { expect, test } from "@playwright/test";
import { leagueConfig } from "../../config/league.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../../src/platform/leagueSeason.js";
import {
  availablePlayersTable,
  createAuctionMock,
  expectAuctionMockSetup,
  startAuctionMock,
} from "../support/mockDraft.js";
import { pageForLocalFixtureUser } from "../support/platform-readiness/accounts.js";
import { api, expectOk } from "../support/platform-readiness/api.js";
import { isDeployedSmoke, provisioningToken } from "../support/platform-readiness/environment.js";
import { teamByOwner } from "../support/platform-readiness/seasons.js";
import type { SeasonBody } from "../support/platform-readiness/types.js";

test("auction mock only enables legal nominations for the final open slot", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const { page, account } = await pageForLocalFixtureUser(browser, "final.slot.mock.e2e@example.com");
  const owners = ["Alpha", "Bravo", "Charlie", "Delta"];
  const baseSeason = buildCurrentMockdLeagueSeason(owners, {
    ...leagueConfig,
    teams: owners.length,
    rosterSize: 1,
    lineup: { QB: 1 },
    rosterMaximums: { QB: 1, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
  }, {
    leagueName: "Final slot nomination E2E",
    setupStatus: "published",
  });
  const leagueId = `${baseSeason.leagueId}-final-slot-mock`;
  const seasonId = `${leagueId}-season-${baseSeason.seasonYear}`;
  const season: LeagueSeason = {
    ...baseSeason,
    id: seasonId,
    leagueId,
    league: {
      ...baseSeason.league,
      id: leagueId,
      externalLeagueId: `${baseSeason.league.externalLeagueId}-final-slot-mock`,
    },
    teams: baseSeason.teams.map((team, index) => ({
      ...team,
      id: `${seasonId}-team-${index + 1}`,
      leagueSeasonId: seasonId,
      ownerId: `${team.ownerId}-final-slot-mock`,
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

  await page.goto(`/practice?seasonId=${encodeURIComponent(createdSeason.id)}`);
  await createAuctionMock(page);
  await expectAuctionMockSetup(page);
  await startAuctionMock(page);
  await expect(page.getByText("Open slots", { exact: true }).locator("..")).toContainText("1");

  const playerRows = availablePlayersTable(page).getByRole("row").filter({
    has: page.getByRole("button", { name: /^Nominate /u }),
  });
  const quarterbackAction = playerRows.filter({
    has: page.getByRole("cell", { name: "QB", exact: true }),
  }).first().getByRole("button", { name: /^Nominate /u });
  const invalidAction = playerRows.filter({
    has: page.getByRole("cell", { name: "RB", exact: true }),
  }).first().getByRole("button", { name: /^Nominate /u });
  await expect(quarterbackAction).toBeEnabled();
  await expect(invalidAction).toBeDisabled();

  const nominationResponse = page.waitForResponse(response =>
    response.request().method() === "POST"
    && response.url().includes("/season-mock-drafts/")
    && response.url().endsWith("/commands")
  );
  await quarterbackAction.click();
  expect((await nominationResponse).status()).toBe(200);
  await expect(page.getByRole("region", { name: "Live auction" })).toBeVisible();
});
