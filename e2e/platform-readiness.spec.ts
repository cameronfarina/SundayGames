import { expect, test, type Browser, type Page } from "@playwright/test";
import { leagueConfig, ownerOrder } from "../config/league.js";
import type { AccountRecord } from "../src/platform/auth.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../src/platform/leagueSeason.js";
import type { LiveDraftRoom } from "../src/platform/liveDraftRooms.js";
import type { PlatformLeagueMembership } from "../src/platform/platformApp.js";
import { leagueSeasonSetupRevision } from "../src/platform/leagueSetup.js";
import type { PlatformOnboardingLeague } from "../src/platform/platformOnboarding.js";
import type { PricingSnapshot } from "../src/platform/pricingSnapshots.js";

const isDeployedSmoke = process.env.MOCKD_E2E_TARGET?.trim().toLowerCase() === "deployed";

interface DeployedSmokeEnvironment {
  commissionerEmail: string;
  commissionerPassword: string;
  memberEmail: string;
  memberPassword: string;
  seasonId: string;
}

const requiredDeployedEnvironment = (): DeployedSmokeEnvironment => {
  const required = (key: string): string => {
    const value = process.env[key]?.trim();
    if (value === undefined || value.length === 0) {
      throw new Error(`Deployed platform smoke requires ${key}. Provision the smoke records before running Playwright.`);
    }
    return value;
  };

  return {
    commissionerEmail: required("MOCKD_E2E_DEPLOYED_COMMISSIONER_EMAIL"),
    commissionerPassword: required("MOCKD_E2E_DEPLOYED_COMMISSIONER_PASSWORD"),
    memberEmail: required("MOCKD_E2E_DEPLOYED_MEMBER_EMAIL"),
    memberPassword: required("MOCKD_E2E_DEPLOYED_MEMBER_PASSWORD"),
    seasonId: required("MOCKD_E2E_DEPLOYED_SEASON_ID"),
  };
};

const smokeRunIdFromEnv = (): string | undefined => {
  const rawSmokeRunId = process.env.MOCKD_E2E_RUN_ID?.trim();
  if (rawSmokeRunId === undefined || rawSmokeRunId.length === 0) return undefined;

  const normalizedSmokeRunId = rawSmokeRunId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalizedSmokeRunId.length === 0) {
    throw new Error("MOCKD_E2E_RUN_ID must contain at least one letter or number.");
  }

  return normalizedSmokeRunId;
};

const smokeRunId = smokeRunIdFromEnv();
const password = process.env.MOCKD_E2E_PASSWORD?.trim() || "e2e-secure-password";
const emailDomain = process.env.MOCKD_E2E_EMAIL_DOMAIN?.trim() || "example.com";
const baseLeagueName = "E2E League 214674";
const leagueName = smokeRunId === undefined ? baseLeagueName : `${baseLeagueName} ${smokeRunId}`;
const exportedAt = "2026-08-09T15:30:00.000Z";
const provisioningToken = process.env.MOCKD_E2E_PROVISIONING_TOKEN?.trim() || "local-e2e-provisioning-token";

interface JsonResponse<TBody> {
  status: number;
  body: TBody;
}

interface AccountBody {
  account: AccountRecord;
}

interface SeasonBody {
  season: LeagueSeason;
}

interface LiveDraftRoomBody {
  room: LiveDraftRoom;
}

interface PricingSnapshotsBody {
  pricingSnapshots: readonly PricingSnapshot[];
}

interface EventsBody {
  events: {
    currentRevision: number;
    events: Array<{
      event: string;
      revision: number;
      data: unknown;
    }>;
  };
}

interface ExportArtifactBody {
  artifact: {
    id: string;
    format: string;
    sourceRevision: number;
    byteLength: number;
    contentType: string;
  };
  content: string;
}

interface OnboardingBody {
  leagues: readonly PlatformOnboardingLeague[];
}

interface ReadySmokeWorkspace {
  commissionerPage: Page;
  memberPage: Page;
  season: LeagueSeason;
  room: LiveDraftRoom;
  commissionerOwnerName: string;
  memberOwnerName: string;
  commissionerTeamName: string;
  memberTeamName: string;
  salePlayerName: string;
  salePrice: number;
  expectedExportedInitialPlayer?: string | undefined;
}

interface BrowserSseEvent {
  type: string;
  lastEventId: string;
  data: unknown;
}

const expectOk = <TBody>(response: JsonResponse<TBody>): TBody => {
  const responseBody = JSON.stringify(response.body);
  expect(response.status, responseBody).toBeGreaterThanOrEqual(200);
  expect(response.status, responseBody).toBeLessThan(300);

  return response.body;
};

const cleanIdFragment = (value: string): string => {
  const cleanValue = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleanValue.length === 0 ? "smoke" : cleanValue;
};

const emailFor = (name: "cam" | "seth" | "hoody"): string =>
  smokeRunId === undefined
    ? `${name}.e2e@example.com`
    : `${name}.e2e+${smokeRunId}@${emailDomain}`;

const namespacedSeasonForSmoke = (season: LeagueSeason): LeagueSeason => {
  if (smokeRunId === undefined) return season;

  const leagueId = `${season.leagueId}-${smokeRunId}`;
  const seasonId = `${leagueId}-season-${season.seasonYear}`;

  return {
    ...season,
    id: seasonId,
    leagueId,
    league: {
      ...season.league,
      id: leagueId,
      externalLeagueId: `${season.league.externalLeagueId}-${smokeRunId}`,
      name: leagueName,
    },
    teams: season.teams.map((team, index) => {
      const ownerSlug = cleanIdFragment(team.ownerDisplayName);

      return {
        ...team,
        id: `${seasonId}-team-${String(index + 1).padStart(2, "0")}-${ownerSlug}`,
        leagueSeasonId: seasonId,
        ownerId: `${team.ownerId}-${smokeRunId}`,
      };
    }),
  };
};

const api = async <TBody>(
  page: Page,
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<JsonResponse<TBody>> =>
  await page.evaluate(async ({ path: requestPath, method, body, headers }) => {
    const init: RequestInit = {
      credentials: "same-origin",
      ...(method === undefined ? {} : { method }),
      ...(headers === undefined ? {} : { headers }),
    };
    if (body !== undefined) {
      init.headers = { ...headers, "content-type": "application/json" };
      init.body = JSON.stringify(body);
    }
    const response = await fetch(requestPath, init);
    const text = await response.text();

    return {
      status: response.status,
      body: text.length === 0 ? null : JSON.parse(text),
    };
  }, {
    path,
    method: options.method ?? "GET",
    body: options.body,
    headers: options.headers,
  }) as JsonResponse<TBody>;

const signUpAndLogIn = async (
  page: Page,
  email: string,
): Promise<AccountRecord> => {
  await page.goto("/signup");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("#account-menu-email")).toHaveText(email).catch(async error => {
    const authError = (await page.locator("#auth-error").textContent())?.trim() ?? "";
    if (!authError.includes("already exists")) throw error;

    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("#account-menu-email"), [
      `Smoke account ${email} already existed but could not sign in with the configured password.`,
      "Use a fresh MOCKD_E2E_RUN_ID or set MOCKD_E2E_PASSWORD to the password used for that run.",
      authError,
    ].join(" ")).toHaveText(email);
  });

  await page.locator("#account-menu-button").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.locator("#auth-panel")).toBeVisible();

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#account-menu-email")).toHaveText(email);

  return expectOk(await api<AccountBody>(page, "/session")).account;
};

const pageForLocalFixtureUser = async (
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

const pageForExistingUser = async (
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
  await expect(page.locator("#account-menu-email"), [
    `Could not sign in to the pre-provisioned smoke account ${email}.`,
    "Verify the deployed smoke credential secrets and run production provisioning verification.",
  ].join(" ")).toHaveText(email);

  return {
    page,
    account: expectOk(await api<AccountBody>(page, "/session")).account,
  };
};

const teamByOwner = (
  season: LeagueSeason,
  ownerDisplayName: string,
): LeagueSeason["teams"][number] => {
  const team = season.teams.find(candidate => candidate.ownerDisplayName === ownerDisplayName);
  if (team === undefined) throw new Error(`Expected ${ownerDisplayName} team.`);

  return team;
};

const setupRowsFor = (camEmail: string): string =>
  [
    "owner,team,email,role",
    ...ownerOrder.map(owner => {
      const email = owner === "Cam" ? camEmail : "";
      const role = owner === "Cam" ? "admin" : "member";

      return `${owner},${owner},${email},${role}`;
    }),
  ].join("\n");

const seedSeasonFromBrowser = async (
  page: Page,
  camAccount: AccountRecord,
): Promise<LeagueSeason> => {
  const season = namespacedSeasonForSmoke(buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName,
    setupStatus: "draft",
  }));
  const camTeam = teamByOwner(season, "Cam");

  return expectOk(await api<SeasonBody>(page, "/seasons", {
    method: "POST",
    headers: { "x-mockd-provisioning-token": provisioningToken },
    body: {
      season,
      memberships: [
        {
          userId: camAccount.id,
          leagueId: season.leagueId,
          role: "admin",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
    },
  })).season;
};

const applyCommissionerSetup = async (
  page: Page,
  season: LeagueSeason,
  camEmail: string,
): Promise<string> => {
  await page.goto(`/setup?seasonId=${encodeURIComponent(season.id)}`);
  await expect(page.locator("#account-menu-email")).toHaveText(camEmail);
  await expect(page.locator("#setup-season-id-input")).toHaveValue(season.id);
  await page.getByText("Advanced: paste a team list", { exact: true }).click();
  await page.locator("#setup-rows-input").fill(setupRowsFor(camEmail));
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.locator("#setup-status")).toHaveText("Ready to apply.");
  await expect(page.locator("#setup-preview-body tr")).toHaveCount(ownerOrder.length);
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect(page.locator("#setup-status")).toHaveText("League setup updated.");
  await page.getByRole("button", { name: "Create league link" }).click();
  await expect(page.locator("#league-invite-link-row")).toBeVisible();
  const invitationUrl = await page.locator("#league-invite-link-input").inputValue();
  expect(invitationUrl).toContain("/invite?token=");
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.locator("#invitation-create-status")).toHaveText("League link copied.");
  await page.reload();
  await expect(page.locator("#league-invite-link-row")).toBeVisible();
  await expect(page.locator("#league-invite-link-input")).toHaveValue(invitationUrl);
  await expect(page.getByRole("button", { name: "Generate new link" })).toBeVisible();

  const finalReview = page.locator("#setup-final-review");
  const publishButton = page.getByRole("button", { name: "Publish league" });
  const createRoomButton = page.getByRole("button", { name: "Create draft room" });
  await expect(page.locator("#setup-settings-summary")).toContainText("$200 auction");
  await expect(finalReview).not.toBeChecked();
  await expect(publishButton).toBeDisabled();
  await expect(createRoomButton).toBeDisabled();
  await finalReview.check();
  await expect(publishButton).toBeEnabled();
  await publishButton.click();
  await expect(page.locator("#live-room-setup-status")).toHaveText(
    "League setup published. The shared draft room can now be created.",
  );
  await expect(finalReview).toBeChecked();
  await expect(finalReview).toBeDisabled();
  await expect(createRoomButton).toBeEnabled();

  await page.goto(`/league?seasonId=${encodeURIComponent(season.id)}`);
  await expect(page.locator("#live-draft-readiness-action")).toHaveText("Create draft room");
  await expect(page.locator("#open-live-draft-button")).toHaveText("Create draft room");
  await page.locator("#live-draft-readiness-action").click();
  await expect(page).toHaveURL(new RegExp(`/setup\\?seasonId=${season.id}#live-room-setup-title$`, "u"));
  await expect(page.locator("#setup-season-id-input")).toHaveValue(season.id);
  await expect(page.getByRole("button", { name: "Create draft room" })).toBeEnabled();

  return invitationUrl;
};

const openUnifiedBoard = async (
  page: Page,
  seasonId: string,
  expectedPlayerCount?: number,
): Promise<void> => {
  await page.getByRole("link", { name: "Practice", exact: true }).click();
  await expect(page).toHaveURL(/\/practice\?seasonId=/);
  expect(new URL(page.url()).searchParams.get("seasonId")).toBe(seasonId);
  await expect(page.locator("#standalone-board")).toBeVisible();
  await expect(page.locator("#standalone-player-rows .player-name").first()).toBeVisible();
  await expect(page.locator("#standalone-board-status")).toContainText("loaded");
  await expect(page.locator("#standalone-board-sort")).toHaveValue(/market|mine/);
  await expect(page.locator("#standalone-pricing-source")).toContainText("Market uses");
  const boardViewport = await page.locator("#standalone-player-scroll").evaluate(element => ({
    clientHeight: element.clientHeight,
    maxHeight: getComputedStyle(element).maxHeight,
  }));
  expect(boardViewport.clientHeight).toBeLessThanOrEqual(720);
  expect(boardViewport.maxHeight).not.toBe("none");
  if (expectedPlayerCount !== undefined) {
    await expect(page.locator("#standalone-player-rows tr")).toHaveCount(expectedPlayerCount);
    await expect(page.locator("#standalone-board-status")).toContainText(
      `${expectedPlayerCount} shown / ${expectedPlayerCount} loaded`,
    );
  }
};

const exerciseDurableMockWorkspace = async (
  page: Page,
  season: LeagueSeason,
): Promise<void> => {
  await page.locator("#standalone-board-open-mock").click();
  await expect(page).toHaveURL(/\/mock-drafts\?seasonId=.*&mockSessionId=/);
  const mockUrl = new URL(page.url());
  expect(mockUrl.searchParams.get("seasonId")).toBe(season.id);
  expect(mockUrl.searchParams.get("mockSessionId")).toBeTruthy();
  await expect(page.locator("#mock-draft-workspace")).toBeVisible();
  await expect(page.locator("#mock-draft-title")).toHaveText(
    season.settings.draftFormat === "auction" ? "Auction mock draft" : "Snake mock draft",
  );
  await expect(page.locator("#mock-draft-state")).toHaveText("Setup");
  await expect(page.locator("#mock-draft-player-rows tr").first()).toBeVisible();
  await expect(page.locator("#mock-draft-player-head")).toContainText("NFL");
  await expect(page.locator("#mock-draft-player-head")).toContainText("Bye");
  if (season.settings.draftFormat === "auction") {
    await expect(page.locator("#mock-draft-player-head")).toContainText("Market value");
    await expect(page.locator("#mock-draft-player-head")).toContainText("Our value");
  }
  const firstPlayerRow = page.locator("#mock-draft-player-rows tr").first();
  const firstPlayerPosition = await firstPlayerRow.getAttribute("data-position");
  await expect(firstPlayerRow.locator('[data-label="Position"]')).toHaveClass(/position-label/);
  await expect(firstPlayerRow.locator('[data-label="Position"]')).toHaveAttribute(
    "data-position",
    firstPlayerPosition ?? "",
  );
  await expect(firstPlayerRow.locator('[data-label="NFL"]')).not.toHaveText("-");
  await expect(firstPlayerRow.locator('[data-label="Bye"]')).not.toHaveText("-");

  const rosterTeamSelect = page.locator("#mock-draft-roster-team");
  await expect(rosterTeamSelect.locator("option")).toHaveCount(season.teams.length);
  const claimedTeamId = await rosterTeamSelect.inputValue();
  const otherTeamId = await rosterTeamSelect.locator("option").evaluateAll(
    (options, selectedTeamId) => options
      .map(option => option.getAttribute("value") ?? "")
      .find(value => value !== selectedTeamId) ?? "",
    claimedTeamId,
  );
  expect(otherTeamId).not.toBe("");
  await rosterTeamSelect.selectOption(otherTeamId);
  await expect(rosterTeamSelect).toHaveValue(otherTeamId);
  await expect(page.locator("#mock-draft-roster")).toHaveAttribute("data-team-id", otherTeamId);
  if (season.settings.draftFormat === "auction") {
    await expect(page.locator("#mock-draft-roster-facts")).toBeVisible();
    await expect(page.locator("#mock-roster-budget-left")).toHaveText(/^\$/);
    await expect(page.locator("#mock-roster-max-bid")).toHaveText(/^\$/);
  } else {
    await expect(page.locator("#mock-draft-roster-facts")).toBeHidden();
  }
  await rosterTeamSelect.selectOption(claimedTeamId);
  await expect(page.locator("#mock-draft-roster")).toHaveAttribute("data-team-id", claimedTeamId);
  const mockViewport = await page.locator("#mock-draft-player-scroll").evaluate(element => ({
    clientHeight: element.clientHeight,
    maxHeight: getComputedStyle(element).maxHeight,
  }));
  expect(mockViewport.clientHeight).toBeLessThanOrEqual(720);
  expect(mockViewport.maxHeight).not.toBe("none");

  const rbFilter = page.locator('[data-mock-position="RB"]');
  await rbFilter.click();
  await expect(rbFilter).toHaveAttribute("aria-pressed", "true");
  const visiblePositions = await page.locator("#mock-draft-player-rows tr").evaluateAll(rows =>
    rows.map(row => row.getAttribute("data-position"))
  );
  expect(visiblePositions.length).toBeGreaterThan(0);
  expect(new Set(visiblePositions)).toEqual(new Set(["RB"]));
  await page.locator('[data-mock-position="ALL"]').click();

  await page.locator("#mock-draft-start").click();
  await expect(page.locator("#mock-draft-state")).toHaveText("Active");
  await expect(page.locator("#mock-draft-status")).not.toHaveText("Updating the mock draft...");

  const passButton = page.locator("#mock-draft-pass");
  if (await passButton.isEnabled()) {
    await passButton.click();
  } else {
    const availableDecision = page.locator("#mock-draft-player-rows .mock-player-action:enabled").first();
    await expect(availableDecision).toBeVisible();
    await availableDecision.click();
  }
  await expect(page.locator("#mock-draft-status")).not.toHaveText("Updating the mock draft...");

  const persistedState = await page.locator("#mock-draft-state").textContent();
  const persistedProgress = await page.locator("#mock-draft-progress").textContent();
  const decisionSelector = season.settings.draftFormat === "auction"
    ? "#mock-auction-player"
    : "#mock-draft-status";
  const persistedDecision = await page.locator(decisionSelector).textContent();
  const persistedRoster = await page.locator("#mock-draft-roster").textContent();
  const persistedSessionId = new URL(page.url()).searchParams.get("mockSessionId");
  await page.reload();
  await expect(page.locator("#mock-draft-workspace")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("mockSessionId")).toBe(persistedSessionId);
  await expect(page.locator("#mock-draft-state")).toHaveText(persistedState ?? "");
  await expect(page.locator("#mock-draft-progress")).toHaveText(persistedProgress ?? "");
  await expect(page.locator(decisionSelector)).toHaveText(persistedDecision ?? "");
  await expect(page.locator("#mock-draft-roster")).toHaveText(persistedRoster ?? "");
};

const exerciseBoardSimulations = async (page: Page): Promise<void> => {
  const panel = page.locator("#simulation-panel");
  await expect(panel).toBeVisible();
  await panel.locator("summary").click();
  await page.locator("#simulation-count").fill("2");
  await page.locator("#simulation-strategy").fill("Target an elite RB");
  await page.locator("#simulation-run").click();
  await expect(page.locator("#simulation-results")).toBeVisible();
  await expect(page.locator("#simulation-completed")).toHaveText("2 / 2");
  await expect(page.locator("#simulation-format")).toHaveText(/Auction|Snake/);
  await expect(page.locator("#simulation-status")).toHaveText("Simulation results are private to your account.");
  await expect(page.locator("#simulation-run-picker option")).toHaveCount(2);
  expect(await page.locator(".simulation-team").count()).toBeGreaterThan(1);
  await expect(page.locator('.simulation-team[data-user-team="true"]')).toHaveCount(1);
  const weekOneTotal = await page.locator('.simulation-team[data-user-team="true"] .simulation-team-score')
    .textContent();
  expect(Number.parseFloat(weekOneTotal ?? "0")).toBeGreaterThan(0);
  await expect(page.locator("#simulation-exposure-body tr").first()).toBeVisible();
};

const createLiveRoomFromSetup = async (
  page: Page,
  season: LeagueSeason,
): Promise<LiveDraftRoom> => {
  await Promise.all([
    page.waitForURL(/\/draft-room\?seasonId=.*&roomId=/),
    page.getByRole("button", { name: "Create draft room" }).click(),
  ]);
  const roomId = new URL(page.url()).searchParams.get("roomId");
  if (roomId === null) throw new Error("Expected created room URL to include roomId.");
  const room = expectOk(await api<LiveDraftRoomBody>(page, `/live-rooms/${encodeURIComponent(roomId)}`)).room;
  expect(room).toMatchObject({
    roomId,
    seasonId: season.id,
    status: "setup",
  });
  expect(room.playerCatalog.length).toBeGreaterThan(0);

  return room;
};

const waitForSaleEvent = async (
  page: Page,
  roomIdForStream: string,
  afterRevision: number,
): Promise<BrowserSseEvent> =>
  await page.evaluate(async ({ roomId: currentRoomId, afterRevision: revision }) => {
    return await new Promise((resolve, reject) => {
      const source = new EventSource(
        `/live-rooms/${encodeURIComponent(currentRoomId)}/event-stream?afterRevision=${revision}`,
      );
      const timeout = window.setTimeout(() => {
        source.close();
        reject(new Error("Timed out waiting for room.sale SSE event."));
      }, 10_000);

      const finish = (event: MessageEvent<string>): void => {
        window.clearTimeout(timeout);
        source.close();
        resolve({
          type: event.type,
          lastEventId: event.lastEventId,
          data: JSON.parse(event.data),
        });
      };

      source.addEventListener("room.sale", finish);
      source.onerror = () => {
        window.clearTimeout(timeout);
        source.close();
        reject(new Error("Live room SSE connection failed."));
      };
    });
  }, {
    roomId: roomIdForStream,
    afterRevision,
  }) as BrowserSseEvent;

const localFixtureWorkspace = async (browser: Browser): Promise<ReadySmokeWorkspace> => {
  const camEmail = emailFor("cam");
  const sethEmail = emailFor("seth");
  const hoodyEmail = emailFor("hoody");
  const { page: camPage, account: camAccount } = await pageForLocalFixtureUser(browser, camEmail);
  const seedSeason = await seedSeasonFromBrowser(camPage, camAccount);
  const invitationUrl = await applyCommissionerSetup(camPage, seedSeason, camEmail);
  const createdRoom = await createLiveRoomFromSetup(camPage, seedSeason);
  expect(createdRoom.playerCatalog).toHaveLength(500);
  expect(createdRoom.initialRosters).toHaveLength(7);
  const { page: sethPage } = await pageForLocalFixtureUser(browser, sethEmail);
  await sethPage.goto(invitationUrl);
  await expect(sethPage.locator("#invite-workspace")).toBeVisible();
  const sethTeamRow = sethPage.locator("#invite-team-list .invite-team-row").filter({ hasText: "Seth" });
  await expect(sethTeamRow).toContainText("Seth");
  await Promise.all([
    sethPage.waitForURL(/\/league\?seasonId=/),
    sethTeamRow.getByRole("button", { name: "Join as Seth" }).click(),
  ]);
  const acceptedOnboarding = expectOk(await api<{ leagues: Array<{ membership: PlatformLeagueMembership }> }>(
    sethPage,
    "/onboarding",
  ));
  await expect(sethPage.locator("#league-name")).toHaveText(leagueName);
  await expect(sethPage.locator("#my-team-name")).toHaveText("Seth");
  await sethPage.goto(invitationUrl);
  await expect(sethPage.locator("#invite-open-league")).toBeVisible();
  await expect(sethPage.locator("#invite-team-list")).toContainText("Your team");
  await expect(sethPage.locator("#invite-team-list button")).toHaveCount(0);

  const hoodyContext = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const hoodyPage = await hoodyContext.newPage();
  await hoodyPage.goto(invitationUrl);
  await expect(hoodyPage.locator("#auth-panel")).toBeVisible();
  await expect(hoodyPage.locator("#auth-title")).toHaveText("Join your league");
  await expect(hoodyPage.locator("#auth-invite-league-name")).toHaveText(leagueName);
  await expect(hoodyPage.locator("#auth-invite-team-list li")).toHaveCount(ownerOrder.length);
  await expect(
    hoodyPage.locator("#auth-invite-team-list li").filter({ hasText: "Seth" }),
  ).toContainText("Claimed");
  await hoodyPage.getByRole("link", { name: "Create account" }).click();
  await expect(hoodyPage).toHaveURL(/\/signup\?returnTo=/);
  await expect(hoodyPage.locator("#auth-invite-league-name")).toHaveText(leagueName);
  await hoodyPage.getByLabel("Email", { exact: true }).fill(hoodyEmail);
  await hoodyPage.getByLabel("Password", { exact: true }).fill(password);
  await Promise.all([
    hoodyPage.waitForURL(/\/invite\?token=/),
    hoodyPage.getByRole("button", { name: "Create account" }).click(),
  ]);
  await expect(hoodyPage.locator("#invite-workspace")).toBeVisible();
  const claimedSethRow = hoodyPage.locator("#invite-team-list .invite-team-row").filter({ hasText: "Seth" });
  await expect(claimedSethRow).toContainText("Claimed");
  const hoodyTeamRow = hoodyPage.locator("#invite-team-list .invite-team-row").filter({ hasText: "Hoody" });
  await Promise.all([
    hoodyPage.waitForURL(/\/league\?seasonId=/),
    hoodyTeamRow.getByRole("button", { name: "Join as Hoody" }).click(),
  ]);
  await expect(hoodyPage.locator("#my-team-name")).toHaveText("Hoody");

  const appliedSeason = expectOk(await api<SeasonBody>(camPage, `/seasons/${seedSeason.id}`)).season;
  const appliedSethTeam = teamByOwner(appliedSeason, "Seth");
  expect(acceptedOnboarding.leagues[0]?.membership).toMatchObject({
    role: "member",
    ownerId: appliedSethTeam.ownerId,
    teamId: appliedSethTeam.id,
  });
  const acceptedHoodyOnboarding = expectOk(await api<{
    leagues: Array<{ membership: PlatformLeagueMembership }>;
  }>(hoodyPage, "/onboarding"));
  const appliedHoodyTeam = teamByOwner(appliedSeason, "Hoody");
  expect(acceptedHoodyOnboarding.leagues[0]?.membership).toMatchObject({
    role: "member",
    ownerId: appliedHoodyTeam.ownerId,
    teamId: appliedHoodyTeam.id,
  });

  return {
    commissionerPage: camPage,
    memberPage: sethPage,
    season: appliedSeason,
    room: createdRoom,
    commissionerOwnerName: "Cam",
    memberOwnerName: "Seth",
    commissionerTeamName: "Cam",
    memberTeamName: "Seth",
    salePlayerName: "Puka Nacua",
    salePrice: 62,
    expectedExportedInitialPlayer: "De'Von Achane",
  };
};

const leagueForSmokeSeason = (
  onboarding: OnboardingBody,
  seasonId: string,
  actorLabel: string,
): PlatformOnboardingLeague => {
  const league = onboarding.leagues.find(candidate => candidate.seasonId === seasonId);
  if (league === undefined) {
    throw new Error(
      `The pre-provisioned ${actorLabel} account does not have active access to smoke season ${seasonId}. ` +
      "Verify the provisioning document before rerunning the deployed smoke.",
    );
  }

  return league;
};

const assignedIdentityFor = (
  league: PlatformOnboardingLeague,
  actorLabel: string,
): { ownerName: string; teamName: string } => {
  const ownerName = league.membership.ownerDisplayName;
  const teamName = league.membership.teamDisplayName;
  if (ownerName === undefined || teamName === undefined) {
    throw new Error(
      `The pre-provisioned ${actorLabel} account must have an assigned team in smoke season ${league.seasonId}.`,
    );
  }

  return { ownerName, teamName };
};

const exerciseDeployedWorkspace = async (browser: Browser): Promise<void> => {
  const environment = requiredDeployedEnvironment();
  const { page: commissionerPage } = await pageForExistingUser(
    browser,
    environment.commissionerEmail,
    environment.commissionerPassword,
  );
  const { page: memberPage } = await pageForExistingUser(
    browser,
    environment.memberEmail,
    environment.memberPassword,
  );
  const commissionerLeague = leagueForSmokeSeason(
    expectOk(await api<OnboardingBody>(commissionerPage, "/onboarding")),
    environment.seasonId,
    "commissioner",
  );
  const memberLeague = leagueForSmokeSeason(
    expectOk(await api<OnboardingBody>(memberPage, "/onboarding")),
    environment.seasonId,
    "member",
  );
  if (!commissionerLeague.canManageLeague) {
    throw new Error("The deployed smoke commissioner must have owner or admin access.");
  }
  if (memberLeague.canManageLeague) {
    throw new Error("The deployed smoke member must use a non-commissioner league membership.");
  }

  const commissionerIdentity = assignedIdentityFor(commissionerLeague, "commissioner");
  const memberIdentity = assignedIdentityFor(memberLeague, "member");
  if (commissionerLeague.membership.teamId === memberLeague.membership.teamId) {
    throw new Error("The deployed smoke commissioner and member must be assigned to different teams.");
  }
  const season = expectOk(await api<SeasonBody>(
    commissionerPage,
    `/seasons/${encodeURIComponent(environment.seasonId)}`,
  )).season;
  expect(memberLeague.leagueId).toBe(season.leagueId);

  await Promise.all([
    commissionerPage.goto(`/app?seasonId=${encodeURIComponent(season.id)}`),
    memberPage.goto(`/app?seasonId=${encodeURIComponent(season.id)}`),
  ]);
  await expect(commissionerPage.locator("#league-name")).toHaveText(season.league.name);
  await expect(memberPage.locator("#league-name")).toHaveText(season.league.name);
  await expect(commissionerPage.locator("#my-team-name")).toHaveText(commissionerIdentity.teamName);
  await expect(memberPage.locator("#my-team-name")).toHaveText(memberIdentity.teamName);

  await openUnifiedBoard(commissionerPage, season.id);
  await openUnifiedBoard(memberPage, season.id);
  await exerciseBoardSimulations(memberPage);
  await expect(memberPage.locator("#standalone-board-open-mock")).toHaveAttribute(
    "href",
    `/mock-drafts?seasonId=${encodeURIComponent(season.id)}`,
  );

  await commissionerPage.goto(`/setup?seasonId=${encodeURIComponent(season.id)}`);
  await expect(commissionerPage.locator("#setup-season-id-input")).toHaveValue(season.id);
};

const exerciseReadyWorkspace = async (workspace: ReadySmokeWorkspace): Promise<void> => {
  const {
    commissionerPage: camPage,
    memberPage: sethPage,
    season: appliedSeason,
    room: createdRoom,
    commissionerOwnerName,
    memberTeamName,
    salePlayerName,
    salePrice,
    expectedExportedInitialPlayer,
  } = workspace;
  const roomId = createdRoom.roomId;

  await Promise.all([
    camPage.goto(`/app?seasonId=${encodeURIComponent(appliedSeason.id)}`),
    sethPage.goto(`/app?seasonId=${encodeURIComponent(appliedSeason.id)}`),
  ]);
  await expect(camPage.locator("#league-name")).toHaveText(appliedSeason.league.name);
  await expect(sethPage.locator("#league-name")).toHaveText(appliedSeason.league.name);
  await expect(sethPage.locator("#my-team-name")).toHaveText(memberTeamName);

  await openUnifiedBoard(camPage, appliedSeason.id, createdRoom.playerCatalog.length);
  await expect(camPage.locator("#standalone-board-open-live")).toHaveCount(0);
  await camPage.getByRole("link", { name: "League", exact: true }).click();
  await expect(camPage).toHaveURL(/\/league\?seasonId=/);
  await expect(camPage.locator("#league-name")).toHaveText(appliedSeason.league.name);
  await camPage.locator("#account-menu-button").click();
  await expect(camPage.locator("#account-create-league")).toBeVisible();
  await camPage.locator("#account-create-league").click();
  await expect(camPage).toHaveURL(/\/league\?create=1$/);
  await expect(camPage.locator("#empty-leagues")).toBeVisible();
  await expect(camPage.locator("#league-context")).toBeHidden();

  await openUnifiedBoard(sethPage, appliedSeason.id, createdRoom.playerCatalog.length);
  await exerciseDurableMockWorkspace(sethPage, appliedSeason);

  await Promise.all([
    camPage.goto(`/app?seasonId=${encodeURIComponent(appliedSeason.id)}`),
    sethPage.goto(`/app?seasonId=${encodeURIComponent(appliedSeason.id)}`),
  ]);
  await Promise.all([
    camPage.locator("#open-live-draft-button").click(),
    sethPage.locator("#open-live-draft-button").click(),
  ]);
  await expect(camPage.locator("#draft-room-view")).toBeVisible();
  await expect(sethPage.locator("#draft-room-view")).toBeVisible();
  await expect(camPage.locator("#draft-commissioner-controls")).toBeVisible();
  await expect(sethPage.locator("#draft-member-note")).toBeVisible();
  const commissionerPlayerRow = camPage.locator("#draft-board-rows [data-player-name]")
    .filter({ hasText: salePlayerName })
    .first();
  const memberPlayerRow = sethPage.locator("#draft-board-rows [data-player-name]")
    .filter({ hasText: salePlayerName })
    .first();
  await expect(commissionerPlayerRow).toBeVisible();
  await expect(memberPlayerRow).toBeVisible();

  await camPage.locator("#draft-start").click();
  await expect(camPage.locator("#draft-room-status")).toHaveText("Live");
  await expect(sethPage.locator("#draft-room-status")).toHaveText("Live");
  const startedRoom = expectOk(await api<LiveDraftRoomBody>(camPage, `/live-rooms/${roomId}`)).room;
  expect(startedRoom).toMatchObject({
    status: "live",
    revision: createdRoom.revision + 1,
  });

  const saleEventPromise = waitForSaleEvent(sethPage, roomId, startedRoom.revision);
  await commissionerPlayerRow.getByRole("button", { name: `Use ${salePlayerName} in sale command` }).click();
  const saleCommand = camPage.locator("#draft-sale-command");
  await saleCommand.fill(`${await saleCommand.inputValue()}${salePrice}`);
  await camPage.locator("#draft-log-sale").click();
  await expect(camPage.locator("#draft-sales")).toContainText(salePlayerName);
  await expect(sethPage.locator("#draft-sales")).toContainText(salePlayerName);
  const soldRoom = expectOk(await api<LiveDraftRoomBody>(camPage, `/live-rooms/${roomId}`)).room;
  const saleEvent = await saleEventPromise;

  expect(soldRoom).toMatchObject({
    status: "live",
    revision: startedRoom.revision + 1,
    projection: {
      sales: [
        expect.objectContaining({
          ownerDisplayName: commissionerOwnerName,
          playerName: salePlayerName,
          price: salePrice,
        }),
      ],
    },
  });
  expect(saleEvent).toMatchObject({
    type: "room.sale",
    lastEventId: `${roomId}:${soldRoom.revision}`,
    data: expect.objectContaining({
      revision: soldRoom.revision,
      sale: expect.objectContaining({
        ownerDisplayName: commissionerOwnerName,
        playerName: salePlayerName,
        price: salePrice,
      }),
    }),
  });

  const polledEvents = expectOk(await api<EventsBody>(
    sethPage,
    `/live-rooms/${roomId}/events?afterRevision=${startedRoom.revision}`,
  )).events;
  expect(polledEvents.currentRevision).toBe(soldRoom.revision);
  expect(polledEvents.events).toEqual([
    expect.objectContaining({
      event: "room.sale",
      revision: soldRoom.revision,
    }),
  ]);

  camPage.once("dialog", dialog => dialog.accept());
  await camPage.locator("#draft-undo").click();
  await expect(camPage.locator("#draft-sales")).not.toContainText(salePlayerName);
  await expect(sethPage.locator("#draft-sales")).not.toContainText(salePlayerName);

  await commissionerPlayerRow.getByRole("button", { name: `Use ${salePlayerName} in sale command` }).click();
  await saleCommand.fill(`${await saleCommand.inputValue()}${salePrice}`);
  await camPage.locator("#draft-log-sale").click();
  await expect(camPage.locator("#draft-sales")).toContainText(salePlayerName);

  camPage.once("dialog", dialog => dialog.accept());
  await camPage.locator("#draft-end").click();
  await expect(camPage.locator("#draft-room-status")).toHaveText("Complete");
  await expect(sethPage.locator("#draft-room-status")).toHaveText("Complete");
  const endedRoom = expectOk(await api<LiveDraftRoomBody>(camPage, `/live-rooms/${roomId}`)).room;
  expect(endedRoom).toMatchObject({
    status: "ended",
  });

  const downloadPromise = camPage.waitForEvent("download");
  await camPage.locator("#draft-export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);

  const exportArtifact = expectOk(await api<ExportArtifactBody>(camPage, `/live-rooms/${roomId}/export-artifacts`, {
    method: "POST",
    body: { exportedAt },
  }));

  expect(exportArtifact.artifact).toMatchObject({
    format: "csv",
    sourceRevision: endedRoom.revision,
    contentType: "text/csv; charset=utf-8",
  });
  expect(exportArtifact.artifact.byteLength).toBe(Buffer.byteLength(exportArtifact.content, "utf8"));
  expect(exportArtifact.content).toContain("Status,ended,Revision");
  expect(exportArtifact.content).toContain(`${salePlayerName},${salePrice}`);
  if (expectedExportedInitialPlayer !== undefined) {
    expect(exportArtifact.content).toContain(expectedExportedInitialPlayer);
  }
};

test("local platform supports fixture signup, setup, invitation, realtime draft, and export", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  await exerciseReadyWorkspace(await localFixtureWorkspace(browser));
});

test("commissioner history and keepers persist into an unopened live room", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const { page, account } = await pageForLocalFixtureUser(browser, "keeper.history.e2e@example.com");
  const owners = ["Cam", "Sam", "Seth", "Alex"];
  const baseSeason = buildCurrentMockdLeagueSeason(owners, { ...leagueConfig, teams: owners.length }, {
    leagueName: "Keeper history E2E",
    setupStatus: "draft",
  });
  const leagueId = `${baseSeason.leagueId}-keeper-history`;
  const seasonId = `${leagueId}-season-${baseSeason.seasonYear}`;
  const season: LeagueSeason = {
    ...baseSeason,
    id: seasonId,
    leagueId,
    league: {
      ...baseSeason.league,
      id: leagueId,
      externalLeagueId: `${baseSeason.league.externalLeagueId}-keeper-history`,
    },
    teams: baseSeason.teams.map((team, index) => ({
      ...team,
      id: `${seasonId}-team-${index + 1}`,
      leagueSeasonId: seasonId,
      ownerId: `${team.ownerId}-keeper-history`,
    })),
  };
  const claimedTeam = teamByOwner(season, "Alex");
  expectOk(await api<SeasonBody>(page, "/seasons", {
    method: "POST",
    headers: { "x-mockd-provisioning-token": provisioningToken },
    body: {
      season,
      memberships: [{
        userId: account.id,
        leagueId: season.leagueId,
        role: "admin",
        ownerId: claimedTeam.ownerId,
        teamId: claimedTeam.id,
      }],
    },
  }));

  const wideDraft = (camPrice: number, samPrice: number): string => [
    "Team,Cam,,,Sam,,",
    `1,$${camPrice},RB,De'Von Achane,$${samPrice},WR,CeeDee Lamb`,
    "2,$61,WR,Ja'Marr Chase,$9,QB,Trevor Lawrence",
  ].join("\n");

  await page.goto(`/setup?seasonId=${encodeURIComponent(season.id)}`);
  await expect(page.locator("#keeper-save-state")).toHaveText("2 keepers saved");
  await page.locator("#historical-import-file").setInputFiles([
    {
      name: "league-auction-2023.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(wideDraft(42, 58)),
    },
    {
      name: "league-auction-2024.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(wideDraft(45, 61)),
    },
  ]);
  const historyRows = page.locator("#historical-import-file-list .historical-file-row");
  await expect(historyRows).toHaveCount(2);
  await expect(historyRows.nth(0).locator("input[data-historical-year]")).toHaveValue("2023");
  await expect(historyRows.nth(1).locator("input[data-historical-year]")).toHaveValue("2024");
  await historyRows.nth(1).locator("input[data-historical-year]").fill("2023");
  await expect(page.locator("#historical-import-button")).toBeDisabled();
  await expect(page.locator("#historical-import-status")).toHaveText(
    "Each selected file needs a different draft year. 2023 is selected more than once.",
  );
  await historyRows.nth(1).locator("input[data-historical-year]").fill("2024");
  await expect(page.locator("#historical-import-button")).toBeEnabled();
  await page.locator("#historical-import-button").click();
  await expect(page.locator("#historical-import-status")).toHaveText(
    "Imported 2 draft files. Draft history is saved. Market now blends baseline projections with up to three years of open-auction sales; keeper rows are excluded. Files with same-season public/AAV values also improve player-level estimates.",
  );
  await expect(historyRows.nth(0)).toContainText("4 draft rows imported for 2023");
  await expect(historyRows.nth(1)).toContainText("4 draft rows imported for 2024");

  const keeperCommand = page.locator("#keeper-command-input");
  await keeperCommand.fill("Alex Lamb 50");
  await keeperCommand.press("Enter");
  await expect(page.locator("#keeper-status")).toHaveText(
    "Use '<team or manager> keeping <player> <number>'.",
  );
  await expect(keeperCommand).toHaveValue("Alex Lamb 50");
  await expect(page.locator("#keeper-save-state")).toHaveText("2 keepers saved");
  await keeperCommand.fill("Alex keeping Lamb 50");
  await keeperCommand.press("Enter");
  await expect(page.locator("#keeper-save-state")).toHaveText("3 keepers saved");
  await expect(page.locator("#keeper-status")).toHaveText(
    "Alex keeps CeeDee Lamb for $50. League values are updated.",
  );
  await expect(keeperCommand).toHaveValue("");
  await expect(page.locator("#keeper-list")).toContainText("Alex · CeeDee Lamb");
  await expect(page.locator("#keeper-list")).toContainText("$50");

  await page.reload();
  await expect(page.locator("#keeper-save-state")).toHaveText("3 keepers saved");
  await expect(page.locator("#keeper-list")).toContainText("Alex · CeeDee Lamb");
  await page.locator("#setup-final-review").check();
  await page.getByRole("button", { name: "Publish league" }).click();
  await expect(page.locator("#live-room-setup-status")).toHaveText(
    "League setup published. The shared draft room can now be created.",
  );

  const room = await createLiveRoomFromSetup(page, season);
  await expect(page.locator("#draft-team-budget")).toHaveText("$150");
  await expect(page.locator("#draft-team-spent")).toHaveText("$50");
  await expect(page.locator("#draft-team-open-slots")).toHaveText("15");
  await expect(page.locator("#draft-team-roster")).toContainText("CeeDee Lamb");

  await page.goto(`/setup?seasonId=${encodeURIComponent(season.id)}`);
  await expect(page.locator("#keeper-save-state")).toHaveText("3 keepers saved");
  await expect(keeperCommand).toBeEnabled();
  await keeperCommand.fill("Alex keeping Lamb 47");
  await keeperCommand.press("Enter");
  await expect(page.locator("#keeper-status")).toHaveText(
    "Alex keeps CeeDee Lamb for $47. League values and the draft room are updated.",
  );
  await page.goto(
    `/draft-room?seasonId=${encodeURIComponent(season.id)}&roomId=${encodeURIComponent(room.roomId)}`,
  );
  await expect(page.locator("#draft-team-budget")).toHaveText("$153");
  await expect(page.locator("#draft-team-spent")).toHaveText("$47");
  await expect(page.locator("#draft-team-open-slots")).toHaveText("15");
  await expect(page.locator("#draft-team-roster")).toContainText("CeeDee Lamb");
  await expect(page.locator("#draft-team-roster")).toContainText("$47");

  const updatedRoom = expectOk(await api<LiveDraftRoomBody>(
    page,
    `/live-rooms/${encodeURIComponent(room.roomId)}`,
  )).room;
  const latestPricing = expectOk(await api<PricingSnapshotsBody>(
    page,
    `/seasons/${encodeURIComponent(season.id)}/pricing-snapshots?scenarioId=expected`,
  )).pricingSnapshots.at(-1);
  const expectedPukaPrice = latestPricing?.rows.find(row => row.playerName === "Puka Nacua")?.personalValue;
  expect(expectedPukaPrice).toBeDefined();
  expect(updatedRoom.playerCatalog.find(player => player.name === "Puka Nacua")?.expectedPrice)
    .toBe(Math.round(expectedPukaPrice ?? Number.NaN));
  const pukaRow = page.locator('#draft-board-rows tr[data-player-name="Puka Nacua"]');
  await expect(pukaRow.locator("td").last()).toHaveText(`$${Math.round(expectedPukaPrice ?? Number.NaN)}`);
});

test("commissioner league switching discards stale setup fetch responses", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local route delays are not used by deployed smoke.");
  const { page, account } = await pageForLocalFixtureUser(browser, "setup.switch.e2e@example.com");
  await page.setViewportSize({ width: 390, height: 844 });
  const owners = ["Cam", "Seth", "Beaton", "Hoody"];
  const buildSeason = (suffix: string, name: string): LeagueSeason => {
    const base = buildCurrentMockdLeagueSeason(owners, { ...leagueConfig, teams: owners.length }, {
      leagueName: name,
      setupStatus: "published",
    });
    const leagueId = `${base.leagueId}-${suffix}`;
    const seasonId = `${leagueId}-season-${base.seasonYear}`;

    return {
      ...base,
      id: seasonId,
      leagueId,
      league: {
        ...base.league,
        id: leagueId,
        externalLeagueId: `${base.league.externalLeagueId}-${suffix}`,
        name,
      },
      teams: base.teams.map((team, index) => ({
        ...team,
        id: `${seasonId}-team-${index + 1}`,
        leagueSeasonId: seasonId,
        ownerId: `${team.ownerId}-${suffix}`,
        displayName: `${name} ${team.ownerDisplayName}`,
      })),
    };
  };
  const seasonA = buildSeason("switch-a", "League A");
  const seasonB = buildSeason("switch-b", "League B");
  for (const season of [seasonA, seasonB]) {
    const commissionerTeam = teamByOwner(season, "Cam");
    expectOk(await api<SeasonBody>(page, "/seasons", {
      method: "POST",
      headers: { "x-mockd-provisioning-token": provisioningToken },
      body: {
        season,
        memberships: [{
          userId: account.id,
          leagueId: season.leagueId,
          role: "admin",
          ownerId: commissionerTeam.ownerId,
          teamId: commissionerTeam.id,
        }],
      },
    }));
  }
  expectOk(await api(page, "/invitations", {
    method: "POST",
    body: { seasonId: seasonA.id },
  }));

  const delay = async (milliseconds: number): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, milliseconds));
  };
  await page.route("**/invitations?seasonId=*", async route => {
    const requestSeasonId = new URL(route.request().url()).searchParams.get("seasonId");
    const response = await route.fetch();
    if (requestSeasonId === seasonA.id) await delay(300);
    await route.fulfill({ response });
  });
  await page.route("**/seasons/**", async route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET" || url.pathname !== `/seasons/${seasonA.id}`) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    await delay(300);
    await route.fulfill({ response });
  });

  await page.goto(`/setup?seasonId=${encodeURIComponent(seasonA.id)}`);
  await expect(page.locator("#header-league-picker")).toHaveValue(seasonA.id);
  await page.locator("#header-league-picker").selectOption(seasonB.id);
  await expect(page.locator("#invitation-create-status")).toHaveText("No league link is active yet.");
  await expect(page.locator("#create-league-invite-button")).toHaveText("Create league link");
  await expect(page.locator("#setup-team-body")).toContainText("League B Cam");
  await delay(400);
  await expect(page.locator("#invitation-create-status")).toHaveText("No league link is active yet.");
  await expect(page.locator("#create-league-invite-button")).toHaveText("Create league link");
  await expect(page.locator("#setup-team-body")).not.toContainText("League A Cam");

  await page.goto(`/practice?seasonId=${encodeURIComponent(seasonA.id)}`);
  await page.locator("#standalone-board-open-mock").click();
  await expect(page).toHaveURL(/mockSessionId=/);
  const leagueAMockSessionId = new URL(page.url()).searchParams.get("mockSessionId");
  await page.locator("#header-league-picker").selectOption(seasonB.id);
  await expect(page.locator("#header-league-picker")).toHaveValue(seasonB.id);
  await expect(page.locator("#mock-draft-workspace")).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("seasonId")).toBe(seasonB.id);
  await expect.poll(() => new URL(page.url()).searchParams.get("mockSessionId")).not.toBeNull();
  expect(new URL(page.url()).searchParams.get("mockSessionId")).not.toBe(leagueAMockSessionId);
  await expect(page.locator("#mock-draft-status")).not.toHaveText("Opening your league mock...");
  await expect(page.locator("#mock-draft-status")).not.toContainText("belongs to another league");
});

test("deployed platform supports authenticated workspaces without mutating the real draft", async ({ browser }) => {
  test.skip(!isDeployedSmoke, "Deployed smoke credentials are not used by local E2E.");
  await exerciseDeployedWorkspace(browser);
});
