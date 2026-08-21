import { expect, test } from "@playwright/test";
import { leagueConfig, ownerOrder } from "../config/league.js";
import {
  buildCurrentMockdLeagueSeason,
  type LeagueSeason,
} from "../src/platform/leagueSeason.js";
import { signOutThroughAccountMenu } from "./support/auth.js";
import {
  emailDomain,
  isDeployedSmoke,
  namespace,
  password,
  provisioningToken,
  signInExisting,
  signUpAndLogIn,
} from "./support/mobile.js";
import { api, expectOk } from "./support/platform-readiness/api.js";
import { createLiveRoomThroughWizard } from "./support/platform-readiness/setup.js";
import type {
  LiveDraftRoomBody,
  OnboardingBody,
} from "./support/platform-readiness/types.js";

const snakeSeason = (): LeagueSeason => {
  const base = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: `Snake Live League ${namespace}`,
    setupStatus: "published",
  });
  const leagueId = `${base.leagueId}-snake-live-${namespace}`;
  const seasonId = `${leagueId}-season-${base.seasonYear}`;
  const teams = base.teams.map((team, index) => ({
    ...team,
    id: `${seasonId}-team-${String(index + 1).padStart(2, "0")}`,
    leagueSeasonId: seasonId,
    ownerId: `${team.ownerId}-snake-live-${namespace}`,
  }));

  return {
    ...base,
    id: seasonId,
    leagueId,
    league: {
      ...base.league,
      id: leagueId,
      externalLeagueId: `${base.league.externalLeagueId}-snake-live-${namespace}`,
      name: `Snake Live League ${namespace}`,
    },
    teams,
    settings: {
      expectedTeamCount: base.settings.expectedTeamCount,
      draftFormat: "snake",
      scoring: base.settings.scoring,
      snake: {
        rounds: base.settings.roster.rosterSize,
        order: teams.map(team => team.id),
      },
      roster: base.settings.roster,
      keeperPolicy: base.settings.keeperPolicy,
    },
  };
};

test("commissioner opens a snake room and the manager on the clock makes a pick", async ({ page }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const commissionerEmail = `snake.live.commissioner.${namespace}@${emailDomain}`;
  const managerEmail = `snake.live.manager.${namespace}@${emailDomain}`;
  const commissioner = await signUpAndLogIn(page, commissionerEmail);
  await signOutThroughAccountMenu(page);
  const manager = await signUpAndLogIn(page, managerEmail);
  await signOutThroughAccountMenu(page);
  await signInExisting(page, commissionerEmail, password);

  const season = snakeSeason();
  const managerTeam = season.teams[0];
  const commissionerTeam = season.teams[1];
  if (managerTeam === undefined || commissionerTeam === undefined) {
    throw new Error("Expected two snake teams.");
  }
  expectOk(await api(page, "/seasons", {
    method: "POST",
    headers: { "x-mockd-provisioning-token": provisioningToken },
    body: {
      season,
      memberships: [
        {
          userId: commissioner.id,
          leagueId: season.leagueId,
          role: "admin",
          ownerId: commissionerTeam.ownerId,
          teamId: commissionerTeam.id,
        },
        {
          userId: manager.id,
          leagueId: season.leagueId,
          role: "member",
          ownerId: managerTeam.ownerId,
          teamId: managerTeam.id,
        },
      ],
    },
  }));

  await page.goto(`/commissioner?seasonId=${encodeURIComponent(season.id)}`);
  await createLiveRoomThroughWizard(page);
  const enterRoom = page.getByRole("link", { name: "Enter draft room" });
  await expect(enterRoom).toBeVisible();
  const onboarding = expectOk(await api<OnboardingBody>(page, "/onboarding"));
  const roomId = onboarding.leagues.find(league => league.seasonId === season.id)?.liveDraft?.roomId;
  if (roomId === undefined) throw new Error("Expected the created snake room in onboarding.");
  await enterRoom.click();
  await expect(page.getByRole("textbox", { name: "Pick command" })).toBeVisible();
  await page.getByRole("button", { name: "Start draft" }).click();
  await expect(page.getByRole("region", { name: "Draft status" })
    .getByText("Live", { exact: true })).toBeVisible();

  await signOutThroughAccountMenu(page);
  await signInExisting(page, managerEmail, password);
  const managerOnboarding = expectOk(await api<OnboardingBody>(page, "/onboarding"));
  const leagueSlug = managerOnboarding.leagues.find(league => league.seasonId === season.id)?.leagueSlug;
  if (leagueSlug === undefined) throw new Error("Expected the manager's snake league in onboarding.");
  await page.goto(`/leagues/${encodeURIComponent(leagueSlug)}/draft`);
  await expect(page.getByText(/^Your team is on the clock\./u)).toBeVisible();
  const pageWidth = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(pageWidth.content).toBeLessThanOrEqual(pageWidth.viewport);
  const playerRow = page.getByRole("region", { name: "Available players" }).getByRole("row").nth(1);
  const playerName = (await playerRow.getByRole("rowheader").textContent())?.trim();
  if (playerName === undefined || playerName.length === 0) throw new Error("Expected an available player.");
  await playerRow.getByRole("button", { name: `Use ${playerName} in pick command` }).click();
  await page.getByRole("button", { name: "Make pick" }).click();
  await expect(page.getByRole("region", { name: "All picks" })).toContainText(playerName);

  const picked = expectOk(await api<LiveDraftRoomBody>(page, `/live-rooms/${encodeURIComponent(roomId)}`));
  expect(picked.room).toMatchObject({
    canLogPick: false,
    onTheClock: { overall: 2, teamId: commissionerTeam.id },
    salesLog: [{ playerName, teamId: managerTeam.id }],
  });
});
