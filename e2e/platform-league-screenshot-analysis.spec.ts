import { expect, test } from "@playwright/test";
import { signUp } from "./support/auth.js";
import { objectRecord } from "./support/json.js";

test("available team screenshot analysis supports drag and drop before manual entry", async ({ page }) => {

  await page.route("**/league-imports/espn/members-screenshot-review", async route => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { available: true } });
      return;
    }
    await route.fulfill({
      json: {
        import: {
          leagueName: "Screenshot League",
          externalLeagueId: "100001",
          teams: Array.from({ length: 4 }, (_, index) => ({
            draftOrderPosition: index + 1,
            abbreviation: `T${index + 1}`,
            teamDisplayName: `Screenshot Team ${index + 1}`,
            managerDisplayNames: [`Manager ${index + 1}`],
            confidence: index === 0 ? "medium" : "high",
            issues: index === 0 ? ["Manager name was difficult to read."] : [],
            confirmed: false,
          })),
        },
      },
    });
  });
  await signUp(page, "league.screenshot.e2e@example.com");
  await page.goto("/league?create=1");
  await page.getByRole("button", { name: "Input league info" }).click();
  const setupDialog = page.getByRole("dialog", { name: "Input league info" });
  await setupDialog.getByLabel("League name").fill("League setup E2E");
  await setupDialog.getByLabel("Team count").fill("4");
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await setupDialog.getByRole("button", { name: "Next" }).click();

  const screenshotPanel = setupDialog.locator("#league-create-screenshot-panel");
  await expect(screenshotPanel).toBeVisible();
  await setupDialog.locator("#league-create-screenshot-dropzone").dispatchEvent("drop", {
    dataTransfer: await page.evaluateHandle(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array([137, 80, 78, 71])], "members.png", { type: "image/png" }));
      return transfer;
    }),
  });
  await expect(setupDialog.locator("#league-create-screenshot-status")).toContainText("members.png");
  await setupDialog.getByRole("button", { name: "Analyze screenshot" }).click();
  await expect(setupDialog.getByLabel("Team name").first()).toHaveValue("Screenshot Team 1");
  await expect(setupDialog.getByLabel("Manager names").first()).toHaveValue("Manager 1");
  await expect(setupDialog.getByText("Manager name was difficult to read.")).toBeVisible();
  await expect(setupDialog.getByRole("button", { name: "Finish" })).toBeDisabled();
  await setupDialog.getByRole("button", { name: "Back" }).click();
  await setupDialog.getByRole("button", { name: "Back" }).click();
  await setupDialog.getByRole("button", { name: "Back" }).click();
  await expect(setupDialog.getByRole("heading", { name: "League basics" })).toBeVisible();
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await expect(setupDialog.getByText("Manager name was difficult to read.")).toBeVisible();
  await expect(setupDialog.getByRole("button", { name: "Finish" })).toBeDisabled();
  await setupDialog.getByRole("checkbox", { name: "I checked Team 1" }).check();
  await expect(setupDialog.getByRole("button", { name: "Finish" })).toBeEnabled();
  const createRequest = page.waitForRequest(request =>
    request.method() === "POST" && new URL(request.url()).pathname === "/leagues");
  await setupDialog.getByRole("button", { name: "Finish" }).click();
  const createBody = objectRecord((await createRequest).postDataJSON(), "league request");
  const setup = objectRecord(createBody.setup, "league setup");
  expect(setup).toMatchObject({ provider: "mockd", leagueName: "League setup E2E" });
  expect(setup.externalLeagueId).toMatch(/^mockd-/u);
  await expect(page).toHaveURL(/\/league\?seasonId=/u);
  await expect(page.getByRole("heading", { name: "League setup E2E" })).toBeVisible();
});

test("a stale screenshot response cannot replace a newer analysis", async ({ page }) => {

  let analysisCount = 0;
  await page.route("**/league-imports/espn/members-screenshot-review", async route => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { available: true } });
      return;
    }
    analysisCount += 1;
    const currentAnalysis = analysisCount;
    if (currentAnalysis === 1) await new Promise(resolve => setTimeout(resolve, 250));
    await route.fulfill({
      json: {
        import: {
          teams: Array.from({ length: 4 }, (_, index) => ({
            draftOrderPosition: index + 1,
            abbreviation: `T${index + 1}`,
            teamDisplayName: `${currentAnalysis === 1 ? "Old" : "New"} Team ${index + 1}`,
            managerDisplayNames: [],
            confidence: "high",
            issues: [],
          })),
        },
      },
    });
  });

  await signUp(page, "league.screenshot.race.e2e@example.com");
  await page.goto("/league?create=1");
  await page.getByRole("button", { name: "Input league info" }).click();
  const setupDialog = page.getByRole("dialog", { name: "Input league info" });
  await setupDialog.getByLabel("League name").fill("Screenshot race E2E");
  await setupDialog.getByLabel("Team count").fill("4");
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await setupDialog.getByRole("button", { name: "Next" }).click();

  const dropScreenshot = async (name: string): Promise<void> => {
    await setupDialog.locator("#league-create-screenshot-dropzone").dispatchEvent("drop", {
      dataTransfer: await page.evaluateHandle(fileName => {
        const transfer = new DataTransfer();
        transfer.items.add(new File([new Uint8Array([137, 80, 78, 71])], fileName, { type: "image/png" }));
        return transfer;
      }, name),
    });
  };

  await dropScreenshot("old.png");
  const firstAnalysisRequest = page.waitForRequest(request =>
    request.method() === "POST"
      && new URL(request.url()).pathname === "/league-imports/espn/members-screenshot-review");
  await setupDialog.getByRole("button", { name: "Analyze screenshot" }).click();
  await firstAnalysisRequest;
  await dropScreenshot("new.png");
  await setupDialog.getByRole("button", { name: "Analyze screenshot" }).click();
  await expect(setupDialog.getByLabel("Team name").first()).toHaveValue("New Team 1");
  await page.waitForTimeout(350);
  await expect(setupDialog.getByLabel("Team name").first()).toHaveValue("New Team 1");
  const createRequest = page.waitForRequest(request =>
    request.method() === "POST" && new URL(request.url()).pathname === "/leagues");
  await setupDialog.getByRole("button", { name: "Finish" }).click();
  const createBody = objectRecord((await createRequest).postDataJSON(), "league request");
  const setup = objectRecord(createBody.setup, "league setup");
  expect(setup.provider).toBe("mockd");
  expect(setup.externalLeagueId).toMatch(/^mockd-/u);
  await expect(page).toHaveURL(/\/league\?seasonId=/u);
});

test("leaving the teams step cancels screenshot analysis before editing basics", async ({ page }) => {

  await page.route("**/league-imports/espn/members-screenshot-review", async route => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { available: true } });
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
    await route.fulfill({
      json: {
        import: {
          leagueName: "Stale screenshot name",
          teams: Array.from({ length: 4 }, (_, index) => ({
            draftOrderPosition: index + 1,
            abbreviation: `T${index + 1}`,
            teamDisplayName: `Stale Team ${index + 1}`,
            managerDisplayNames: [],
            confidence: "high",
            issues: [],
          })),
        },
      },
    });
  });

  await signUp(page, "league.screenshot.back.e2e@example.com");
  await page.goto("/league?create=1");
  await page.getByRole("button", { name: "Input league info" }).click();
  const setupDialog = page.getByRole("dialog", { name: "Input league info" });
  await setupDialog.getByLabel("League name").fill("Original league name");
  await setupDialog.getByLabel("Team count").fill("4");
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await setupDialog.locator("#league-create-screenshot-file").setInputFiles({
    name: "members.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  const analysisRequest = page.waitForRequest(request =>
    request.method() === "POST"
      && new URL(request.url()).pathname === "/league-imports/espn/members-screenshot-review");
  await setupDialog.getByRole("button", { name: "Analyze screenshot" }).click();
  await analysisRequest;
  await setupDialog.getByRole("button", { name: "Back" }).click();
  await setupDialog.getByRole("button", { name: "Back" }).click();
  await setupDialog.getByRole("button", { name: "Back" }).click();
  await setupDialog.getByLabel("League name").fill("My edited league name");
  await page.waitForTimeout(350);
  await expect(setupDialog.getByLabel("League name")).toHaveValue("My edited league name");
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await expect(setupDialog.getByRole("button", { name: "Analyze screenshot" })).toBeEnabled();
  await expect(setupDialog.locator("#league-create-screenshot-status")).toHaveText(
    "members.png is ready to analyze.",
  );
});

test("duplicate screenshot team numbers are rejected before prefilling teams", async ({ page }) => {

  await page.route("**/league-imports/espn/members-screenshot-review", async route => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { available: true } });
      return;
    }
    await route.fulfill({
      json: {
        import: {
          teams: Array.from({ length: 4 }, (_, index) => ({
            draftOrderPosition: index === 3 ? 3 : index + 1,
            abbreviation: `T${index + 1}`,
            teamDisplayName: `Duplicate Team ${index + 1}`,
            managerDisplayNames: [],
            confidence: "high",
            issues: [],
          })),
        },
      },
    });
  });

  await signUp(page, "league.screenshot.duplicate.e2e@example.com");
  await page.goto("/league?create=1");
  await page.getByRole("button", { name: "Input league info" }).click();
  const setupDialog = page.getByRole("dialog", { name: "Input league info" });
  await setupDialog.getByLabel("League name").fill("Screenshot duplicate E2E");
  await setupDialog.getByLabel("Team count").fill("4");
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await setupDialog.getByRole("button", { name: "Next" }).click();
  await setupDialog.locator("#league-create-screenshot-dropzone").dispatchEvent("drop", {
    dataTransfer: await page.evaluateHandle(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array([137, 80, 78, 71])], "duplicate.png", { type: "image/png" }));
      return transfer;
    }),
  });
  await setupDialog.getByRole("button", { name: "Analyze screenshot" }).click();

  await expect(setupDialog.locator("#league-create-screenshot-status")).toContainText("unique team number");
  await expect(setupDialog.getByLabel("Team name").first()).toHaveValue("");
});
