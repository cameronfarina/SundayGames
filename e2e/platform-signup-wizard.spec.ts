import { expect, test } from "@playwright/test";
import {
  accountMenuButton,
  expectAuthenticatedSession,
  waitForSignupOutcome,
} from "./support/auth.js";

const password = process.env.MOCKD_E2E_PASSWORD?.trim() || "e2e-secure-password";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test("new account setup is required, resumable, and mobile friendly", async ({ page }) => {
  const email = "signup.wizard.e2e@example.com";
  await page.goto("/signup");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  expect(await waitForSignupOutcome(page)).toBe("authenticated");
  await expectAuthenticatedSession(page, email);

  const dialog = page.getByRole("dialog", { name: "Welcome to Sunday Games" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await page.getByTestId("dialog-overlay").click({ force: true, position: { x: 4, y: 4 } });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("radio", { name: /Practice for a draft/u }).check();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByText("Step 2 of 3")).toBeVisible();
  await expect.poll(async () => await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") ?? ""
  )).toContain("Step 2 of 3");

  await page.reload();
  await expect(dialog.getByText("Step 2 of 3")).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "Yahoo" })).toHaveCount(0);
  await dialog.getByRole("checkbox", { name: "ESPN" }).check();
  await dialog.getByRole("button", { name: "Continue" }).click();

  await expect(dialog.getByRole("heading", { exact: true, name: "ESPN" })).toBeVisible();
  await expect(dialog.getByLabel("ESPN league ID or league URL")).toHaveCount(0);
  await expect(dialog.getByLabel("espn_s2 cookie")).toBeVisible();
  await dialog.getByRole("button", { name: "I'm on mobile" }).click();
  await expect(dialog.getByText(/ESPN account connection requires a desktop browser/u))
    .toBeVisible();
  await expect(dialog.getByLabel("espn_s2 cookie")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Finish setup" }).click();

  await expect(dialog).toBeHidden();
  await expect(accountMenuButton(page)).toBeVisible();
});
