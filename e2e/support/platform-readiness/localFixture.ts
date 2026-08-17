import { expect, type Browser } from "@playwright/test";
import { ownerOrder } from "../../../config/league.js";
import type { PlatformLeagueMembership } from "../../../src/platform/platformApp.js";
import { expectAuthenticatedSession } from "../auth.js";
import {
  expectInvitationPage,
  expectTeamCanBeClaimed,
  invitationTeam,
  invitationTeams,
} from "../invitations.js";
import { pageForLocalFixtureUser } from "./accounts.js";
import { api, expectOk } from "./api.js";
import { emailFor, leagueName, password } from "./environment.js";
import { seedSeasonFromBrowser, teamByOwner } from "./seasons.js";
import { applyCommissionerSetup, createLiveRoomFromSetup } from "./setup.js";
import type { OnboardingBody, ReadySmokeWorkspace, SeasonBody } from "./types.js";

export const localFixtureWorkspace = async (browser: Browser): Promise<ReadySmokeWorkspace> => {
  const camEmail = emailFor("owner11");
  const sethEmail = emailFor("owner04");
  const hoodyEmail = emailFor("owner02");
  const { page: camPage, account: camAccount } = await pageForLocalFixtureUser(browser, camEmail);
  const seedSeason = await seedSeasonFromBrowser(camPage, camAccount);
  const invitationUrl = await applyCommissionerSetup(camPage, seedSeason, camEmail);
  const createdRoom = await createLiveRoomFromSetup(camPage, seedSeason);
  const initialRosterCount = createdRoom.teamSummaries.reduce(
    (count, team) => count + team.roster.length,
    0,
  );
  expect(createdRoom.board).toHaveLength(493);
  expect(initialRosterCount).toBe(7);
  const { page: sethPage } = await pageForLocalFixtureUser(browser, sethEmail);
  await sethPage.goto(invitationUrl);
  await expectInvitationPage(sethPage, leagueName, ownerOrder.length);
  const beforeSethClaim = expectOk(await api<OnboardingBody>(sethPage, "/onboarding"));
  expect(beforeSethClaim.leagues.some(league => league.seasonId === seedSeason.id)).toBe(false);
  const sethTeamRow = await expectTeamCanBeClaimed(sethPage, "Owner04");
  await Promise.all([
    sethPage.waitForURL(/\/leagues\/[^/]+$/u),
    sethTeamRow.getByRole("button", { name: "Join as Owner04" }).click(),
  ]);
  const acceptedOnboarding = expectOk(await api<{ leagues: Array<{ membership: PlatformLeagueMembership }> }>(
    sethPage,
    "/onboarding",
  ));
  await expect(sethPage.getByRole("heading", { name: leagueName })).toBeVisible();
  await sethPage.goto(invitationUrl);
  await expect(sethPage.getByRole("link", { name: "Open league" })).toBeVisible();
  await expect(invitationTeam(sethPage, "Owner04")).toContainText("Your team");
  await expect(invitationTeams(sethPage).getByRole("button")).toHaveCount(0);

  const hoodyContext = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const hoodyPage = await hoodyContext.newPage();
  await hoodyPage.goto(invitationUrl);
  await expectInvitationPage(hoodyPage, leagueName, ownerOrder.length);
  await expect(invitationTeam(hoodyPage, "Owner04")).toContainText("Claimed");
  await expect(hoodyPage.getByRole("button", { name: /^Join as /u })).toHaveCount(0);
  await hoodyPage.getByRole("link", { name: "Create account" }).click();
  await expect(hoodyPage).toHaveURL(/\/signup\?returnTo=/);
  await expect(hoodyPage.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await hoodyPage.getByLabel("Email", { exact: true }).fill(hoodyEmail);
  await hoodyPage.getByLabel("Password", { exact: true }).fill(password);
  await Promise.all([
    hoodyPage.waitForURL(/\/invite\?token=/),
    hoodyPage.getByRole("button", { name: "Create account" }).click(),
  ]);
  await expectAuthenticatedSession(hoodyPage, hoodyEmail);
  await expectInvitationPage(hoodyPage, leagueName, ownerOrder.length);
  const beforeHoodyClaim = expectOk(await api<OnboardingBody>(hoodyPage, "/onboarding"));
  expect(beforeHoodyClaim.leagues.some(league => league.seasonId === seedSeason.id)).toBe(false);
  await expect(invitationTeam(hoodyPage, "Owner04")).toContainText("Claimed");
  const hoodyTeamRow = await expectTeamCanBeClaimed(hoodyPage, "Owner02");
  await Promise.all([
    hoodyPage.waitForURL(/\/leagues\/[^/]+$/u),
    hoodyTeamRow.getByRole("button", { name: "Join as Owner02" }).click(),
  ]);
  await expect(hoodyPage.getByRole("heading", { name: leagueName })).toBeVisible();

  const appliedSeason = expectOk(await api<SeasonBody>(camPage, `/seasons/${seedSeason.id}`)).season;
  const appliedSethTeam = teamByOwner(appliedSeason, "Owner04");
  expect(acceptedOnboarding.leagues[0]?.membership).toMatchObject({
    role: "member",
    ownerId: appliedSethTeam.ownerId,
    teamId: appliedSethTeam.id,
  });
  const acceptedHoodyOnboarding = expectOk(await api<{
    leagues: Array<{ membership: PlatformLeagueMembership }>;
  }>(hoodyPage, "/onboarding"));
  const appliedHoodyTeam = teamByOwner(appliedSeason, "Owner02");
  expect(acceptedHoodyOnboarding.leagues[0]?.membership).toMatchObject({
    role: "member",
    ownerId: appliedHoodyTeam.ownerId,
    teamId: appliedHoodyTeam.id,
  });

  return {
    commissionerPage: camPage,
    memberPage: sethPage,
    season: appliedSeason,
    room: createdRoom,
    commissionerOwnerName: "Owner11",
    memberOwnerName: "Owner04",
    commissionerTeamName: "Owner11",
    memberTeamName: "Owner04",
    salePlayerName: "Puka Nacua",
    salePrice: 62,
  };
};
