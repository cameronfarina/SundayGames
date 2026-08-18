import { expect, type Browser } from "@playwright/test";
import type { PlatformOnboardingLeague } from "../../../src/platform/platformOnboarding.js";
import { pageForExistingUser } from "./accounts.js";
import { api, expectOk } from "./api.js";
import { exerciseBoardSimulations } from "./boardSimulations.js";
import { requiredDeployedEnvironment } from "./environment.js";
import { openUnifiedBoard } from "./practiceWorkspace.js";
import type { OnboardingBody, SeasonBody } from "./types.js";

const leagueForSmokeSeason = (
  onboarding: OnboardingBody,
  seasonId: string,
  actorLabel: string,
): PlatformOnboardingLeague => {
  const league = onboarding.leagues.find(candidate => candidate.seasonId === seasonId);
  if (league === undefined) {
    throw new Error(
      `The pre-provisioned ${actorLabel} account does not have active access to smoke season ${seasonId}. ` +
      "Verify the provisioning document before rerunning the deployed smoke.",
    );
  }

  return league;
};

const assignedIdentityFor = (
  league: PlatformOnboardingLeague,
  actorLabel: string,
): { ownerName: string; teamName: string } => {
  const ownerName = league.membership.ownerDisplayName;
  const teamName = league.membership.teamDisplayName;
  if (ownerName === undefined || teamName === undefined) {
    throw new Error(
      `The pre-provisioned ${actorLabel} account must have an assigned team in smoke season ${league.seasonId}.`,
    );
  }

  return { ownerName, teamName };
};

export const exerciseDeployedWorkspace = async (browser: Browser): Promise<void> => {
  const environment = requiredDeployedEnvironment();
  const { page: commissionerPage } = await pageForExistingUser(
    browser,
    environment.commissionerEmail,
    environment.commissionerPassword,
  );
  const { page: memberPage } = await pageForExistingUser(
    browser,
    environment.memberEmail,
    environment.memberPassword,
  );
  const commissionerLeague = leagueForSmokeSeason(
    expectOk(await api<OnboardingBody>(commissionerPage, "/onboarding")),
    environment.seasonId,
    "commissioner",
  );
  const memberLeague = leagueForSmokeSeason(
    expectOk(await api<OnboardingBody>(memberPage, "/onboarding")),
    environment.seasonId,
    "member",
  );
  if (!commissionerLeague.canManageLeague) {
    throw new Error("The deployed smoke commissioner must have owner or admin access.");
  }
  if (memberLeague.canManageLeague) {
    throw new Error("The deployed smoke member must use a non-commissioner league membership.");
  }

  const commissionerIdentity = assignedIdentityFor(commissionerLeague, "commissioner");
  const memberIdentity = assignedIdentityFor(memberLeague, "member");
  if (commissionerLeague.membership.teamId === memberLeague.membership.teamId) {
    throw new Error("The deployed smoke commissioner and member must be assigned to different teams.");
  }
  const season = expectOk(await api<SeasonBody>(
    commissionerPage,
    `/seasons/${encodeURIComponent(environment.seasonId)}`,
  )).season;
  expect(memberLeague.leagueId).toBe(season.leagueId);

  await Promise.all([
    commissionerPage.goto(`/app?seasonId=${encodeURIComponent(season.id)}`),
    memberPage.goto(`/app?seasonId=${encodeURIComponent(season.id)}`),
  ]);
  await expect(commissionerPage.locator("#league-name")).toHaveText(season.league.name);
  await expect(memberPage.locator("#league-name")).toHaveText(season.league.name);
  await expect(commissionerPage.locator("#my-team-name")).toHaveText(commissionerIdentity.teamName);
  await expect(memberPage.locator("#my-team-name")).toHaveText(memberIdentity.teamName);

  await openUnifiedBoard(commissionerPage);
  await openUnifiedBoard(memberPage);
  await exerciseBoardSimulations(memberPage, season);
  await expect(memberPage.getByRole("link", { name: "Start mock draft" })).toHaveAttribute(
    "href",
    `/mock-drafts?seasonId=${encodeURIComponent(season.id)}`,
  );

  await commissionerPage.goto(`/setup?seasonId=${encodeURIComponent(season.id)}`);
  await expect(commissionerPage.locator("#setup-season-id-input")).toHaveValue(season.id);
};
