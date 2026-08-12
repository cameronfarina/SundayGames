import { expect, test } from "@playwright/test";

const isDeployedSmoke = process.env.MOCKD_E2E_TARGET?.trim().toLowerCase() === "deployed";
const password = process.env.MOCKD_E2E_PASSWORD?.trim() || "e2e-secure-password";

test("league setup follows the complete manual workflow", async ({ page }) => {
  test.skip(isDeployedSmoke, "League creation changes are not allowed against a deployed target.");

  await page.goto("/signup");
  await page.getByLabel("Email", { exact: true }).fill("league.setup.e2e@example.com");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("#account-email")).toHaveText("league.setup.e2e@example.com");

  await page.goto("/league?create=1");
  await page.getByRole("button", { name: "Input league info" }).click();

  const setupDialog = page.getByRole("dialog", { name: "Input league info" });
  await expect(setupDialog.getByRole("heading", { name: "League basics" })).toBeVisible();
  await expect(setupDialog.getByRole("button", { name: "Try ESPN import" })).toBeVisible();
  await expect(setupDialog.locator('input[type="file"]')).toHaveCount(0);

  await setupDialog.getByLabel("League name").fill("League setup E2E");
  await setupDialog.getByLabel("Team count").fill("4");
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await expect(setupDialog.getByRole("heading", { name: "Scoring rules" })).toBeVisible();

  await setupDialog.getByRole("button", { name: "Next" }).click();
  await expect(setupDialog.getByRole("heading", { name: "Roster settings" })).toBeVisible();

  await setupDialog.getByRole("button", { name: "Next" }).click();
  await expect(setupDialog.getByRole("heading", { name: "Teams", exact: true })).toBeVisible();
  await expect(setupDialog.getByRole("button", { name: "Finish" })).toBeDisabled();
});
