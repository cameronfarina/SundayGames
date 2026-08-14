import { type Browser, type Page } from "@playwright/test";
import type { AccountRecord } from "../../../src/platform/auth.js";
import {
  expectAuthenticatedAccount,
  expectSignedOut,
  signOutThroughAccountMenu,
} from "../auth.js";
import { password } from "./environment.js";

export const signUpAndLogIn = async (
  page: Page,
  email: string,
): Promise<AccountRecord> => {
  await page.goto("/signup");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expectAuthenticatedAccount(page, email).catch(async error => {
    const authError = (await page.getByRole("alert").textContent())?.trim() ?? "";
    if (!authError.includes("already exists")) throw error;

    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expectAuthenticatedAccount(page, email, [
      `Smoke account ${email} already existed but could not sign in with the configured password.`,
      "Use a fresh MOCKD_E2E_RUN_ID or set MOCKD_E2E_PASSWORD to the password used for that run.",
      authError,
    ].join(" "));
  });

  await signOutThroughAccountMenu(page);
  await expectSignedOut(page);

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const account = await expectAuthenticatedAccount(page, email);

  return account;
};

export const pageForLocalFixtureUser = async (
  browser: Browser,
  email: string,
): Promise<{ page: Page; account: AccountRecord }> => {
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const account = await signUpAndLogIn(page, email);

  return { page, account };
};

export const pageForExistingUser = async (
  browser: Browser,
  email: string,
  accountPassword: string,
): Promise<{ page: Page; account: AccountRecord }> => {
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(accountPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const account = await expectAuthenticatedAccount(page, email, [
    `Could not sign in to the pre-provisioned smoke account ${email}.`,
    "Verify the deployed smoke credential secrets and run production provisioning verification.",
  ].join(" "));

  return { page, account };
};
