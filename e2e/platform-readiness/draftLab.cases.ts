import { expect, test } from "@playwright/test";
import { expectPracticeBoard, exercisePracticeBoardControls, practicePlayerRows } from "../support/practice.js";
import { pageForLocalFixtureUser } from "../support/platform-readiness/accounts.js";
import { exerciseBoardSimulations } from "../support/platform-readiness/boardSimulations.js";
import { isDeployedSmoke } from "../support/platform-readiness/environment.js";
import { exerciseDurableMockWorkspace } from "../support/platform-readiness/practiceWorkspace.js";
import { seedSeasonFromBrowser } from "../support/platform-readiness/seasons.js";

test("Draft Lab supports baseline browsing and league-aware planning", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const { page, account } = await pageForLocalFixtureUser(browser, "draft.lab.e2e@example.com");

  await page.goto("/practice");
  await expect(page.getByRole("heading", { name: "Draft lab" })).toBeVisible();
  await expectPracticeBoard(page, 500);
  await expect(page.getByText("Baseline values", { exact: true })).toBeVisible();
  await expect(practicePlayerRows(page).first().getByRole("button", {
    name: /Add .+ to draft targets/u,
  })).toBeDisabled();

  const season = await seedSeasonFromBrowser(page, account, "draft-lab-controls");
  await page.goto(`/practice?seasonId=${encodeURIComponent(season.id)}`);
  await expectPracticeBoard(page, 500);
  await exercisePracticeBoardControls(page);
  await expect(page.getByRole("link", { name: "Start auction mock" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run simulations" })).toBeVisible();
});

test("Draft Lab saves simulation runs and resumes an auction mock", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const { page, account } = await pageForLocalFixtureUser(browser, "draft.lab.runs.e2e@example.com");
  const season = await seedSeasonFromBrowser(page, account, "draft-lab-runs");

  await page.goto(`/practice?seasonId=${encodeURIComponent(season.id)}`);
  await expectPracticeBoard(page, 500);
  await exerciseBoardSimulations(page, season);
  await exerciseDurableMockWorkspace(page, season);
});
