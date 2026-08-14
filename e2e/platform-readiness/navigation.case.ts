import { expect, test } from "@playwright/test";
import { accountMenuButton, expectAuthenticatedAccount, expectSignedOut, signOutThroughAccountMenu } from "../support/auth.js";
import { expectPracticeBoard, exercisePracticeBoardControls } from "../support/practice.js";
import { pageForLocalFixtureUser } from "../support/platform-readiness/accounts.js";
import { isDeployedSmoke } from "../support/platform-readiness/environment.js";
import { seedSeasonFromBrowser } from "../support/platform-readiness/seasons.js";

test("primary navigation stays in the current document and the account menu dismisses accessibly", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const email = "soft.navigation.e2e@example.com";
  const { page, account } = await pageForLocalFixtureUser(browser, email);
  const season = await seedSeasonFromBrowser(page, account, "soft-navigation");
  const requestCounts = {
    document: 0,
    onboarding: 0,
    session: 0,
  };

  page.on("request", request => {
    const requestUrl = new URL(request.url());
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      requestCounts.document += 1;
    }
    if (requestUrl.pathname === "/onboarding") requestCounts.onboarding += 1;
    if (requestUrl.pathname === "/session") requestCounts.session += 1;
  });

  await page.goto(`/practice?seasonId=${encodeURIComponent(season.id)}`);
  await expectPracticeBoard(page);
  await exercisePracticeBoardControls(page);
  expect(requestCounts).toEqual({ document: 1, onboarding: 1, session: 1 });

  const documentId = "soft-navigation-document";
  await page.evaluate(id => {
    document.documentElement.dataset.softNavigationDocument = id;
  }, documentId);
  const expectCurrentDocument = async (sessionCalls = 1): Promise<void> => {
    await expect.poll(async () => await page.evaluate(() =>
      document.documentElement.dataset.softNavigationDocument
    )).toBe(documentId);
    expect(requestCounts).toEqual({ document: 1, onboarding: 1, session: sessionCalls });
  };

  await page.getByRole("link", { name: "League", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/league\\?seasonId=${season.id}$`, "u"));
  await expect(page.getByRole("heading", { name: season.league.name })).toBeVisible();
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page).toHaveTitle("League | Mockd");
  await expectCurrentDocument();

  await page.getByRole("link", { name: "My team", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/my-team\\?seasonId=${season.id}$`, "u"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/.+/u);
  await expectCurrentDocument();

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/league\\?seasonId=${season.id}$`, "u"));
  await expect(page.getByRole("heading", { name: season.league.name })).toBeVisible();
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page).toHaveTitle("League | Mockd");
  await expectCurrentDocument();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/practice\\?seasonId=${season.id}$`, "u"));
  await expect(page.getByRole("heading", { name: "Draft lab" })).toBeVisible();
  await expect(page.getByRole("main")).toBeFocused();
  await expectPracticeBoard(page);
  await expect(page).toHaveTitle("Draft lab | Mockd");
  await expectCurrentDocument();
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/league\\?seasonId=${season.id}$`, "u"));
  await expect(page.getByRole("heading", { name: season.league.name })).toBeVisible();
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page).toHaveTitle("League | Mockd");
  await expectCurrentDocument();
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/my-team\\?seasonId=${season.id}$`, "u"));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page).toHaveTitle("My team | Mockd");
  await expectCurrentDocument();

  const menuButton = accountMenuButton(page);
  const accountMenu = page.getByRole("menu");
  await menuButton.click();
  await expect(accountMenu).toBeVisible();
  await page.getByRole("main").click({ position: { x: 10, y: 10 } });
  await expect(accountMenu).toBeHidden();

  await menuButton.click();
  await expect(accountMenu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(accountMenu).toBeHidden();
  await expect(menuButton).toBeFocused();

  let rejectSignOut = true;
  await page.route("**/session", async route => {
    if (route.request().method() === "DELETE" && rejectSignOut) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "internal_error", message: "Something went wrong." } }),
      });
      return;
    }
    await route.continue();
  });
  await signOutThroughAccountMenu(page);
  await expect(page.getByRole("alert")).toHaveText("Could not sign out. Try again.");
  await expectAuthenticatedAccount(page, email);
  await expect(page).toHaveURL(new RegExp(`/my-team\\?seasonId=${season.id}$`, "u"));
  await expectCurrentDocument(3);

  rejectSignOut = false;
  await signOutThroughAccountMenu(page);
  await expectSignedOut(page);
  await expectCurrentDocument(4);
});
