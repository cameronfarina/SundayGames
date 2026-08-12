import { expect, test } from "@playwright/test";

const isDeployedSmoke = process.env.MOCKD_E2E_TARGET?.trim().toLowerCase() === "deployed";
const password = process.env.MOCKD_E2E_PASSWORD?.trim() || "e2e-secure-password";

const signUp = async (page: import("@playwright/test").Page, email: string): Promise<void> => {
  await page.goto("/signup");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("#account-email")).toHaveText(email);
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

test("available team screenshot analysis supports drag and drop before manual entry", async ({ page }) => {
  test.skip(isDeployedSmoke, "League creation changes are not allowed against a deployed target.");

  await page.route("**/league-imports/espn/members-screenshot-review", async route => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { available: true } });
      return;
    }
    await route.fulfill({
      json: {
        import: {
          leagueName: "Screenshot League",
          externalLeagueId: "214674",
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
  const createBody = (await createRequest).postDataJSON() as {
    setup: { provider: string; externalLeagueId: string; leagueName: string };
  };
  expect(createBody.setup).toMatchObject({ provider: "mockd", leagueName: "League setup E2E" });
  expect(createBody.setup.externalLeagueId).toMatch(/^mockd-/u);
  await expect(page).toHaveURL(/\/league\?seasonId=/u);
  await expect(page.getByRole("heading", { name: "League setup E2E" })).toBeVisible();
});

test("a stale screenshot response cannot replace a newer analysis", async ({ page }) => {
  test.skip(isDeployedSmoke, "League creation changes are not allowed against a deployed target.");

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
  const createBody = (await createRequest).postDataJSON() as {
    setup: { provider: string; externalLeagueId: string };
  };
  expect(createBody.setup.provider).toBe("mockd");
  expect(createBody.setup.externalLeagueId).toMatch(/^mockd-/u);
  await expect(page).toHaveURL(/\/league\?seasonId=/u);
});

test("leaving the teams step cancels screenshot analysis before editing basics", async ({ page }) => {
  test.skip(isDeployedSmoke, "League creation changes are not allowed against a deployed target.");

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
  test.skip(isDeployedSmoke, "League creation changes are not allowed against a deployed target.");

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
