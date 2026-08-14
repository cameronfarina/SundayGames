import { expect, type Page } from "@playwright/test";
import type { LeagueSeason } from "../../../src/platform/leagueSeason.js";
import { choosePracticeOption } from "../practice.js";

export const exerciseBoardSimulations = async (
  page: Page,
  season: LeagueSeason,
): Promise<void> => {
  const runNote = "Local E2E simulation history";
  const workspace = page.getByRole("region", { name: "Run full-league drafts" });
  await expect(workspace).toBeVisible();
  await workspace.getByLabel("Number of simulations").fill("2");
  await workspace.getByLabel("Additional draft instructions").fill("Target an elite RB");
  await workspace.getByLabel("Run label").fill(runNote);
  await workspace.getByRole("button", { name: "Run simulations" }).click();
  await expect(workspace.getByRole("button", { name: "Running simulations" })).toBeDisabled();
  const results = page.getByRole("region", { name: "League outcomes" });
  await expect(results).toBeVisible({ timeout: 30_000 });
  await expect(results.getByText("Completed", { exact: true }).locator("..")).toContainText("2 / 2");
  await expect(results.getByText("Format", { exact: true }).locator("..")).toContainText(/Auction|Snake/u);
  await expect(results.getByRole("combobox", { name: "Simulation run" })).toHaveText("Run 1");
  await expect(results.getByRole("article")).toHaveCount(season.teams.length);
  await expect(results.getByText("Your team", { exact: true })).toHaveCount(1);
  const assertLeagueRun = async (): Promise<void> => {
    const teams = results.getByRole("article");
    await expect(teams).toHaveCount(season.teams.length);
    for (let index = 0; index < season.teams.length; index += 1) {
      const team = teams.nth(index);
      await expect(team.getByText("Week 1", { exact: true })).toBeVisible();
      expect(await team.getByRole("row").count()).toBeGreaterThan(1);
      await expect(team.getByRole("columnheader", { name: "W1" })).toBeVisible();
    }
  };
  await assertLeagueRun();
  await choosePracticeOption(page, "Simulation run", "Run 2");
  await expect(results.getByRole("combobox", { name: "Simulation run" })).toHaveText("Run 2");
  await assertLeagueRun();
  await results.getByText("Player exposure across all runs", { exact: true }).click();
  expect(await results.getByRole("table").first().getByRole("row").count()).toBeGreaterThan(1);
  const history = workspace.getByRole("heading", { name: "Previous runs" }).locator("..");
  await expect(history).toContainText(runNote);
  await expect(history.getByRole("button", { name: /Open 2-run simulation/u })).toHaveCount(1);

  await page.reload();
  const restoredWorkspace = page.getByRole("region", { name: "Run full-league drafts" });
  const restoredHistory = restoredWorkspace.getByRole("heading", { name: "Previous runs" }).locator("..");
  await expect(restoredHistory).toContainText(runNote);
  await restoredHistory.getByRole("button", { name: /Open 2-run simulation/u }).click();
  const restoredResults = page.getByRole("region", { name: "League outcomes" });
  await expect(restoredResults).toBeVisible();
  await expect(restoredResults.getByText("Completed", { exact: true }).locator("..")).toContainText("2 / 2");
  await expect(restoredResults.getByRole("article")).toHaveCount(season.teams.length);
};
