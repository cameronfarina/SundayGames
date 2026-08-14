import { expect, test, type Locator, type Page } from "@playwright/test";
import { leagueConfig, ownerOrder } from "../config/league.js";
import type { AccountRecord } from "../src/platform/auth.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../src/platform/liveDraftRooms.js";
import {
  accountMenuButton,
  expectAuthenticatedAccount,
  expectAuthenticatedSession,
  expectSignedOut,
  signOutThroughAccountMenu,
} from "./support/auth.js";
import {
  expectInvitationPage,
  expectTeamCanBeClaimed,
  invitationTeam,
} from "./support/invitations.js";
import {
  availablePlayersTable,
  createAuctionMock,
  expectAuctionMockSetup,
} from "./support/mockDraft.js";
import {
  choosePracticeOption,
  expectPracticeBoard,
  practiceBoard,
  practicePlayerRows,
} from "./support/practice.js";

const mobileViewport = { width: 390, height: 844 } as const;
const isDeployedSmoke = process.env.MOCKD_E2E_TARGET?.trim().toLowerCase() === "deployed";
const password = process.env.MOCKD_E2E_PASSWORD?.trim() || "e2e-secure-password";
const emailDomain = process.env.MOCKD_E2E_EMAIL_DOMAIN?.trim() || "example.com";
const provisioningToken = process.env.MOCKD_E2E_PROVISIONING_TOKEN?.trim() || "local-e2e-provisioning-token";
const smokeRunId = process.env.MOCKD_E2E_RUN_ID?.trim()
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
const namespace = smokeRunId === undefined || smokeRunId.length === 0 ? "local" : smokeRunId;
const leagueName = `Mobile Release League ${namespace}`;
const roomId = `room_mobile_release_${namespace.replace(/-/g, "_")}`;

interface JsonResponse<TBody> {
  status: number;
  body: TBody;
}

interface SeasonBody {
  season: LeagueSeason;
}

interface ClaimOnboardingBody {
  leagues: Array<{
    seasonId: string;
    membership: { teamId?: string };
  }>;
}

const playerCatalog = [
  { name: "Puka Nacua", position: "WR", expectedPrice: 73, teamAbbreviation: "LAR", byeWeek: 8 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72, teamAbbreviation: "DET", byeWeek: 8 },
  { name: "Amon-Ra St. Brown", position: "WR", expectedPrice: 67, teamAbbreviation: "DET", byeWeek: 8 },
  { name: "De'Von Achane", position: "RB", expectedPrice: 50, teamAbbreviation: "MIA", byeWeek: 12 },
  { name: "George Kittle", position: "TE", expectedPrice: 28, teamAbbreviation: "SF", byeWeek: 9 },
  { name: "Trevor Lawrence", position: "QB", expectedPrice: 9, teamAbbreviation: "JAC", byeWeek: 8 },
] as const satisfies readonly LiveDraftRoomPlayerCatalogEntry[];

const api = async <TBody>(
  page: Page,
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<JsonResponse<TBody>> =>
  await page.evaluate(async ({ requestPath, method, body, headers }) => {
    const request: RequestInit = {
      method,
      credentials: "same-origin",
      ...(headers === undefined ? {} : { headers }),
    };
    if (body !== undefined) {
      request.headers = { ...headers, "content-type": "application/json" };
      request.body = JSON.stringify(body);
    }
    const response = await fetch(requestPath, request);
    const text = await response.text();

    return {
      status: response.status,
      body: text.length === 0 ? null : JSON.parse(text),
    };
  }, {
    requestPath: path,
    method: options.method ?? "GET",
    body: options.body,
    headers: options.headers,
  }) as JsonResponse<TBody>;

const expectOk = <TBody>(response: JsonResponse<TBody>): TBody => {
  expect(response.status, JSON.stringify(response.body)).toBeGreaterThanOrEqual(200);
  expect(response.status, JSON.stringify(response.body)).toBeLessThan(300);
  return response.body;
};

const signUpAndLogIn = async (page: Page, email: string): Promise<AccountRecord> => {
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
    await expectAuthenticatedAccount(page, email);
  });

  await signOutThroughAccountMenu(page);
  await expectSignedOut(page);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const account = await expectAuthenticatedAccount(page, email);

  return account;
};

const signInExisting = async (page: Page, email: string, accountPassword: string): Promise<void> => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(accountPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expectAuthenticatedAccount(page, email, [
    `Could not sign in to the pre-provisioned mobile smoke account ${email}.`,
    "Verify the deployed smoke credential secrets and provisioning receipt.",
  ].join(" "));
};

const requiredDeployedValue = (key: string): string => {
  const value = process.env[key]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`Deployed mobile smoke requires ${key}. Provision the smoke records before running Playwright.`);
  }
  return value;
};

const seasonForMobileRelease = (): LeagueSeason => {
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName,
    setupStatus: "published",
  });
  const leagueId = `${season.leagueId}-mobile-${namespace}`;
  const seasonId = `${leagueId}-season-${season.seasonYear}`;

  return {
    ...season,
    id: seasonId,
    leagueId,
    league: {
      ...season.league,
      id: leagueId,
      externalLeagueId: `${season.league.externalLeagueId}-mobile-${namespace}`,
      name: leagueName,
    },
    teams: season.teams.map((team, index) => ({
      ...team,
      id: `${seasonId}-team-${String(index + 1).padStart(2, "0")}`,
      leagueSeasonId: seasonId,
      ownerId: `${team.ownerId}-mobile-${namespace}`,
    })),
  };
};

const expectNoHorizontalPageOverflow = async (page: Page): Promise<void> => {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(dimensions.viewportWidth).toBe(mobileViewport.width);
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
};

const expectNoControlOverlap = async (controls: readonly Locator[]): Promise<void> => {
  const boxes = await Promise.all(controls.map(async control => {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    if (box === null) throw new Error("Expected visible control bounds.");
    return box;
  }));

  for (const box of boxes) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(mobileViewport.width);
  }

  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      const left = boxes[leftIndex];
      const right = boxes[rightIndex];
      if (left === undefined || right === undefined) throw new Error("Expected control bounds.");
      const overlaps = left.x < right.x + right.width
        && left.x + left.width > right.x
        && left.y < right.y + right.height
        && left.y + left.height > right.y;
      expect(overlaps).toBe(false);
    }
  }
};

const expectBoundedScrollRegion = async (region: Locator): Promise<void> => {
  await expect(region).toBeVisible();
  const dimensions = await region.evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(dimensions.clientHeight).toBeLessThanOrEqual(520);
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
};

test.use({
  viewport: mobileViewport,
  hasTouch: true,
  isMobile: true,
});

test("shared league invitation requires deliberate mobile team claims for existing and new accounts", async ({ page }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const commissionerEmail = `mobile.invite.commissioner.${namespace}@${emailDomain}`;
  const existingMemberEmail = `mobile.invite.existing.${namespace}@${emailDomain}`;
  const newMemberEmail = `mobile.invite.new.${namespace}@${emailDomain}`;
  const commissioner = await signUpAndLogIn(page, commissionerEmail);
  const baseSeason = seasonForMobileRelease();
  const leagueId = `${baseSeason.leagueId}-invite`;
  const seasonId = `${baseSeason.id}-invite`;
  const season: LeagueSeason = {
    ...baseSeason,
    id: seasonId,
    leagueId,
    league: {
      ...baseSeason.league,
      id: leagueId,
      externalLeagueId: `${baseSeason.league.externalLeagueId}-invite`,
      name: `${leagueName} Invite`,
    },
    teams: baseSeason.teams.map(team => ({
      ...team,
      id: `${team.id}-invite`,
      leagueSeasonId: seasonId,
    })),
  };
  const commissionerTeam = season.teams[0];
  const existingMemberTeam = season.teams[1];
  const newMemberTeam = season.teams[2];
  if (commissionerTeam === undefined || existingMemberTeam === undefined || newMemberTeam === undefined) {
    throw new Error("Expected three mobile invite fixture teams.");
  }
  expectOk(await api<SeasonBody>(page, "/seasons", {
    method: "POST",
    headers: { "x-mockd-provisioning-token": provisioningToken },
    body: {
      season,
      memberships: [{
        userId: commissioner.id,
        leagueId,
        role: "owner",
        ownerId: commissionerTeam.ownerId,
        teamId: commissionerTeam.id,
      }],
    },
  }));
  const issued = expectOk(await api<{ invitation: { acceptPath: string } }>(page, "/invitations", {
    method: "POST",
    body: { seasonId },
  }));

  await signOutThroughAccountMenu(page);
  await expectSignedOut(page);
  await signUpAndLogIn(page, existingMemberEmail);
  await page.goto(issued.invitation.acceptPath);
  await expectInvitationPage(page, `${leagueName} Invite`, ownerOrder.length);
  const beforeExistingClaim = expectOk(await api<ClaimOnboardingBody>(page, "/onboarding"));
  expect(beforeExistingClaim.leagues.some(league => league.seasonId === seasonId)).toBe(false);
  const existingMemberRow = await expectTeamCanBeClaimed(page, existingMemberTeam.displayName);
  await Promise.all([
    page.waitForURL(/\/league\?seasonId=/),
    existingMemberRow.getByRole("button", { name: `Join as ${existingMemberTeam.displayName}` }).click(),
  ]);
  await expect(page.getByRole("heading", { name: `${leagueName} Invite` })).toBeVisible();
  const afterExistingClaim = expectOk(await api<ClaimOnboardingBody>(page, "/onboarding"));
  expect(afterExistingClaim.leagues.find(league => league.seasonId === seasonId)?.membership.teamId)
    .toBe(existingMemberTeam.id);
  await signOutThroughAccountMenu(page);
  await expectSignedOut(page);

  await page.goto(issued.invitation.acceptPath);
  await expectInvitationPage(page, `${leagueName} Invite`, ownerOrder.length);
  await expect(invitationTeam(page, existingMemberTeam.displayName)).toContainText("Claimed");
  await expect(page.getByRole("button", { name: /^Join as /u })).toHaveCount(0);
  await expectNoHorizontalPageOverflow(page);

  await page.getByRole("link", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(newMemberEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await Promise.all([
    page.waitForURL(/\/invite\?token=/),
    page.getByRole("button", { name: "Create account" }).click(),
  ]);
  await expectAuthenticatedSession(page, newMemberEmail);
  await expectInvitationPage(page, `${leagueName} Invite`, ownerOrder.length);
  const beforeClaim = expectOk(await api<ClaimOnboardingBody>(page, "/onboarding"));
  expect(beforeClaim.leagues.some(league => league.seasonId === seasonId)).toBe(false);
  const memberRow = await expectTeamCanBeClaimed(page, newMemberTeam.displayName);
  await expectNoHorizontalPageOverflow(page);
  await Promise.all([
    page.waitForURL(/\/league\?seasonId=/),
    memberRow.getByRole("button", { name: `Join as ${newMemberTeam.displayName}` }).click(),
  ]);
  await expect(page.getByRole("heading", { name: `${leagueName} Invite` })).toBeVisible();
  const afterClaim = expectOk(await api<ClaimOnboardingBody>(page, "/onboarding"));
  expect(afterClaim.leagues.find(league => league.seasonId === seasonId)?.membership.teamId)
    .toBe(newMemberTeam.id);
});

test("mobile shell and live draft preserve a commissioner sale through reconnect", async ({ page }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const email = smokeRunId === undefined
    ? "mobile.release.e2e@example.com"
    : `mobile.release.e2e+${smokeRunId}@${emailDomain}`;
  const account = await signUpAndLogIn(page, email);
  const season = seasonForMobileRelease();
  const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
  if (camTeam === undefined) throw new Error("Expected the Cam fixture team.");

  expectOk(await api<SeasonBody>(page, "/seasons", {
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
  expectOk(await api(page, "/live-rooms", {
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
      const body = await response.json() as {
        personalized?: boolean;
        players?: Array<Record<string, unknown>>;
      };
      body.personalized = true;
      body.players = (body.players || []).map((player, index) => ({
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
