import { test } from "@playwright/test";
import {
  expectAuthenticatedAccount,
  expectSignedOut,
  signOutThroughAccountMenu,
} from "./support/auth.js";

const password = process.env.MOCKD_E2E_PASSWORD?.trim() || "e2e-secure-password";

test("an account can sign up, sign out, and sign back in", async ({ page }) => {
  const email = "account.auth.e2e@example.com";
  await page.goto("/signup");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expectAuthenticatedAccount(page, email);

  await signOutThroughAccountMenu(page);
  await expectSignedOut(page);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expectAuthenticatedAccount(page, email);
});
