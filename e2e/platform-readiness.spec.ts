import { expect, test, type Browser, type Page } from "@playwright/test";
import { leagueConfig, ownerOrder } from "../config/league.js";
import type { AccountRecord } from "../src/platform/auth.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../src/platform/leagueSeason.js";
import type { LiveDraftRoom } from "../src/platform/liveDraftRooms.js";
import type { PlatformLeagueMembership } from "../src/platform/platformApp.js";
import { leagueSeasonSetupRevision } from "../src/platform/leagueSetup.js";
import type { PlatformOnboardingLeague } from "../src/platform/platformOnboarding.js";

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

const emailFor = (name: "cam" | "seth"): string =>
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
  await expect(page.locator("#account-email")).toHaveText(email).catch(async error => {
    const authError = (await page.locator("#auth-error").textContent())?.trim() ?? "";
    if (!authError.includes("already exists")) throw error;

    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("#account-email"), [
      `Smoke account ${email} already existed but could not sign in with the configured password.`,
      "Use a fresh MOCKD_E2E_RUN_ID or set MOCKD_E2E_PASSWORD to the password used for that run.",
      authError,
    ].join(" ")).toHaveText(email);
  });

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.locator("#auth-panel")).toBeVisible();

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#account-email")).toHaveText(email);

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
  await expect(page.locator("#account-email"), [
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

const setupRowsFor = (camEmail: string, sethEmail: string): string =>
  [
    "owner,team,email,role",
    ...ownerOrder.map(owner => {
      const email = owner === "Cam" ? camEmail : owner === "Seth" ? sethEmail : "";
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
  sethEmail: string,
): Promise<string> => {
  await page.goto(`/setup?seasonId=${encodeURIComponent(season.id)}`);
  await expect(page.locator("#account-email")).toHaveText(camEmail);
  await expect(page.locator("#setup-season-id-input")).toHaveValue(season.id);
  await page.getByText("Advanced: paste a team list", { exact: true }).click();
  await page.locator("#setup-rows-input").fill(setupRowsFor(camEmail, sethEmail));
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.locator("#setup-status")).toHaveText("Ready to apply.");
  await expect(page.locator("#setup-preview-body tr")).toHaveCount(ownerOrder.length);
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect(page.locator("#setup-status")).toHaveText("League setup updated.");
  const sethInvitation = page.locator("#setup-invitations .invitation-row").filter({ hasText: sethEmail });
  await expect(sethInvitation).toContainText("Pending");
  await sethInvitation.getByRole("button", { name: "Copy invite link" }).click();
  await expect(page.locator("#setup-status")).toHaveText("Invite link copied.");

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

  return await page.evaluate(() => navigator.clipboard.readText());
};

const openUnifiedBoard = async (
  page: Page,
  seasonId: string,
  expectedPlayerCount?: number,
): Promise<void> => {
  await page.getByRole("link", { name: "Board", exact: true }).click();
  await expect(page).toHaveURL(/\/board\?contextSeasonId=/);
  expect(new URL(page.url()).searchParams.get("contextSeasonId")).toBe(seasonId);
  await expect(page.locator("#standalone-board")).toBeVisible();
  await expect(page.locator("#standalone-player-rows .player-name").first()).toBeVisible();
  await expect(page.locator("#standalone-board-status")).toContainText("loaded");
  await expect(page.locator("#standalone-board-sort")).toHaveValue(/market|our/);
  await expect(page.locator("#standalone-pricing-source")).toContainText("Pricing source:");
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
  const mockViewport = await page.locator("#mock-draft-player-scroll").evaluate(element => ({
    clientHeight: element.clientHeight,
    maxHeight: getComputedStyle(element).maxHeight,
  }));
  expect(mockViewport.clientHeight).toBeLessThanOrEqual(720);
  expect(mockViewport.maxHeight).not.toBe("none");

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
  const persistedOnClock = await page.locator("#mock-draft-on-clock").textContent();
  const persistedRoster = await page.locator("#mock-draft-roster").textContent();
  const persistedSessionId = new URL(page.url()).searchParams.get("mockSessionId");
  await page.reload();
  await expect(page.locator("#mock-draft-workspace")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("mockSessionId")).toBe(persistedSessionId);
  await expect(page.locator("#mock-draft-state")).toHaveText(persistedState ?? "");
  await expect(page.locator("#mock-draft-progress")).toHaveText(persistedProgress ?? "");
  await expect(page.locator("#mock-draft-on-clock")).toHaveText(persistedOnClock ?? "");
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
  const { page: camPage, account: camAccount } = await pageForLocalFixtureUser(browser, camEmail);
  const seedSeason = await seedSeasonFromBrowser(camPage, camAccount);
  const invitationUrl = await applyCommissionerSetup(camPage, seedSeason, camEmail, sethEmail);
  const createdRoom = await createLiveRoomFromSetup(camPage, seedSeason);
  expect(createdRoom.playerCatalog).toHaveLength(500);
  expect(createdRoom.initialRosters).toHaveLength(7);
  const { page: sethPage } = await pageForLocalFixtureUser(browser, sethEmail);
  await sethPage.goto(invitationUrl);
  await expect(sethPage.locator("#invite-workspace")).toBeVisible();
  await Promise.all([
    sethPage.waitForURL(/\/app\?seasonId=/),
    sethPage.getByRole("button", { name: "Accept invitation" }).click(),
  ]);
  const acceptedOnboarding = expectOk(await api<{ leagues: Array<{ membership: PlatformLeagueMembership }> }>(
    sethPage,
    "/onboarding",
  ));
  await expect(sethPage.locator("#league-name")).toHaveText(leagueName);
  await expect(sethPage.locator("#my-team-name")).toHaveText("Seth");

  const appliedSeason = expectOk(await api<SeasonBody>(camPage, `/seasons/${seedSeason.id}`)).season;
  const sethTeam = teamByOwner(appliedSeason, "Seth");
  expect(acceptedOnboarding.leagues[0]?.membership).toMatchObject({
    role: "member",
    ownerId: sethTeam.ownerId,
    teamId: sethTeam.id,
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
  await expect(camPage.locator("#standalone-board-open-live")).toHaveText("Live draft");
  await camPage.getByRole("link", { name: "League", exact: true }).click();
  await expect(camPage).toHaveURL(/\/league\?seasonId=/);
  await expect(camPage.locator("#league-name")).toHaveText(appliedSeason.league.name);
  await expect(camPage.locator("#create-league-nav-item")).toBeVisible();
  await camPage.locator("#create-league-nav-item").click();
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

test("commissioner can review a screenshot import and create a team invite link", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Screenshot fixture interception is only used by local E2E.");
  const email = smokeRunId === undefined
    ? "screenshot.e2e@example.com"
    : `screenshot.e2e+${smokeRunId}@${emailDomain}`;
  const { page, account } = await pageForLocalFixtureUser(browser, email);
  await page.setViewportSize({ width: 390, height: 844 });
  const baseSeason = namespacedSeasonForSmoke(buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: "Screenshot Import League",
    setupStatus: "published",
  }));
  const leagueId = `${baseSeason.leagueId}-screenshot`;
  const seasonId = `${leagueId}-season-${baseSeason.seasonYear}`;
  const season: LeagueSeason = {
    ...baseSeason,
    id: seasonId,
    leagueId,
    league: {
      ...baseSeason.league,
      id: leagueId,
      externalLeagueId: `${baseSeason.league.externalLeagueId}-screenshot`,
      name: "Screenshot Import League",
    },
    teams: baseSeason.teams.map(team => ({
      ...team,
      id: `${team.id}-screenshot`,
      leagueSeasonId: seasonId,
      ownerId: `${team.ownerId}-screenshot`,
    })),
  };
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

  const extractedTeams = ownerOrder.map((manager, index) => ({
    targetTeamId: season.teams[index]?.id,
    draftOrderPosition: index + 1,
    abbreviation: manager.slice(0, 4).toUpperCase(),
    teamDisplayName: `${manager} ESPN Team`,
    managerDisplayNames: index === 3 ? [manager, "Co Manager"] : [manager],
    confidence: index === 1 ? "medium" : "high",
    issues: index === 1 ? ["Verify the manager name."] : [],
    confirmed: false,
  }));
  await page.route("**/setup-import/screenshot-analyze", async route => {
    const request = route.request().postDataJSON() as { mimeType: string; base64: string };
    expect(request.mimeType).toBe("image/png");
    expect(request.base64.length).toBeGreaterThan(0);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        setupRevision: leagueSeasonSetupRevision(season),
        extraction: {
          leagueName: "The Sunday Games",
          externalLeagueId: "214674",
          teams: extractedTeams,
        },
        availableTeamProfiles: season.teams.map(team => ({
          teamId: team.id,
          ownerDisplayName: team.ownerDisplayName,
          teamDisplayName: team.displayName,
        })),
        import: {
          status: "blocked",
          blockers: [{ message: "Team row 2 needs commissioner confirmation because the screenshot was unclear." }],
          records: [],
          rows: [],
        },
      }),
    });
  });

  await page.goto(`/setup?seasonId=${encodeURIComponent(season.id)}`);
  const expectNoPageOverflow = async (): Promise<void> => {
    const dimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  };
  await expectNoPageOverflow();
  await page.locator("#screenshot-import-file").setInputFiles({
    name: "league-members.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Analyze screenshot" }).click();
  await expect(page.locator("#screenshot-review-body tr")).toHaveCount(ownerOrder.length);
  await expect(page.locator("#screenshot-source-preview")).toBeVisible();
  await expectNoPageOverflow();
  await expect(page.locator("#screenshot-review-table th")).toHaveText([
    "Team #",
    "Abbr",
    "Team",
    "Managers",
    "Mockd profile",
    "Review",
  ]);
  const uncertainRow = page.locator("#screenshot-review-body tr").nth(1);
  await uncertainRow.getByLabel("I verified this row").check();
  const firstRow = page.locator("#screenshot-review-body tr").first();
  await firstRow.getByLabel("Team name for row 1").fill("Commissioner Club");
  await page.getByRole("button", { name: "Apply teams" }).click();
  await expect(page.locator("#screenshot-import-status")).toContainText(`${ownerOrder.length} teams imported`);
  await expect(page.locator("#setup-team-body tr")).toHaveCount(ownerOrder.length);
  await expect(page.locator("#setup-team-body tr").first()).toContainText("Commissioner Club");
  await expect(page.locator("#invitation-team-picker option")).toHaveCount(ownerOrder.length - 1);
  await expectNoPageOverflow();

  await page.locator("#invitation-team-picker").selectOption({ index: 1 });
  await page.locator("#invitation-email-input").fill("manager.invite@example.com");
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.locator("#invitation-create-status")).toHaveText(
    "Invite link created. Copy it before leaving this page.",
  );
  const invitation = page.locator("#setup-invitations .invitation-row").filter({
    hasText: "manager.invite@example.com",
  });
  await expect(invitation.getByRole("button", { name: "Copy invite link" })).toBeVisible();
});

test("commissioner league switching discards stale setup responses", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local route delays are not used by deployed smoke.");
  const { page, account } = await pageForLocalFixtureUser(browser, "setup.switch.e2e@example.com");
  await page.setViewportSize({ width: 390, height: 844 });
  const owners = ["Cam", "Seth", "Beaton"];
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
    body: { seasonId: seasonA.id, teamId: seasonA.teams[1]?.id, email: "league-a@example.com" },
  }));
  expectOk(await api(page, "/invitations", {
    method: "POST",
    body: { seasonId: seasonB.id, teamId: seasonB.teams[1]?.id, email: "league-b@example.com" },
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
  await expect(page.locator("#league-picker")).toHaveValue(seasonA.id);
  await page.locator("#screenshot-import-file").setInputFiles({
    name: "league-a.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  await page.locator("#league-picker").selectOption(seasonB.id);
  await expect(page.locator("#setup-invitations")).toContainText("league-b@example.com");
  await expect(page.locator("#setup-team-body")).toContainText("League B Cam");
  await delay(400);
  await expect(page.locator("#setup-invitations")).not.toContainText("league-a@example.com");
  await expect(page.locator("#setup-team-body")).not.toContainText("League A Cam");
  expect(await page.locator("#screenshot-import-file").evaluate(
    input => (input as HTMLInputElement).files?.length ?? 0,
  )).toBe(0);

  const importedTeams = owners.map((manager, index) => ({
    targetTeamId: seasonB.teams[index]?.id,
    draftOrderPosition: index + 1,
    abbreviation: manager.toUpperCase(),
    teamDisplayName: `Imported B ${manager}`,
    managerDisplayNames: [manager],
    confidence: "high",
    issues: [],
    confirmed: false,
  }));
  await page.route("**/setup-import/screenshot-analyze", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        setupRevision: leagueSeasonSetupRevision(seasonB),
        extraction: { leagueName: "League B", externalLeagueId: "switch-b", teams: importedTeams },
        availableTeamProfiles: seasonB.teams.map(team => ({
          teamId: team.id,
          ownerDisplayName: team.ownerDisplayName,
          teamDisplayName: team.displayName,
        })),
        import: { status: "ready", blockers: [], records: [], rows: [] },
      }),
    });
  });
  await page.route("**/setup-import/screenshot-apply", async route => {
    const response = await route.fetch();
    await delay(300);
    await route.fulfill({ response });
  });
  await page.locator("#screenshot-import-file").setInputFiles({
    name: "league-b.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Analyze screenshot" }).click();
  await expect(page.getByRole("button", { name: "Apply teams" })).toBeEnabled();
  await page.getByRole("button", { name: "Apply teams" }).click();
  await page.locator("#league-picker").selectOption(seasonA.id);
  await expect(page.locator("#setup-team-body")).toContainText("League A Cam");
  await delay(400);
  await expect(page.locator("#setup-team-body")).not.toContainText("Imported B Cam");
  await expect(page.locator("#setup-season-id-input")).toHaveValue(seasonA.id);
});

test("deployed platform supports authenticated workspaces without mutating the real draft", async ({ browser }) => {
  test.skip(!isDeployedSmoke, "Deployed smoke credentials are not used by local E2E.");
  await exerciseDeployedWorkspace(browser);
});
