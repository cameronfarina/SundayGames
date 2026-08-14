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

export const signOutThroughAccountMenu = async (page: Page): Promise<void> => {
  await accountMenuButton(page).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
};

export const expectSignedOut = async (page: Page): Promise<void> => {
  await expect(page).toHaveURL(/\/login(?:\?|$)/u);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(accountMenuButton(page)).toBeHidden();
};
