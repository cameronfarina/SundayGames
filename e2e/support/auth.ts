import { expect, type Locator, type Page } from "@playwright/test";
import { z } from "zod";
import type { AccountRecord } from "../../src/platform/auth.js";

const accountSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  emailVerifiedAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const sessionSchema = z.object({ account: accountSchema });
const defaultPassword = process.env.MOCKD_E2E_PASSWORD?.trim() || "e2e-secure-password";

export const accountMenuButton = (page: Page): Locator =>
  page.getByRole("button", { name: "Account menu" });

export const expectAuthenticatedSession = async (
  page: Page,
  email: string,
  failureMessage?: string,
): Promise<AccountRecord> => {
  const response = await page.evaluate(async () => {
    const session = await fetch("/session", { credentials: "same-origin" });
    return { body: await session.json(), status: session.status };
  });

  expect(response.status, failureMessage).toBe(200);
  const parsed = sessionSchema.safeParse(response.body);
  expect(parsed.success, failureMessage).toBe(true);
  if (!parsed.success) throw new Error(`Invalid session response: ${parsed.error.message}`);
  expect(parsed.data.account.email, failureMessage).toBe(email);

  return parsed.data.account;
};

export const expectAuthenticatedAccount = async (
  page: Page,
  email: string,
  failureMessage?: string,
): Promise<AccountRecord> => {
  await expect(accountMenuButton(page), failureMessage).toBeVisible();
  return await expectAuthenticatedSession(page, email, failureMessage);
};

export const completeRequiredAccountSetup = async (page: Page): Promise<void> => {
  const statuses = await page.evaluate(async () => {
    const sessionResponse = await fetch("/session", { credentials: "same-origin" });
    const sessionBody: unknown = await sessionResponse.json();
    if (sessionBody === null || typeof sessionBody !== "object") throw new Error("Missing session.");
    const account: unknown = Reflect.get(sessionBody, "account");
    if (account === null || typeof account !== "object") throw new Error("Missing account.");
    const accountId: unknown = Reflect.get(account, "id");
    if (typeof accountId !== "string") throw new Error("Missing account id.");
    const actions = [
      { accountId, action: "set_intent", intent: "practice" },
      { accountId, action: "set_providers", providers: ["none"] },
      { accountId, action: "complete" },
    ];
    const results: number[] = [];
    for (const body of actions) {
      const response = await fetch("/account-onboarding", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      results.push(response.status);
    }
    return results;
  });
  expect(statuses).toEqual([200, 200, 200]);
  await page.reload();
};

export type SignupOutcome = "authenticated" | "error";

export const waitForSignupOutcome = async (page: Page): Promise<SignupOutcome> => {
  const waitForWizard = async (): Promise<SignupOutcome> => {
    await page.getByRole("dialog", { name: "Welcome to Sunday Games" }).waitFor();
    return "authenticated";
  };
  const waitForError = async (): Promise<SignupOutcome> => {
    await page.getByRole("alert").waitFor();
    return "error";
  };

  return await Promise.race([waitForWizard(), waitForError()]);
};

export const signUp = async (
  page: Page,
  email: string,
  password = defaultPassword,
): Promise<void> => {
  await page.goto("/signup");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  expect(await waitForSignupOutcome(page)).toBe("authenticated");
  await expectAuthenticatedSession(page, email);
  await completeRequiredAccountSetup(page);
  await expectAuthenticatedAccount(page, email);
};

export const signOutThroughAccountMenu = async (page: Page): Promise<void> => {
  await accountMenuButton(page).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
};

export const expectSignedOut = async (page: Page): Promise<void> => {
  await expect(page).toHaveURL(/\/login(?:\?|$)/u);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(accountMenuButton(page)).toBeHidden();
};
