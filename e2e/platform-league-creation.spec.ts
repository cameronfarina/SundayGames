import { expect, test } from "@playwright/test";
import { expectAuthenticatedAccount } from "./support/auth.js";

const isDeployedSmoke = process.env.MOCKD_E2E_TARGET?.trim().toLowerCase() === "deployed";
const password = process.env.MOCKD_E2E_PASSWORD?.trim() || "e2e-secure-password";

const signUp = async (page: import("@playwright/test").Page, email: string): Promise<void> => {
  await page.goto("/signup");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expectAuthenticatedAccount(page, email);
};

test("league setup follows the complete manual workflow", async ({ page }) => {
  test.skip(isDeployedSmoke, "League creation changes are not allowed against a deployed target.");

  await signUp(page, "league.setup.e2e@example.com");

  await page.goto("/league?create=1");
  await page.getByRole("button", { name: "Input league info" }).click();

  const setupDialog = page.getByRole("dialog", { name: "Input league info" });
  await expect(setupDialog.getByRole("heading", { name: "League basics" })).toBeVisible();
  await expect(setupDialog.getByRole("button", { name: "Try ESPN import" })).toBeVisible();

  await setupDialog.getByLabel("League name").fill("League setup E2E");
  await setupDialog.getByLabel("Team count").fill("4");
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await expect(setupDialog.getByRole("heading", { name: "Scoring rules" })).toBeVisible();

  await setupDialog.getByRole("button", { name: "Next" }).click();
  await expect(setupDialog.getByRole("heading", { name: "Roster settings" })).toBeVisible();

  await setupDialog.getByRole("button", { name: "Next" }).click();
  await expect(setupDialog.getByRole("heading", { name: "Teams", exact: true })).toBeVisible();
  await expect(setupDialog.locator("#league-create-screenshot-panel")).toBeHidden();

  const teamNameInputs = setupDialog.getByLabel("Team name");
  for (let index = 0; index < 4; index += 1) {
    await teamNameInputs.nth(index).fill(`Team ${index + 1}`);
  }
  await teamNameInputs.nth(3).fill("Team 1");
  await expect(setupDialog.locator("#league-create-team-progress")).toHaveText(
    "Give each team a unique name before finishing.",
  );
  await expect(setupDialog.getByRole("button", { name: "Finish" })).toBeDisabled();
  await teamNameInputs.nth(3).fill("Team ... Four");
  await expect(setupDialog.getByRole("button", { name: "Finish" })).toBeEnabled();
  await setupDialog.getByRole("button", { name: "Finish" }).click();

  await expect(page).toHaveURL(/\/league\?seasonId=/u);
  await expect(page.locator("#team-claim-panel")).toBeVisible();
  await expect(page.locator("#league-setup-readiness-action")).toHaveText("Finish setup");
  await expect(page.locator("#team-claim-readiness-action")).toHaveText("Claim your team");
  await expect(page.locator("#live-draft-readiness-action")).toHaveText("Finish setup first");
  await expect.poll(async () => await page.evaluate(() => {
    const claim = document.querySelector("#team-claim-panel");
    const readiness = document.querySelector('[aria-label="League readiness"]');
    const settings = document.querySelector("#league-overview-title");
    if (!claim || !readiness || !settings) return false;
    return Boolean(claim.compareDocumentPosition(readiness) & Node.DOCUMENT_POSITION_FOLLOWING)
      && Boolean(readiness.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
});
