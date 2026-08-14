import { expect, test, type Browser, type Dialog, type Page, type Route } from "@playwright/test";
import { leagueConfig, ownerOrder } from "../config/league.js";
import type { AccountRecord } from "../src/platform/auth.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomReadModel } from "../src/platform/liveDraftRoomStream.js";
import type { PlatformLeagueMembership } from "../src/platform/platformApp.js";
import { leagueSeasonSetupRevision } from "../src/platform/leagueSetup.js";
import type { PlatformOnboardingLeague } from "../src/platform/platformOnboarding.js";
import type { PricingSnapshot } from "../src/platform/pricingSnapshots.js";
import {
  accountMenuButton,
  expectAuthenticatedAccount,
  expectSignedOut,
  signOutThroughAccountMenu,
} from "./support/auth.js";
import {
  abandonAuctionMock,
  availablePlayersTable,
  chooseRoster,
  createAuctionMock,
  expectAuctionMockSetup,
  startAuctionMock,
} from "./support/mockDraft.js";
import {
  choosePracticeOption,
  expectPracticeBoard,
  exercisePracticeBoardControls,
  practiceBoard,
  practicePlayerRows,
} from "./support/practice.js";

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
const provisioningToken = process.env.MOCKD_E2E_PROVISIONING_TOKEN?.trim() || "local-e2e-provisioning-token";

interface JsonResponse<TBody> {
  status: number;
  body: TBody;
}

interface SeasonBody {
  season: LeagueSeason;
}

interface LiveDraftRoomBody {
  room: LiveDraftRoomReadModel;
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

interface OnboardingBody {
  leagues: readonly PlatformOnboardingLeague[];
}

interface ReadySmokeWorkspace {
  commissionerPage: Page;
  memberPage: Page;
  season: LeagueSeason;
  room: LiveDraftRoomReadModel;
  commissionerOwnerName: string;
  memberOwnerName: string;
  commissionerTeamName: string;
  memberTeamName: string;
  salePlayerName: string;
  salePrice: number;
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
  const account = await expectAuthenticatedAccount(page, email, [
    `Could not sign in to the pre-provisioned smoke account ${email}.`,
    "Verify the deployed smoke credential secrets and run production provisioning verification.",
  ].join(" "));

  return { page, account };
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
  namespace?: string,
): Promise<LeagueSeason> => {
  const baseSeason = namespacedSeasonForSmoke(buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName,
    setupStatus: "draft",
  }));
  const namespaceSlug = namespace === undefined ? undefined : cleanIdFragment(namespace);
  const season = namespaceSlug === undefined
    ? baseSeason
    : (() => {
      const leagueId = `${baseSeason.leagueId}-${namespaceSlug}`;
      const seasonId = `${leagueId}-season-${baseSeason.seasonYear}`;

      return {
        ...baseSeason,
        id: seasonId,
        leagueId,
        league: {
          ...baseSeason.league,
          id: leagueId,
          externalLeagueId: `${baseSeason.league.externalLeagueId}-${namespaceSlug}`,
        },
        teams: baseSeason.teams.map((team, index) => ({
          ...team,
          id: `${seasonId}-team-${String(index + 1).padStart(2, "0")}`,
          leagueSeasonId: seasonId,
          ownerId: `${team.ownerId}-${namespaceSlug}`,
        })),
      };
    })();
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
  await expectAuthenticatedAccount(page, camEmail);
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
  await expect(page.getByRole("heading", { name: "Draft lab" })).toBeVisible();
  await expectPracticeBoard(page, expectedPlayerCount);
};

const exerciseDurableMockWorkspace = async (
  page: Page,
  season: LeagueSeason,
): Promise<void> => {
  const persistedSessionId = await createAuctionMock(page);
  expect(new URL(page.url()).searchParams.get("seasonId")).toBe(season.id);
  await expectAuctionMockSetup(page);
  const otherTeam = season.teams[1];
  if (otherTeam !== undefined) await chooseRoster(page, otherTeam.displayName);
  await startAuctionMock(page);
  const beforeReload = await page.getByRole("main").textContent();
  await page.reload();
  await expect(page.getByRole("region", { name: "Live auction" })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("sessionId")).toBe(persistedSessionId);
  await expect(page.getByRole("main")).toHaveText(beforeReload ?? "");
  await abandonAuctionMock(page);
  const replacementSessionId = await createAuctionMock(page);
  expect(replacementSessionId).not.toBe(persistedSessionId);
  await expectAuctionMockSetup(page);
};

const exerciseCompletedAuctionMockResults = async (
  page: Page,
  season: LeagueSeason,
  claimedTeamId: string,
): Promise<void> => {
  await page.goto(`/practice?seasonId=${encodeURIComponent(season.id)}`);
  await expectPracticeBoard(page);
  await createAuctionMock(page);
  await startAuctionMock(page);

  const finishButton = page.getByRole("button", { name: "Finish mock" });
  for (let decision = 0; decision < season.settings.roster.rosterSize * 4; decision += 1) {
    if (await finishButton.isEnabled()) break;

    const buyButton = page.getByRole("button", { name: /^Bid \$\d+$/u });
    const passButton = page.getByRole("button", { name: "Pass", exact: true });
    if (await buyButton.count() > 0 && await buyButton.isEnabled()) {
      await buyButton.click();
    } else if (await passButton.count() > 0 && await passButton.isEnabled()) {
      await passButton.click();
    } else {
      const nominationButton = availablePlayersTable(page)
        .getByRole("button", { name: /^Nominate /u })
        .last();
      await expect(nominationButton).toBeVisible();
      await expect(nominationButton).toBeEnabled();
      await nominationButton.click();
    }
    await expect(page.getByRole("button", { name: "Abandon mock" })).toBeEnabled({ timeout: 15_000 });
  }

  await expect(finishButton).toBeEnabled();
  await finishButton.click();
  const results = page.getByRole("region", { name: "League results" });
  await expect(results).toBeVisible();
  const teamPanels = results.getByRole("article");
  await expect(teamPanels).toHaveCount(season.teams.length);
  await expect(results).toContainText(
    `Week 1 estimates available for all ${season.teams.length * season.settings.roster.rosterSize} rostered players.`,
  );

  for (const team of season.teams) {
    const panel = teamPanels.filter({ has: page.getByRole("heading", { name: team.displayName }) });
    await expect(panel).toHaveCount(1);
    await expect(panel).toContainText(/^#\d+/u);
    await expect(panel).toContainText(/\$\d+ spent · \$\d+ left/u);
    await expect(panel).toContainText(/\d+(?:\.\d+)? Week 1/u);
    await expect(panel.getByRole("row")).toHaveCount(season.settings.roster.rosterSize + 1);
  }

  const claimedTeam = season.teams.find(team => team.id === claimedTeamId);
  expect(claimedTeam).toBeDefined();
  const claimedPanel = teamPanels.filter({
    has: page.getByRole("heading", { name: claimedTeam?.displayName ?? "" }),
  });
  await expect(claimedPanel).toHaveCount(1);
  await expect(claimedPanel.getByText("Your team", { exact: true })).toBeVisible();
};

const exerciseBoardSimulations = async (
  page: Page,
  season: LeagueSeason,
): Promise<void> => {
  const runNote = "Local E2E simulation history";
  const workspace = page.getByRole("region", { name: "Run full-league drafts" });
  await expect(workspace).toBeVisible();
  await workspace.getByLabel("Number of simulations").fill("2");
  await workspace.getByLabel("Additional draft instructions").fill("Target an elite RB");
  await workspace.getByLabel("Run label").fill(runNote);
  await workspace.getByRole("button", { name: "Run simulations" }).click();
  await expect(workspace.getByRole("button", { name: "Running simulations" })).toBeDisabled();
  const results = page.getByRole("region", { name: "League outcomes" });
  await expect(results).toBeVisible({ timeout: 30_000 });
  await expect(results.getByText("Completed", { exact: true }).locator("..")).toContainText("2 / 2");
  await expect(results.getByText("Format", { exact: true }).locator("..")).toContainText(/Auction|Snake/u);
  await expect(results.getByRole("combobox", { name: "Simulation run" })).toHaveText("Run 1");
  await expect(results.getByRole("article")).toHaveCount(season.teams.length);
  await expect(results.getByText("Your team", { exact: true })).toHaveCount(1);
  const assertLeagueRun = async (): Promise<void> => {
    const teams = results.getByRole("article");
    await expect(teams).toHaveCount(season.teams.length);
    for (let index = 0; index < season.teams.length; index += 1) {
      const team = teams.nth(index);
      await expect(team.getByText("Week 1", { exact: true })).toBeVisible();
      expect(await team.getByRole("row").count()).toBeGreaterThan(1);
      await expect(team.getByRole("columnheader", { name: "W1" })).toBeVisible();
    }
  };
  await assertLeagueRun();
  await choosePracticeOption(page, "Simulation run", "Run 2");
  await expect(results.getByRole("combobox", { name: "Simulation run" })).toHaveText("Run 2");
  await assertLeagueRun();
  await results.getByText("Player exposure across all runs", { exact: true }).click();
  expect(await results.getByRole("table").first().getByRole("row").count()).toBeGreaterThan(1);
  const history = workspace.getByRole("heading", { name: "Previous runs" }).locator("..");
  await expect(history).toContainText(runNote);
  await expect(history.getByRole("button", { name: /Open 2-run simulation/u })).toHaveCount(1);

  await page.reload();
  const restoredWorkspace = page.getByRole("region", { name: "Run full-league drafts" });
  const restoredHistory = restoredWorkspace.getByRole("heading", { name: "Previous runs" }).locator("..");
  await expect(restoredHistory).toContainText(runNote);
  await restoredHistory.getByRole("button", { name: /Open 2-run simulation/u }).click();
  const restoredResults = page.getByRole("region", { name: "League outcomes" });
  await expect(restoredResults).toBeVisible();
  await expect(restoredResults.getByText("Completed", { exact: true }).locator("..")).toContainText("2 / 2");
  await expect(restoredResults.getByRole("article")).toHaveCount(season.teams.length);
};

const createLiveRoomFromSetup = async (
  page: Page,
  season: LeagueSeason,
): Promise<LiveDraftRoomReadModel> => {
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
  expect(room.board.length).toBeGreaterThan(0);

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
  const initialRosterCount = createdRoom.teamSummaries.reduce(
    (count, team) => count + team.roster.length,
    0,
  );
  expect(createdRoom.board).toHaveLength(493);
  expect(initialRosterCount).toBe(7);
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
  await exerciseBoardSimulations(memberPage, season);
  await expect(memberPage.getByRole("link", { name: "Start auction mock" })).toHaveAttribute(
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
  } = workspace;
  const roomId = createdRoom.roomId;

  await Promise.all([
    camPage.goto(`/league?seasonId=${encodeURIComponent(appliedSeason.id)}`),
    sethPage.goto(`/league?seasonId=${encodeURIComponent(appliedSeason.id)}`),
  ]);
  await expect(camPage.getByRole("heading", { name: appliedSeason.league.name })).toBeVisible();
  await expect(sethPage.getByRole("heading", { name: appliedSeason.league.name })).toBeVisible();
  await expect(sethPage.getByRole("heading", { name: memberTeamName })).toBeVisible();

  const fullPlayerCount = createdRoom.board.length + createdRoom.teamSummaries.reduce(
    (count, team) => count + team.roster.length,
    0,
  );
  await openUnifiedBoard(camPage, appliedSeason.id, fullPlayerCount);
  await expect(camPage.getByRole("link", { name: "Enter draft" })).toHaveCount(0);
  await camPage.getByRole("link", { name: "League", exact: true }).click();
  await expect(camPage).toHaveURL(/\/league\?seasonId=/);
  await expect(camPage.getByRole("heading", { name: appliedSeason.league.name })).toBeVisible();
  await accountMenuButton(camPage).click();
  await expect(camPage.getByRole("menu")).toBeVisible();
  await camPage.keyboard.press("Escape");
  await expect(camPage.getByRole("menu")).toBeHidden();

  await openUnifiedBoard(sethPage, appliedSeason.id, fullPlayerCount);
  await exerciseBoardSimulations(sethPage, appliedSeason);
  await exerciseDurableMockWorkspace(sethPage, appliedSeason);

  await Promise.all([
    camPage.goto(`/league?seasonId=${encodeURIComponent(appliedSeason.id)}`),
    sethPage.goto(`/league?seasonId=${encodeURIComponent(appliedSeason.id)}`),
  ]);
  await Promise.all([
    camPage.getByRole("link", { name: "Enter draft" }).click(),
    sethPage.getByRole("link", { name: "Enter draft" }).click(),
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
    salesLog: [
      expect.objectContaining({
        ownerDisplayName: commissionerOwnerName,
        playerName: salePlayerName,
        price: salePrice,
      }),
    ],
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

  let endConfirmationCount = 0;
  const acceptEndConfirmation = (dialog: Dialog): void => {
    endConfirmationCount += 1;
    void dialog.accept();
  };
  camPage.on("dialog", acceptEndConfirmation);
  await camPage.locator("#draft-end").click();
  await expect(camPage.locator("#draft-room-status")).toHaveText("Complete");
  camPage.off("dialog", acceptEndConfirmation);
  expect(endConfirmationCount).toBe(2);
  await expect(sethPage.locator("#draft-room-status")).toHaveText("Complete");
  const endedRoom = expectOk(await api<LiveDraftRoomBody>(camPage, `/live-rooms/${roomId}`)).room;
  expect(endedRoom).toMatchObject({
    status: "ended",
    exportReadiness: {
      status: "blocked",
      blockers: expect.arrayContaining([expect.stringContaining("open roster slots")]),
    },
  });
  await expect(camPage.locator("#draft-export")).toBeDisabled();
  const blockedExport = await api<{ error: { code: string; message: string } }>(
    camPage,
    `/live-rooms/${roomId}/export-artifacts`, {
      method: "POST",
      body: {},
    },
  );
  expect(blockedExport).toMatchObject({
    status: 409,
    body: {
      error: {
        code: "draft_room_not_final",
        message: "Final export requires every team to fill every roster slot.",
      },
    },
  });
};

test("local platform supports fixture signup, setup, invitation, realtime draft, and final-export gating", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  await exerciseReadyWorkspace(await localFixtureWorkspace(browser));
});

test("Draft Lab supports baseline browsing and league-aware planning", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const { page, account } = await pageForLocalFixtureUser(browser, "draft.lab.e2e@example.com");

  await page.goto("/practice");
  await expect(page.getByRole("heading", { name: "Draft lab" })).toBeVisible();
  await expectPracticeBoard(page, 500);
  await expect(page.getByText("Baseline values", { exact: true })).toBeVisible();
  await expect(practicePlayerRows(page).first().getByRole("button", {
    name: /Add .+ to draft targets/u,
  })).toBeDisabled();

  const season = await seedSeasonFromBrowser(page, account, "draft-lab-controls");
  await page.goto(`/practice?seasonId=${encodeURIComponent(season.id)}`);
  await expectPracticeBoard(page, 500);
  await exercisePracticeBoardControls(page);
  await expect(page.getByRole("link", { name: "Start auction mock" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run simulations" })).toBeVisible();
});

test("Draft Lab saves simulation runs and resumes an auction mock", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const { page, account } = await pageForLocalFixtureUser(browser, "draft.lab.runs.e2e@example.com");
  const season = await seedSeasonFromBrowser(page, account, "draft-lab-runs");

  await page.goto(`/practice?seasonId=${encodeURIComponent(season.id)}`);
  await expectPracticeBoard(page, 500);
  await exerciseBoardSimulations(page, season);
  await exerciseDurableMockWorkspace(page, season);
});

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
  await expect(page.locator("#app-error")).toBeVisible();
  await expect(page.locator("#app-error-message")).toHaveText("Could not sign out. Try again.");
  await expectAuthenticatedAccount(page, email);
  await expect(page).toHaveURL(new RegExp(`/my-team\\?seasonId=${season.id}$`, "u"));
  await expectCurrentDocument(2);

  rejectSignOut = false;
  await signOutThroughAccountMenu(page);
  await expectSignedOut(page);
  await expectCurrentDocument(3);
});

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

  await page.getByRole("link", { name: "Start auction mock" }).click();
  await page.getByRole("button", { name: "Create auction mock" }).click();
  await expect.poll(() => pendingFirstRequest.route !== undefined).toBe(true);
  await page.getByRole("link", { name: "Practice", exact: true }).click();
  await page.getByRole("link", { name: "Start auction mock" }).click();
  await page.getByRole("button", { name: "Create auction mock" }).click();
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

test("completed auction mock shows every team's priced Week 1 roster", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const { page, account } = await pageForLocalFixtureUser(browser, "completed.mock.e2e@example.com");
  const owners = ["Alpha", "Bravo", "Charlie", "Delta"];
  const baseSeason = buildCurrentMockdLeagueSeason(owners, {
    ...leagueConfig,
    teams: owners.length,
    rosterSize: 4,
    lineup: { QB: 1, RB: 1, WR: 1, BENCH: 1 },
    rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 1, K: 0, DST: 0 },
  }, {
    leagueName: "Completed mock E2E",
    setupStatus: "published",
  });
  const leagueId = `${baseSeason.leagueId}-completed-mock`;
  const seasonId = `${leagueId}-season-${baseSeason.seasonYear}`;
  const season: LeagueSeason = {
    ...baseSeason,
    id: seasonId,
    leagueId,
    league: {
      ...baseSeason.league,
      id: leagueId,
      externalLeagueId: `${baseSeason.league.externalLeagueId}-completed-mock`,
    },
    teams: baseSeason.teams.map((team, index) => ({
      ...team,
      id: `${seasonId}-team-${index + 1}`,
      leagueSeasonId: seasonId,
      ownerId: `${team.ownerId}-completed-mock`,
    })),
  };
  const claimedTeam = teamByOwner(season, "Alpha");
  const createdSeason = expectOk(await api<SeasonBody>(page, "/seasons", {
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
  })).season;

  await exerciseCompletedAuctionMockResults(page, createdSeason, claimedTeam.id);
});

test("auction mock only enables legal nominations for the final open slot", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const { page, account } = await pageForLocalFixtureUser(browser, "final.slot.mock.e2e@example.com");
  const owners = ["Alpha", "Bravo", "Charlie", "Delta"];
  const baseSeason = buildCurrentMockdLeagueSeason(owners, {
    ...leagueConfig,
    teams: owners.length,
    rosterSize: 1,
    lineup: { QB: 1 },
    rosterMaximums: { QB: 1, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
  }, {
    leagueName: "Final slot nomination E2E",
    setupStatus: "published",
  });
  const leagueId = `${baseSeason.leagueId}-final-slot-mock`;
  const seasonId = `${leagueId}-season-${baseSeason.seasonYear}`;
  const season: LeagueSeason = {
    ...baseSeason,
    id: seasonId,
    leagueId,
    league: {
      ...baseSeason.league,
      id: leagueId,
      externalLeagueId: `${baseSeason.league.externalLeagueId}-final-slot-mock`,
    },
    teams: baseSeason.teams.map((team, index) => ({
      ...team,
      id: `${seasonId}-team-${index + 1}`,
      leagueSeasonId: seasonId,
      ownerId: `${team.ownerId}-final-slot-mock`,
    })),
  };
  const claimedTeam = teamByOwner(season, "Alpha");
  const createdSeason = expectOk(await api<SeasonBody>(page, "/seasons", {
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
  })).season;

  await page.goto(`/practice?seasonId=${encodeURIComponent(createdSeason.id)}`);
  await createAuctionMock(page);
  await expectAuctionMockSetup(page);
  await startAuctionMock(page);
  await expect(page.getByText("Open slots", { exact: true }).locator("..")).toContainText("1");

  const playerRows = availablePlayersTable(page).getByRole("row").filter({
    has: page.getByRole("button", { name: /^Nominate /u }),
  });
  const quarterbackAction = playerRows.filter({
    has: page.getByRole("cell", { name: "QB", exact: true }),
  }).first().getByRole("button", { name: /^Nominate /u });
  const invalidAction = playerRows.filter({
    has: page.getByRole("cell", { name: "RB", exact: true }),
  }).first().getByRole("button", { name: /^Nominate /u });
  await expect(quarterbackAction).toBeEnabled();
  await expect(invalidAction).toBeDisabled();

  const nominationResponse = page.waitForResponse(response =>
    response.request().method() === "POST"
    && response.url().includes("/season-mock-drafts/")
    && response.url().endsWith("/commands")
  );
  await quarterbackAction.click();
  expect((await nominationResponse).status()).toBe(200);
  await expect(page.getByRole("region", { name: "Live auction" })).toBeVisible();
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
    "Team,Cam,,,Sam,,,Seth,,,Alex,,",
    `1,$${camPrice},RB,De'Von Achane,$${samPrice},WR,CeeDee Lamb,$32,WR,Puka Nacua,$72,RB,Jahmyr Gibbs`,
    "2,$61,WR,Ja'Marr Chase,$9,QB,Trevor Lawrence,$68,RB,Bijan Robinson,$67,WR,Amon-Ra St. Brown",
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
  await expect(historyRows.nth(0)).toContainText("8 draft rows imported for 2023");
  await expect(historyRows.nth(1)).toContainText("8 draft rows imported for 2024");

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
  expect(updatedRoom.board.find(player => player.name === "Puka Nacua")?.expectedPrice)
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
  const headerLeaguePicker = page.getByRole("banner").getByRole("combobox", {
    name: "Active league",
  });
  await expect(headerLeaguePicker).toHaveText(`League A · ${String(seasonA.seasonYear)}`);
  await headerLeaguePicker.click();
  await page.getByRole("option", {
    name: `League B · ${String(seasonB.seasonYear)}`,
    exact: true,
  }).click();
  await expect(page.getByRole("button", { name: "Create league link" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Teams and managers" })).toHaveValue(/League B Cam/u);
  await delay(400);
  await expect(page.getByRole("button", { name: "Create league link" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Teams and managers" })).not.toHaveValue(/League A Cam/u);

  await page.goto(`/practice?seasonId=${encodeURIComponent(seasonA.id)}`);
  const leagueAMockSessionId = await createAuctionMock(page);
  await expectAuctionMockSetup(page);
  const mockLeaguePicker = page.getByRole("banner").getByRole("combobox", {
    name: "Active league",
  });
  await mockLeaguePicker.click();
  await page.getByRole("option", {
    name: `League B · ${String(seasonB.seasonYear)}`,
    exact: true,
  }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("seasonId")).toBe(seasonB.id);
  await expect(page.getByRole("button", { name: "Create auction mock" })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("sessionId")).toBeNull();
  expect(new URL(page.url()).searchParams.get("sessionId")).not.toBe(leagueAMockSessionId);
  await expect(page.getByText(/belongs to another league/u)).toHaveCount(0);
});

test("deployed platform supports authenticated workspaces without mutating the real draft", async ({ browser }) => {
  test.skip(!isDeployedSmoke, "Deployed smoke credentials are not used by local E2E.");
  await exerciseDeployedWorkspace(browser);
});
