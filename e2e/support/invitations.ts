import { expect, type Locator, type Page } from "@playwright/test";

export const invitationTeams = (page: Page): Locator =>
  page.getByRole("list", { name: "League teams" });

export const invitationTeam = (page: Page, teamName: string): Locator =>
  invitationTeams(page).getByRole("listitem").filter({
    has: page.getByText(teamName, { exact: true }),
  });

export const expectInvitationPage = async (
  page: Page,
  leagueName: string,
  teamCount: number,
): Promise<void> => {
  await expect(page.getByRole("heading", { name: `Join ${leagueName}` })).toBeVisible();
  await expect(invitationTeams(page).getByRole("listitem")).toHaveCount(teamCount);
};

export const expectTeamCanBeClaimed = async (
  page: Page,
  teamName: string,
): Promise<Locator> => {
  const team = invitationTeam(page, teamName);
  await expect(team).toBeVisible();
  await expect(team.getByRole("button", { name: `Join as ${teamName}` })).toBeEnabled();
  return team;
};
