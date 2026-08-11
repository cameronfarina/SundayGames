import { expect, test, type Browser, type Page } from "@playwright/test";
import { leagueConfig, ownerOrder } from "../config/league.js";
import type { AccountRecord } from "../src/platform/auth.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../src/platform/leagueSeason.js";
import type { LiveDraftRoom } from "../src/platform/liveDraftRooms.js";
import type { PlatformLeagueMembership } from "../src/platform/platformApp.js";
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
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("#account-email")).toHaveText(email).catch(async error => {
    const authError = (await page.locator("#auth-error").textContent())?.trim() ?? "";
    if (!authError.includes("already exists")) throw error;

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("#account-email"), [
      `Smoke account ${email} already existed but could not sign in with the configured password.`,
      "Use a fresh MOCKD_E2E_RUN_ID or set MOCKD_E2E_PASSWORD to the password used for that run.",
      authError,
    ].join(" ")).toHaveText(email);
  });

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.locator("#auth-panel")).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
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
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(accountPassword);
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
    setupStatus: "published",
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
  await page.getByText("Import owner list", { exact: true }).click();
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

  return await page.evaluate(() => navigator.clipboard.readText());
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

const deployedWorkspace = async (browser: Browser): Promise<ReadySmokeWorkspace> => {
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
  if (commissionerLeague.liveDraft !== null) {
    throw new Error(
      `Dedicated smoke season ${environment.seasonId} already has draft room ${commissionerLeague.liveDraft.roomId}. ` +
      "Provision a fresh smoke season before rerunning this destructive deployed smoke.",
    );
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

  await commissionerPage.goto(`/setup?seasonId=${encodeURIComponent(season.id)}`);
  await expect(commissionerPage.locator("#setup-season-id-input")).toHaveValue(season.id);
  await expect(commissionerPage.getByRole("button", { name: "Create draft room" })).toBeEnabled();
  const room = await createLiveRoomFromSetup(commissionerPage, season);
  const commissionerTeam = room.projection.teams.find(
    team => team.teamId === commissionerLeague.membership.teamId,
  );
  if (commissionerTeam === undefined || commissionerTeam.rosterSlotsRemaining < 1) {
    throw new Error("The deployed smoke commissioner team must have at least one open roster slot.");
  }
  const salePrice = season.settings.auction.minimumBidDollars;
  if (commissionerTeam.maxBid < salePrice) {
    throw new Error("The deployed smoke commissioner team must be able to place at least the league minimum bid.");
  }
  const salePlayer = room.projection.board[0];
  if (salePlayer === undefined) {
    throw new Error(`Pre-provisioned smoke season ${season.id} has no available player to sell.`);
  }

  return {
    commissionerPage,
    memberPage,
    season,
    room,
    commissionerOwnerName: commissionerIdentity.ownerName,
    memberOwnerName: memberIdentity.ownerName,
    commissionerTeamName: commissionerIdentity.teamName,
    memberTeamName: memberIdentity.teamName,
    salePlayerName: salePlayer.name,
    salePrice,
  };
};

const exerciseReadyWorkspace = async (workspace: ReadySmokeWorkspace): Promise<void> => {
  const {
    commissionerPage: camPage,
    memberPage: sethPage,
    season: appliedSeason,
    room: createdRoom,
    commissionerOwnerName,
    memberOwnerName,
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

  await camPage.getByRole("link", { name: "Board", exact: true }).click();
  await expect(camPage).toHaveURL(/\/board\?seasonId=/);
  expect(new URL(camPage.url()).searchParams.get("owner")).toBe(commissionerOwnerName);
  await expect(camPage.locator("#draft-room-view")).toBeVisible();
  await expect(camPage.locator("#room-title")).toHaveText("Draft Board");
  await expect(camPage.locator("#draft-room-view")).toHaveClass(/platform-prep/);
  await expect(camPage.locator("#quick-sale-form")).not.toBeVisible();
  await expect(camPage.locator("#board-count")).toContainText(`${createdRoom.projection.board.length} loaded`);
  await expect(camPage.locator("#board .player-name").first()).toBeVisible();
  expect(await camPage.locator("#board .player-name").count()).toBe(120);
  await camPage.locator("#app-menu-button").click();
  await camPage.getByRole("menuitem", { name: "League home" }).click();
  await expect(camPage).toHaveURL(new RegExp(`/app\\?seasonId=`));
  await expect(camPage.locator("#league-name")).toHaveText(appliedSeason.league.name);

  await sethPage.getByRole("link", { name: "Mock drafts", exact: true }).click();
  await expect(sethPage).toHaveURL(/\/mock-drafts\?seasonId=/);
  expect(new URL(sethPage.url()).searchParams.get("owner")).toBe(memberOwnerName);
  await expect(sethPage.locator("#draft-room-view")).toBeVisible();
  await expect(sethPage.locator("#draft-mode-status")).toContainText("Mock draft");
  await expect(sethPage.locator("#roster-owner")).toHaveValue(memberOwnerName);
  await expect(sethPage.locator("#board-count")).toContainText(`${createdRoom.projection.board.length} loaded`);

  await sethPage.goto(`/app?seasonId=${encodeURIComponent(appliedSeason.id)}`);
  await sethPage.getByRole("link", { name: "Simulations", exact: true }).click();
  await expect(sethPage).toHaveURL(/\/simulations\?seasonId=/);
  expect(new URL(sethPage.url()).searchParams.get("owner")).toBe(memberOwnerName);
  await expect(sethPage.locator("#mock-simulations-view")).toBeVisible();

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

test("deployed platform supports pre-provisioned invite-only accounts through realtime draft and export", async ({ browser }) => {
  test.skip(!isDeployedSmoke, "Deployed smoke credentials are not used by local E2E.");
  await exerciseReadyWorkspace(await deployedWorkspace(browser));
});
