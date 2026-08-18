import { expect, test, type Route } from "@playwright/test";
import { expectAuctionMockSetup } from "../support/mockDraft.js";
import { expectPracticeBoard } from "../support/practice.js";
import { pageForLocalFixtureUser } from "../support/platform-readiness/accounts.js";
import { isDeployedSmoke } from "../support/platform-readiness/environment.js";
import { seedSeasonFromBrowser } from "../support/platform-readiness/seasons.js";

test("a stale failed mock request cannot overwrite a newer mock session", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const { page, account } = await pageForLocalFixtureUser(browser, "stale.mock.e2e@example.com");
  const season = await seedSeasonFromBrowser(page, account, "stale-mock-load");
  await page.goto(`/practice?seasonId=${encodeURIComponent(season.id)}`);
  await expectPracticeBoard(page);
  await page.evaluate(() => {
    document.documentElement.dataset.staleMockDocument = "original";
  });

  const pendingFirstRequest: { route?: Route } = {};
  let requestCount = 0;
  await page.route("**/season-mock-drafts", async route => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    requestCount += 1;
    if (requestCount === 1) {
      pendingFirstRequest.route = route;
      return;
    }
    await route.fallback();
  });

  await page.getByRole("link", { name: "Start mock draft" }).click();
  await page.getByRole("button", { name: "Create mock draft" }).click();
  await expect.poll(() => pendingFirstRequest.route !== undefined).toBe(true);
  await page.getByRole("link", { name: "Practice", exact: true }).click();
  await page.getByRole("link", { name: "Start mock draft" }).click();
  await page.getByRole("button", { name: "Create mock draft" }).click();
  await expectAuctionMockSetup(page);
  await expect.poll(async () => await page.evaluate(() =>
    document.documentElement.dataset.staleMockDocument
  )).toBe("original");

  await pendingFirstRequest.route?.fulfill({
    status: 500,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "stale_failure", message: "Stale request failed." } }),
  });
  await expectAuctionMockSetup(page);
  await expect(page.getByText("Stale request failed.", { exact: true })).toHaveCount(0);
});
