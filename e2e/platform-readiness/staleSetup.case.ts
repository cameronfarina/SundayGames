import { expect, test } from "@playwright/test";
import { leagueConfig } from "../../config/league.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../../src/platform/leagueSeason.js";
import { createAuctionMock, expectAuctionMockSetup } from "../support/mockDraft.js";
import { pageForLocalFixtureUser } from "../support/platform-readiness/accounts.js";
import { api, expectOk } from "../support/platform-readiness/api.js";
import { isDeployedSmoke, provisioningToken } from "../support/platform-readiness/environment.js";
import { teamByOwner } from "../support/platform-readiness/seasons.js";
import type { SeasonBody } from "../support/platform-readiness/types.js";

test("commissioner league switching discards stale setup fetch responses", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local route delays are not used by deployed smoke.");
  const { page, account } = await pageForLocalFixtureUser(browser, "setup.switch.e2e@example.com");
  await page.setViewportSize({ width: 390, height: 844 });
  const owners = ["Owner11", "Owner04", "Owner01", "Owner02"];
  const buildSeason = (suffix: string, name: string): LeagueSeason => {
    const base = buildCurrentMockdLeagueSeason(owners, { ...leagueConfig, teams: owners.length }, {
      leagueName: name,
      setupStatus: "published",
    });
    const leagueId = `${base.leagueId}-${suffix}`;
    const seasonId = `${leagueId}-season-${base.seasonYear}`;

    return {
      ...base,
      id: seasonId,
      leagueId,
      league: {
        ...base.league,
        id: leagueId,
        externalLeagueId: `${base.league.externalLeagueId}-${suffix}`,
        name,
      },
      teams: base.teams.map((team, index) => ({
        ...team,
        id: `${seasonId}-team-${index + 1}`,
        leagueSeasonId: seasonId,
        ownerId: `${team.ownerId}-${suffix}`,
        displayName: `${name} ${team.ownerDisplayName}`,
      })),
    };
  };
  const seasonA = buildSeason("switch-a", "League A");
  const seasonB = buildSeason("switch-b", "League B");
  for (const season of [seasonA, seasonB]) {
    const commissionerTeam = teamByOwner(season, "Owner11");
    expectOk(await api<SeasonBody>(page, "/seasons", {
      method: "POST",
      headers: { "x-mockd-provisioning-token": provisioningToken },
      body: {
        season,
        memberships: [{
          userId: account.id,
          leagueId: season.leagueId,
          role: "admin",
          ownerId: commissionerTeam.ownerId,
          teamId: commissionerTeam.id,
        }],
      },
    }));
  }
  expectOk(await api(page, "/invitations", {
    method: "POST",
    body: { seasonId: seasonA.id },
  }));

  const delay = async (milliseconds: number): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, milliseconds));
  };
  await page.route("**/invitations?seasonId=*", async route => {
    const requestSeasonId = new URL(route.request().url()).searchParams.get("seasonId");
    const response = await route.fetch();
    if (requestSeasonId === seasonA.id) await delay(300);
    await route.fulfill({ response });
  });
  await page.route("**/seasons/**", async route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET" || url.pathname !== `/seasons/${seasonA.id}`) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    await delay(300);
    await route.fulfill({ response });
  });

  await page.goto(`/setup?seasonId=${encodeURIComponent(seasonA.id)}`);
  const headerLeaguePicker = page.getByRole("banner").getByRole("combobox", {
    name: "Active league",
  });
  await expect(headerLeaguePicker).toHaveText(`League A · ${String(seasonA.seasonYear)}`);
  await headerLeaguePicker.click();
  await page.getByRole("option", {
    name: `League B · ${String(seasonB.seasonYear)}`,
    exact: true,
  }).click();
  await expect(page).toHaveURL(/\/leagues\/league-b\/commissioner$/u);
  await expect(page.getByRole("button", { name: "Create league link" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Teams and managers" })).toHaveValue(/League B Owner11/u);
  await delay(400);
  await expect(page.getByRole("button", { name: "Create league link" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Teams and managers" })).not.toHaveValue(/League A Owner11/u);

  await page.goto(`/practice?seasonId=${encodeURIComponent(seasonA.id)}`);
  const leagueAMockSessionId = await createAuctionMock(page);
  await expectAuctionMockSetup(page);
  const mockLeaguePicker = page.getByRole("banner").getByRole("combobox", {
    name: "Active league",
  });
  await mockLeaguePicker.click();
  await page.getByRole("option", {
    name: `League B · ${String(seasonB.seasonYear)}`,
    exact: true,
  }).click();
  await expect(page).toHaveURL(/\/leagues\/league-b\/mock-drafts$/u);
  expect(new URL(page.url()).searchParams.has("seasonId")).toBe(false);
  await expect(page.getByRole("button", { name: "Create auction mock" })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("sessionId")).toBeNull();
  expect(new URL(page.url()).searchParams.get("sessionId")).not.toBe(leagueAMockSessionId);
  await expect(page.getByText(/belongs to another league/u)).toHaveCount(0);
});
