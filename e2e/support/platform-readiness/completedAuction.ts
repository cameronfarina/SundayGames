import { expect, type Locator, type Page } from "@playwright/test";
import type { LeagueSeason } from "../../../src/platform/leagueSeason.js";
import {
  availablePlayersTable,
  createAuctionMock,
  startAuctionMock,
} from "../mockDraft.js";
import { expectPracticeBoard } from "../practice.js";

/**
 * The simulated owners settle lots while this file drives the draft, so a
 * button found one moment can be gone the next. Reads here are bounded: a
 * button that disappears means the board moved on, not that the test should
 * wait for it. An unbounded read waits for the whole test budget instead.
 */
const settleTimeout = 2_000;

const isReady = async (locator: Locator): Promise<boolean> => {
  try {
    return await locator.isEnabled({ timeout: settleTimeout });
  } catch {
    return false;
  }
};

const clickIfReady = async (locator: Locator): Promise<boolean> => {
  if (await locator.count() === 0) return false;
  try {
    await locator.click({ timeout: settleTimeout });
    return true;
  } catch {
    return false;
  }
};

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
    if (await isReady(finishButton)) break;

    const buyButton = page.getByRole("button", { name: /^Bid \$\d+$/u });
    const passButton = page.getByRole("button", { name: "Pass", exact: true });
    if (!await clickIfReady(buyButton) && !await clickIfReady(passButton)) {
      const nominationButtons = availablePlayersTable(page)
        .locator('button[aria-label^="Nominate "]:enabled');
      await expect.poll(async () => (
        await isReady(finishButton) || await nominationButtons.count() > 0
      ), { timeout: 30_000 }).toBe(true);
      if (await isReady(finishButton)) break;
      if (!await clickIfReady(nominationButtons.last())) continue;
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
