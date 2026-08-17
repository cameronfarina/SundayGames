import { expect, type Page } from "@playwright/test";
import type { LeagueSeason } from "../../../src/platform/leagueSeason.js";
import {
  availablePlayersTable,
  createAuctionMock,
  startAuctionMock,
} from "../mockDraft.js";
import { expectPracticeBoard } from "../practice.js";

export const exerciseCompletedAuctionMockResults = async (
  page: Page,
  season: LeagueSeason,
  claimedTeamId: string,
): Promise<void> => {
  await page.goto(`/practice?seasonId=${encodeURIComponent(season.id)}`);
  await expectPracticeBoard(page);
  await createAuctionMock(page);
  await startAuctionMock(page);

  const finishButton = page.getByRole("button", { name: "Finish mock" });
  for (let decision = 0; decision < season.settings.roster.rosterSize * 4; decision += 1) {
    if (await finishButton.isEnabled()) break;

    const buyButton = page.getByRole("button", { name: /^Bid \$\d+$/u });
    const passButton = page.getByRole("button", { name: "Pass", exact: true });
    if (await buyButton.count() > 0 && await buyButton.isEnabled()) {
      await buyButton.click();
    } else if (await passButton.count() > 0 && await passButton.isEnabled()) {
      await passButton.click();
    } else {
      const nominationButtons = availablePlayersTable(page)
        .locator('button[aria-label^="Nominate "]:enabled');
      await expect.poll(async () => (
        await finishButton.isEnabled() || await nominationButtons.count() > 0
      )).toBe(true);
      if (await finishButton.isEnabled()) break;
      const nominationButton = nominationButtons.last();
      await expect(nominationButton).toBeVisible();
      await expect(nominationButton).toBeEnabled();
      await nominationButton.click();
    }
    await expect(page.getByRole("button", { name: "Abandon mock" })).toBeEnabled({ timeout: 15_000 });
  }

  // The simulated owners are still settling the last lots here, which takes
  // longer than a normal wait when the machine is busy.
  await expect(finishButton).toBeEnabled({ timeout: 30_000 });
  await finishButton.click();
  const results = page.getByRole("region", { name: "League results" });
  await expect(results).toBeVisible();
  const teamPanels = results.getByRole("article");
  await expect(teamPanels).toHaveCount(season.teams.length);
  await expect(results).toContainText(
    `Week 1 estimates available for all ${season.teams.length * season.settings.roster.rosterSize} rostered players.`,
  );

  for (const team of season.teams) {
    const panel = teamPanels.filter({ has: page.getByRole("heading", { name: team.displayName }) });
    await expect(panel).toHaveCount(1);
    await expect(panel).toContainText(/^#\d+/u);
    await expect(panel).toContainText(/\$\d+ spent · \$\d+ left/u);
    await expect(panel).toContainText(/\d+(?:\.\d+)? Week 1/u);
    await expect(panel.getByRole("row")).toHaveCount(season.settings.roster.rosterSize + 1);
  }

  const claimedTeam = season.teams.find(team => team.id === claimedTeamId);
  expect(claimedTeam).toBeDefined();
  const claimedPanel = teamPanels.filter({
    has: page.getByRole("heading", { name: claimedTeam?.displayName ?? "" }),
  });
  await expect(claimedPanel).toHaveCount(1);
  await expect(claimedPanel.getByText("Your team", { exact: true })).toBeVisible();
};
