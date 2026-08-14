import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectAuthenticatedAccount } from "./support/auth.js";

const isDeployedSmoke = process.env.MOCKD_E2E_TARGET?.trim().toLowerCase() === "deployed";
const password = process.env.MOCKD_E2E_PASSWORD?.trim() || "e2e-secure-password";

const signUp = async (page: Page, email: string): Promise<void> => {
  await page.goto("/signup");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expectAuthenticatedAccount(page, email);
};

const expectStep = async (dialog: Locator, name: string): Promise<void> => {
  await expect(dialog.getByRole("heading", { name })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Back" })).toBeInViewport();
};

test("league setup follows the complete manual workflow", async ({ page }) => {
  test.skip(isDeployedSmoke, "League creation changes are not allowed against a deployed target.");

  await signUp(page, "league.setup.e2e@example.com");
  await page.goto("/league");
  await page.getByRole("link", { name: "Create a league" }).click();

  const dialog = page.getByRole("dialog", { name: "Input league info" });
  await expectStep(dialog, "League basics");
  await expect(dialog.getByRole("button", { name: "Back" })).toBeDisabled();
  await dialog.getByRole("textbox", { name: "League name" }).fill("League setup E2E");
  await dialog.getByRole("spinbutton", { name: "Number of teams" }).fill("4");
  await dialog.getByRole("button", { name: "Next" }).click();

  await expectStep(dialog, "Reference league");
  await dialog.getByRole("button", { name: "Enter settings manually" }).click();
  await expect(dialog.getByRole("status")).toContainText("Manual setup selected");
  await dialog.getByRole("button", { name: "Next" }).click();

  await expectStep(dialog, "Scoring rules");
  await dialog.getByRole("spinbutton", { name: "Points per reception" }).fill("1");
  await dialog.getByRole("button", { name: "Next" }).click();

  await expectStep(dialog, "Roster slots");
  await dialog.getByRole("spinbutton", { name: "Bench" }).fill("6");
  await dialog.getByRole("button", { name: "Next" }).click();

  await expectStep(dialog, "League teams");
  const finish = dialog.getByRole("button", { name: "Finish" });
  await expect(dialog.getByText("0 of 4 team names entered")).toBeVisible();
  await expect(finish).toBeDisabled();

  for (let index = 1; index <= 3; index += 1) {
    const team = dialog.getByRole("group", { name: `Team ${String(index)}` });
    await team.getByRole("textbox", { name: "Team name" }).fill(`Team ${String(index)}`);
  }
  await expect(dialog.getByText("3 of 4 team names entered")).toBeVisible();
  await expect(finish).toBeDisabled();

  const lastTeam = dialog.getByRole("group", { name: "Team 4" });
  await lastTeam.getByRole("textbox", { name: "Team name" }).fill("Team Four");
  await lastTeam.getByRole("textbox", { name: "Managers" }).fill("Cam, Mackie");
  await lastTeam.getByRole("textbox", { name: "Abbreviation" }).fill("CAM");
  await lastTeam.scrollIntoViewIfNeeded();
  await expect(dialog.getByRole("button", { name: "Back" })).toBeInViewport();
  await expect(finish).toBeInViewport();
  await expect(finish).toBeEnabled();
  await finish.click();

  await expect(page).toHaveURL(/\/league\?seasonId=/u);
  await expect(page.getByRole("heading", { name: "League setup E2E" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Claim your team" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "League settings" })).toBeVisible();
  await expect(page.getByText("1 PPR")).toBeVisible();
  await expect(page.getByText(/15 players/u)).toBeVisible();
  await expect(page.getByRole("link", { name: "Finish setup" })).toBeVisible();
});
