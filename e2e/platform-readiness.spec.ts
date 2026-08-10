import { expect, test, type Browser, type Page } from "@playwright/test";
import { leagueConfig, ownerOrder } from "../config/league.js";
import type { AccountRecord } from "../src/platform/auth.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../src/platform/leagueSeason.js";
import type { LiveDraftRoom, LiveDraftRoomPlayerCatalogEntry } from "../src/platform/liveDraftRooms.js";
import type { PlatformLeagueMembership } from "../src/platform/platformApp.js";

const password = "e2e-secure-password";
const leagueName = "E2E League 214674";
const roomId = "room_e2e_readiness";
const exportedAt = "2026-08-09T15:30:00.000Z";

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

interface MembershipBody {
  membership: PlatformLeagueMembership;
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

interface BrowserSseEvent {
  type: string;
  lastEventId: string;
  data: unknown;
}

const playerCatalog = [
  { name: "Puka Nacua", position: "WR", expectedPrice: 73, teamAbbreviation: "LAR", byeWeek: 8 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72, teamAbbreviation: "DET", byeWeek: 8 },
  { name: "De'Von Achane", position: "RB", expectedPrice: 50, teamAbbreviation: "MIA", byeWeek: 12 },
  { name: "Amon-Ra St. Brown", position: "WR", expectedPrice: 67, teamAbbreviation: "DET", byeWeek: 8 },
] as const satisfies readonly LiveDraftRoomPlayerCatalogEntry[];

const expectOk = <TBody>(response: JsonResponse<TBody>): TBody => {
  const responseBody = JSON.stringify(response.body);
  expect(response.status, responseBody).toBeGreaterThanOrEqual(200);
  expect(response.status, responseBody).toBeLessThan(300);

  return response.body;
};

const api = async <TBody>(
  page: Page,
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
  } = {},
): Promise<JsonResponse<TBody>> =>
  await page.evaluate(async ({ path: requestPath, method, body }) => {
    const init: RequestInit = {
      method,
      credentials: "same-origin",
    };
    if (body !== undefined) {
      init.headers = { "content-type": "application/json" };
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
  }) as JsonResponse<TBody>;

const signUpAndLogIn = async (
  page: Page,
  email: string,
): Promise<AccountRecord> => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("#session-label")).toHaveText(email);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.locator("#session-label")).toHaveText("Signed out");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#session-label")).toHaveText(email);

  return expectOk(await api<AccountBody>(page, "/session")).account;
};

const pageForSignedInUser = async (
  browser: Browser,
  email: string,
): Promise<{ page: Page; account: AccountRecord }> => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const account = await signUpAndLogIn(page, email);

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
  sethAccount: AccountRecord,
): Promise<LeagueSeason> => {
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName,
    setupStatus: "published",
  });
  const camTeam = teamByOwner(season, "Cam");

  return expectOk(await api<SeasonBody>(page, "/seasons", {
    method: "POST",
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
        {
          userId: sethAccount.id,
          leagueId: season.leagueId,
          role: "member",
        },
      ],
    },
  })).season;
};

const applyCommissionerSetup = async (
  page: Page,
  season: LeagueSeason,
  camEmail: string,
): Promise<void> => {
  await page.goto("/setup");
  await expect(page.locator("#session-label")).toHaveText(camEmail);
  await page.locator("#setup-season-id-input").fill(season.id);
  await page.locator("#setup-rows-input").fill(setupRowsFor(camEmail));
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.locator("#setup-status")).toHaveText("Ready to apply.");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator("#setup-status")).toHaveText("Setup applied.");
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

test("platform web supports signup, login, setup, team claim, live room realtime sale, end, and export artifact", async ({ browser }) => {
  const camEmail = "cam.e2e@example.com";
  const sethEmail = "seth.e2e@example.com";
  const { page: camPage, account: camAccount } = await pageForSignedInUser(browser, camEmail);
  const { page: sethPage, account: sethAccount } = await pageForSignedInUser(browser, sethEmail);
  const seedSeason = await seedSeasonFromBrowser(camPage, camAccount, sethAccount);
  await applyCommissionerSetup(camPage, seedSeason, camEmail);

  const appliedSeason = expectOk(await api<SeasonBody>(camPage, `/seasons/${seedSeason.id}`)).season;
  const sethTeam = teamByOwner(appliedSeason, "Seth");
  const claimedMembership = expectOk(await api<MembershipBody>(sethPage, `/seasons/${appliedSeason.id}/team-claims`, {
    method: "POST",
    body: {
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
    },
  })).membership;

  expect(claimedMembership).toMatchObject({
    userId: sethAccount.id,
    leagueId: appliedSeason.leagueId,
    ownerId: sethTeam.ownerId,
    teamId: sethTeam.id,
  });

  const camTeam = teamByOwner(appliedSeason, "Cam");
  const createdRoom = expectOk(await api<LiveDraftRoomBody>(camPage, "/live-rooms", {
    method: "POST",
    body: {
      seasonId: appliedSeason.id,
      roomId,
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      initialRosters: [
        {
          teamId: camTeam.id,
          playerName: "De'Von Achane",
          position: "RB",
          price: 50,
          expectedPrice: 50,
        },
      ],
    },
  })).room;
  const startedRoom = expectOk(await api<LiveDraftRoomBody>(camPage, `/live-rooms/${roomId}/start`, {
    method: "POST",
    body: {
      expectedRevision: createdRoom.revision,
      idempotencyKey: `${roomId}:start`,
    },
  })).room;
  const saleEventPromise = waitForSaleEvent(sethPage, roomId, startedRoom.revision);
  const soldRoom = expectOk(await api<LiveDraftRoomBody>(camPage, `/live-rooms/${roomId}/sales`, {
    method: "POST",
    body: {
      expectedRevision: startedRoom.revision,
      idempotencyKey: `${roomId}:sale:puka:62`,
      command: "cam puka 62",
    },
  })).room;
  const saleEvent = await saleEventPromise;

  expect(soldRoom).toMatchObject({
    status: "live",
    revision: startedRoom.revision + 1,
    projection: {
      sales: [
        expect.objectContaining({
          ownerDisplayName: "Cam",
          playerName: "Puka Nacua",
          price: 62,
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
        ownerDisplayName: "Cam",
        playerName: "Puka Nacua",
        price: 62,
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

  const endedRoom = expectOk(await api<LiveDraftRoomBody>(camPage, `/live-rooms/${roomId}/end`, {
    method: "POST",
    body: {
      expectedRevision: soldRoom.revision,
      idempotencyKey: `${roomId}:end`,
    },
  })).room;
  expect(endedRoom).toMatchObject({
    status: "ended",
    revision: soldRoom.revision + 1,
  });

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
  expect(exportArtifact.content).toContain("Puka Nacua,62");
  expect(exportArtifact.content).toContain("De'Von Achane,50");
});
