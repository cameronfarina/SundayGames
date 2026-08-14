import { expect, test } from "@playwright/test";
import { z } from "zod";
import { accountMenuButton } from "./support/auth.js";
import {
  availablePlayersTable,
  createAuctionMock,
  expectAuctionMockSetup,
} from "./support/mockDraft.js";
import {
  api,
  emailDomain,
  expectNoControlOverlap,
  expectNoHorizontalPageOverflow,
  expectOk,
  isDeployedSmoke,
  leagueName,
  mobileViewport,
  playerCatalog,
  provisioningToken,
  requiredDeployedValue,
  roomId,
  seasonForMobileRelease,
  signInExisting,
  signUpAndLogIn,
  smokeRunId,
} from "./support/mobile.js";
import {
  choosePracticeOption,
  expectPracticeBoard,
  practiceBoard,
  practicePlayerRows,
} from "./support/practice.js";

const catalogBodySchema = z.object({
  personalized: z.boolean().optional(),
  players: z.array(z.record(z.string(), z.unknown())).optional(),
}).loose();

test.use({ viewport: mobileViewport, hasTouch: true, isMobile: true });

test("mobile shell and live draft preserve a commissioner sale through reconnect", async ({ page }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const email = smokeRunId === undefined
    ? "mobile.release.e2e@example.com"
    : `mobile.release.e2e+${smokeRunId}@${emailDomain}`;
  const account = await signUpAndLogIn(page, email);
  const season = seasonForMobileRelease();
  const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
  if (camTeam === undefined) throw new Error("Expected the Cam fixture team.");

  expectOk(await api(page, "/seasons", z.unknown(), {
    method: "POST",
    headers: { "x-mockd-provisioning-token": provisioningToken },
    body: {
      season,
      memberships: [{
        userId: account.id,
        leagueId: season.leagueId,
        role: "admin",
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
      }],
    },
  }));
  expectOk(await api(page, "/live-rooms", z.unknown(), {
    method: "POST",
    headers: { "x-mockd-provisioning-token": provisioningToken },
    body: {
      seasonId: season.id,
      roomId,
      viewerPasswordHashRef: "mobile-release-viewer-password-hash",
      playerCatalog,
      initialRosters: [{
        teamId: camTeam.id,
        playerName: "De'Von Achane",
        position: "RB",
        price: 50,
        expectedPrice: 50,
      }],
    },
  }));

  await page.route(
    url => url.pathname === "/player-catalog" && url.searchParams.has("seasonId"),
    async route => {
      const response = await route.fetch();
      const body = catalogBodySchema.parse(await response.json());
      body.personalized = true;
      body.players = (body.players ?? []).map((player, index) => ({
        ...player,
        ...(index === 0 ? { pricingWarnings: ["Limited league history; value confidence is lower."] } : {}),
      }));
      await route.fulfill({ response, json: body });
    },
    { times: 1 },
  );

  await page.goto(`/league?seasonId=${encodeURIComponent(season.id)}`);
  await expect(page.getByRole("heading", { name: leagueName })).toBeVisible();
  await expect(page.getByRole("link", { name: "Commissioner" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter draft" })).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
  await expectNoControlOverlap([
    accountMenuButton(page),
    page.getByRole("link", { name: "Enter draft" }),
  ]);

  await page.getByRole("link", { name: "Practice", exact: true }).click();
  await expect(page).toHaveURL(/\/practice\?seasonId=/);
  expect(new URL(page.url()).searchParams.get("seasonId")).toBe(season.id);
  await expectPracticeBoard(page, 500);
  const rankedTarget = practicePlayerRows(page).nth(7);
  const targetName = (await rankedTarget.getByRole("cell").nth(2).textContent())?.trim();
  const targetRank = (await rankedTarget.getByRole("cell").nth(1).textContent())?.trim();
  expect(targetName).toBeTruthy();
  expect(targetRank).toBeTruthy();
  const search = practiceBoard(page).getByRole("searchbox", { name: "Search players" });
  await search.fill(targetName ?? "");
  await expect(practicePlayerRows(page).first().getByRole("cell").nth(1)).toHaveText(targetRank ?? "");
  await search.fill("");
  await choosePracticeOption(page, "Sort players", "Rank");
  await expect(practicePlayerRows(page).first()).toBeVisible();
  await expectNoHorizontalPageOverflow(page);

  const mockSessionId = await createAuctionMock(page);
  await expectAuctionMockSetup(page);
  const rosterBox = await page.getByRole("region", { name: / roster$/u }).boundingBox();
  const boardBox = await availablePlayersTable(page).boundingBox();
  expect(rosterBox?.y).toBeLessThan(boardBox?.y ?? 0);
  await expectNoHorizontalPageOverflow(page);
  await expectNoControlOverlap([
    page.getByRole("button", { name: "Start draft" }),
    page.getByRole("button", { name: "Abandon mock" }),
  ]);
  await page.reload();
  await expectAuctionMockSetup(page);
  expect(new URL(page.url()).searchParams.get("sessionId")).toBe(mockSessionId);

  await page.getByRole("link", { name: "League", exact: true }).click();
  await expect(page.getByRole("heading", { name: leagueName })).toBeVisible();
  await page.getByRole("link", { name: "Enter draft" }).click();
  await expect(page.locator("#draft-room-view")).toBeVisible();
  await expect(page.locator("#draft-board-cards")).toBeVisible();
  await expect(page.locator("#draft-board-cards [data-player-name]")).toHaveCount(playerCatalog.length - 1);
  await expect(page.locator('#draft-board-cards [data-player-name="Puka Nacua"]')).toBeVisible();
  await expect(page.locator("#draft-current-team")).toHaveText("Your team: Cam");
  await expect(page.locator("#draft-team-budget")).toHaveText("$150");
  await expect(page.locator("#draft-team-roster")).toContainText("De'Von Achane");
  await expectNoHorizontalPageOverflow(page);
  await expectNoControlOverlap([
    page.locator("#draft-sale-command"),
    page.locator("#draft-log-sale"),
    page.locator("#draft-start"),
    page.locator("#draft-pause"),
    page.locator("#draft-undo"),
    page.locator("#draft-end"),
  ]);

  await page.locator("#draft-start").click();
  await expect(page.locator("#draft-room-status")).toHaveText("Live");
  await page.locator("#draft-sale-command").fill("cam puka 62");
  await page.locator("#draft-log-sale").click();
  await expect(page.locator("#draft-sales")).toContainText("Puka Nacua");
  await expect(page.locator("#draft-team-budget")).toHaveText("$88");
  await expect(page.locator("#draft-team-roster")).toContainText("Puka Nacua");

  await page.reload();
  await expect(page.locator("#draft-room-status")).toHaveText("Live");
  await expect(page.locator("#draft-connection-label")).toHaveText("Connected");
  await expect(page.locator("#draft-sales")).toContainText("Puka Nacua");
  await expect(page.locator("#draft-team-budget")).toHaveText("$88");
  await expect(page.locator("#draft-team-roster")).toContainText("Puka Nacua");
  await expect(page.locator('#draft-board-cards [data-player-name="Puka Nacua"]')).toHaveCount(0);
  await expectNoHorizontalPageOverflow(page);
});

test("deployed mobile shell renders the pre-provisioned smoke season without mutation", async ({ page }) => {
  test.skip(!isDeployedSmoke, "Pre-provisioned smoke credentials are only required for deployed E2E.");
  const email = requiredDeployedValue("MOCKD_E2E_DEPLOYED_COMMISSIONER_EMAIL");
  const accountPassword = requiredDeployedValue("MOCKD_E2E_DEPLOYED_COMMISSIONER_PASSWORD");
  const seasonId = requiredDeployedValue("MOCKD_E2E_DEPLOYED_SEASON_ID");
  await signInExisting(page, email, accountPassword);
  await page.goto(`/league?seasonId=${encodeURIComponent(seasonId)}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Commissioner" })).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
  await expectNoControlOverlap([accountMenuButton(page)]);
  await page.getByRole("link", { name: "Practice", exact: true }).click();
  await expect(page).toHaveURL(/\/practice\?seasonId=/);
  await expectPracticeBoard(page);
  await expectNoHorizontalPageOverflow(page);
});
