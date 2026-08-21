import { expect, test } from "@playwright/test";
import { z } from "zod";
import { ownerOrder } from "../config/league.js";
import type { LeagueSeason } from "../src/platform/leagueSeason.js";
import {
  completeRequiredAccountSetup,
  expectAuthenticatedSession,
  expectSignedOut,
  signOutThroughAccountMenu,
} from "./support/auth.js";
import {
  expectInvitationPage,
  expectTeamCanBeClaimed,
  invitationTeam,
} from "./support/invitations.js";
import {
  api,
  emailDomain,
  expectNoHorizontalPageOverflow,
  expectOk,
  isDeployedSmoke,
  leagueName,
  mobileViewport,
  namespace,
  password,
  provisioningToken,
  seasonForMobileRelease,
  signUpAndLogIn,
} from "./support/mobile.js";

const invitationSchema = z.object({
  invitation: z.object({ acceptPath: z.string() }),
});
const onboardingSchema = z.object({
  leagues: z.array(z.object({
    seasonId: z.string(),
    membership: z.object({ teamId: z.string().optional() }),
  })),
});

test.use({ viewport: mobileViewport, hasTouch: true, isMobile: true });

test("shared league invitation requires deliberate mobile team claims for existing and new accounts", async ({ page }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const commissionerEmail = `mobile.invite.commissioner.${namespace}@${emailDomain}`;
  const existingMemberEmail = `mobile.invite.existing.${namespace}@${emailDomain}`;
  const newMemberEmail = `mobile.invite.new.${namespace}@${emailDomain}`;
  const commissioner = await signUpAndLogIn(page, commissionerEmail);
  const baseSeason = seasonForMobileRelease();
  const leagueId = `${baseSeason.leagueId}-invite`;
  const seasonId = `${baseSeason.id}-invite`;
  const season: LeagueSeason = {
    ...baseSeason,
    id: seasonId,
    leagueId,
    league: {
      ...baseSeason.league,
      id: leagueId,
      externalLeagueId: `${baseSeason.league.externalLeagueId}-invite`,
      name: `${leagueName} Invite`,
    },
    teams: baseSeason.teams.map(team => ({
      ...team,
      id: `${team.id}-invite`,
      leagueSeasonId: seasonId,
    })),
  };
  const commissionerTeam = season.teams[0];
  const existingMemberTeam = season.teams[1];
  const newMemberTeam = season.teams[2];
  if (commissionerTeam === undefined || existingMemberTeam === undefined || newMemberTeam === undefined) {
    throw new Error("Expected three mobile invite fixture teams.");
  }
  expectOk(await api(page, "/seasons", z.unknown(), {
    method: "POST",
    headers: { "x-mockd-provisioning-token": provisioningToken },
    body: {
      season,
      memberships: [{
        userId: commissioner.id,
        leagueId,
        role: "owner",
        ownerId: commissionerTeam.ownerId,
        teamId: commissionerTeam.id,
      }],
    },
  }));
  const issued = expectOk(await api(page, "/invitations", invitationSchema, {
    method: "POST",
    body: { seasonId },
  }));

  await signOutThroughAccountMenu(page);
  await expectSignedOut(page);
  await signUpAndLogIn(page, existingMemberEmail);
  await page.goto(issued.invitation.acceptPath);
  await expectInvitationPage(page, `${leagueName} Invite`, ownerOrder.length);
  const beforeExistingClaim = expectOk(await api(page, "/onboarding", onboardingSchema));
  expect(beforeExistingClaim.leagues.some(league => league.seasonId === seasonId)).toBe(false);
  const existingMemberRow = await expectTeamCanBeClaimed(page, existingMemberTeam.displayName);
  await Promise.all([
    page.waitForURL(/\/leagues\/[^/]+$/u),
    existingMemberRow.getByRole("button", { name: `Join as ${existingMemberTeam.displayName}` }).click(),
  ]);
  await expect(page.getByRole("heading", { name: `${leagueName} Invite` })).toBeVisible();
  const afterExistingClaim = expectOk(await api(page, "/onboarding", onboardingSchema));
  expect(afterExistingClaim.leagues.find(league => league.seasonId === seasonId)?.membership.teamId)
    .toBe(existingMemberTeam.id);
  await signOutThroughAccountMenu(page);
  await expectSignedOut(page);

  await page.goto(issued.invitation.acceptPath);
  await expectInvitationPage(page, `${leagueName} Invite`, ownerOrder.length);
  await expect(invitationTeam(page, existingMemberTeam.displayName)).toContainText("Claimed");
  await expect(page.getByRole("button", { name: /^Join as /u })).toHaveCount(0);
  await expectNoHorizontalPageOverflow(page);

  await page.getByRole("link", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(newMemberEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await Promise.all([
    page.waitForURL(/\/invite\?token=/),
    page.getByRole("button", { name: "Create account" }).click(),
  ]);
  await expectAuthenticatedSession(page, newMemberEmail);
  await completeRequiredAccountSetup(page);
  await expectInvitationPage(page, `${leagueName} Invite`, ownerOrder.length);
  const beforeClaim = expectOk(await api(page, "/onboarding", onboardingSchema));
  expect(beforeClaim.leagues.some(league => league.seasonId === seasonId)).toBe(false);
  const memberRow = await expectTeamCanBeClaimed(page, newMemberTeam.displayName);
  await expectNoHorizontalPageOverflow(page);
  await Promise.all([
    page.waitForURL(/\/leagues\/[^/]+$/u),
    memberRow.getByRole("button", { name: `Join as ${newMemberTeam.displayName}` }).click(),
  ]);
  await expect(page.getByRole("heading", { name: `${leagueName} Invite` })).toBeVisible();
  const afterClaim = expectOk(await api(page, "/onboarding", onboardingSchema));
  expect(afterClaim.leagues.find(league => league.seasonId === seasonId)?.membership.teamId)
    .toBe(newMemberTeam.id);
});
