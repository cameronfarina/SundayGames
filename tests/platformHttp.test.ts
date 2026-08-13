import { describe, expect, it, vi } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { canonicalPlayerIdentityKey } from "../src/data/normalizePlayerName.js";
import type { MockBatch } from "../src/modeling/mockBatch.js";
import { CapturingAuthMailSender, type AccountRecord } from "../src/platform/auth.js";
import {
  createClientAddressRateLimiter,
  createNormalizedEmailRateLimiter,
} from "../src/platform/authRateLimit.js";
import {
  buildCurrentMockdLeagueSeason,
  defaultScoringSettings,
  type LeagueSeason,
} from "../src/platform/leagueSeason.js";
import {
  InMemoryLiveDraftRoomRepository,
  type LiveDraftRoomPlayerCatalogEntry,
} from "../src/platform/liveDraftRooms.js";
import { InMemoryLiveDraftRoomSetupRepository } from "../src/platform/liveDraftRoomSetups.js";
import { postDraftScoringSettingsIdForSeason } from "../src/platform/postDraftLiveRoomAdapter.js";
import {
  InMemoryPlatformInvitationRepository,
  hashPlatformInvitationToken,
  issuePlatformInvitation,
} from "../src/platform/platformInvitations.js";
import {
  createPlatformApp,
  InMemoryPlatformStore,
  type PlatformLeagueMembership,
} from "../src/platform/platformApp.js";
import {
  createPricingSnapshot,
  hashPricingSnapshotInputs,
} from "../src/platform/pricingSnapshots.js";
import {
  createPlatformHttpHandler,
  type PlatformApp,
  type PlatformHttpHandler,
  type PlatformHttpRequest,
  type PlatformHttpResponse,
} from "../src/platform/platformHttp.js";
import type { SimulationMockBatchRunner } from "../src/platform/simulations.js";
import type { SeasonSimulationTargetConstraint } from "../src/platform/seasonSimulationEngine.js";

const now = new Date("2026-08-09T12:00:00.000Z");

const playerCatalog = [
  { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
  { name: "Xavier Legette", position: "WR", expectedPrice: 2 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
  { name: "De'Von Achane", position: "RB", expectedPrice: 50 },
] as const satisfies readonly LiveDraftRoomPlayerCatalogEntry[];

const snakePlayerCatalog = [
  { name: "Player 1", position: "RB", expectedPrice: 50 },
  { name: "Player 2", position: "WR", expectedPrice: 49 },
  { name: "Player 3", position: "TE", expectedPrice: 48 },
  { name: "Player 4", position: "QB", expectedPrice: 47 },
  { name: "Player 5", position: "RB", expectedPrice: 46 },
  { name: "Player 6", position: "WR", expectedPrice: 45 },
  { name: "Player 7", position: "TE", expectedPrice: 44 },
  { name: "Player 8", position: "QB", expectedPrice: 43 },
] as const satisfies readonly LiveDraftRoomPlayerCatalogEntry[];

const snakeSeason = (): LeagueSeason => ({
  id: "snake-season-2026",
  leagueId: "snake-league",
  league: { id: "snake-league", externalLeagueId: "snake-1", name: "Snake League", provider: "espn" },
  seasonYear: 2026,
  setupStatus: "published",
  teams: ["Cam", "Sam", "Matt", "Nick"].map((name, index) => ({
    id: `snake-team-${index + 1}`,
    leagueSeasonId: "snake-season-2026",
    ownerId: `snake-owner-${index + 1}`,
    ownerDisplayName: name,
    displayName: `${name} Team`,
    draftOrderPosition: index + 1,
  })),
  settings: {
    expectedTeamCount: 4,
    draftFormat: "snake",
    scoring: {
      passingYards: 0.04,
      passingTouchdown: 4,
      rushingYards: 0.1,
      rushingTouchdown: 6,
      receivingYards: 0.1,
      receivingTouchdown: 6,
      reception: 0.5,
    },
    snake: {
      rounds: 2,
      order: ["snake-team-1", "snake-team-2", "snake-team-3", "snake-team-4"],
      reversal: "standard",
    },
    roster: {
      rosterSize: 2,
      lineup: { BENCH: 2 },
      lineupSlotCount: 2,
      rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 1, DST: 1 },
    },
    keeperPolicy: { mode: "previous-cost-multiplier", multiplier: 1.2, rounding: "ceil" },
  },
});

const mockRunner: SimulationMockBatchRunner = ({
  runsPerScenario,
  seedPrefix,
  forcedSales,
}): MockBatch => ({
  options: {
    scenarioKeys: ["expected"],
    runsPerScenario,
    seedPrefix,
    forcedSales: [...forcedSales],
  },
  runs: [],
  summary: {
    runCount: runsPerScenario,
    scenarios: [],
    players: [],
    owners: [],
    ownerPlayerExposure: [],
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const expectBodyRecord = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error("Expected response body record.");

  return value;
};

const expectString = (value: unknown): string => {
  if (typeof value !== "string") throw new Error("Expected string response field.");

  return value;
};

const expectAccount = (value: unknown): AccountRecord => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.email !== "string" ||
    !(value.createdAt instanceof Date) ||
    !(value.updatedAt instanceof Date)
  ) {
    throw new Error("Expected account response field.");
  }

  return {
    id: value.id,
    email: value.email,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

const sessionTokenFrom = (response: PlatformHttpResponse): string => {
  const setCookie = response.headers?.["Set-Cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const match = cookie?.match(/(?:^|;\s*)mockd_session=([^;]+)/);
  if (match?.[1] === undefined) throw new Error("Expected a Mockd session cookie.");

  return decodeURIComponent(match[1]);
};

const browserPayloadDenylist = new Set([
  "actorUserId",
  "commissionerUserId",
  "idempotencyKey",
  "mutationHash",
  "passwordHash",
  "sessionToken",
  "tokenHash",
  "viewerPasswordHashRef",
]);

const expectPublicBrowserPayload = (value: unknown): void => {
  const visit = (candidate: unknown): void => {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (!isRecord(candidate)) return;

    for (const [key, nestedValue] of Object.entries(candidate)) {
      expect(browserPayloadDenylist, `Browser payload exposed ${key}.`).not.toContain(key);
      visit(nestedValue);
    }
  };

  visit(value);
};

const createLoggedInAccount = async (
  handle: PlatformHttpHandler,
  email: string,
): Promise<{ account: AccountRecord; sessionToken: string }> => {
  await handle({
    method: "POST",
    path: "/accounts",
    body: {
      email,
      password: "secure password",
      now,
    },
  });

  const login = await handle({
    method: "POST",
    path: "/sessions",
    body: {
      email,
      password: "secure password",
      now,
    },
  });
  const loginBody = expectBodyRecord(login.body);

  return {
    account: expectAccount(loginBody.account),
    sessionToken: sessionTokenFrom(login),
  };
};

describe("platform HTTP contract", () => {
  it("rate limits live draft mutations before invoking domain changes", async () => {
    const pauseLiveDraftRoom = vi.fn(async () => undefined);
    const getLiveDraftRoomState = vi.fn(async () => ({ status: "paused", revision: 2 }));
    const app = {
      findAccountBySessionToken: vi.fn(async () => ({ id: "account-1" })),
      pauseLiveDraftRoom,
      getLiveDraftRoomState,
    } as unknown as PlatformApp;
    const handle = createPlatformHttpHandler(app, {
      liveDraftMutationRateLimiter: createClientAddressRateLimiter({
        maxAttempts: 1,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
    });
    const request = {
      method: "POST",
      path: "/live-rooms/room-1/pause",
      sessionToken: "session-1",
      now,
      body: {
        expectedRevision: 1,
        idempotencyKey: "pause-1",
      },
    } as const;

    await expect(handle(request)).resolves.toMatchObject({ status: 200 });
    await expect(handle({
      ...request,
      body: { expectedRevision: 2, idempotencyKey: "pause-2" },
    })).resolves.toEqual({
      status: 429,
      headers: { "Retry-After": "60" },
      body: {
        error: {
          code: "rate_limited",
          message: "Too many live draft changes. Try again shortly.",
        },
      },
    });
    expect(pauseLiveDraftRoom).toHaveBeenCalledTimes(1);
    expect(getLiveDraftRoomState).toHaveBeenCalledTimes(1);
  });

  it("verifies production signups and resets passwords without enumerating accounts", async () => {
    const mailSender = new CapturingAuthMailSender();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      simulationRunner: mockRunner,
      authEmail: {
        verificationRequired: true,
        mailSender,
        publicBaseUrl: "https://mockd.example.com",
      },
    });
    const handle = createPlatformHttpHandler(app, { emailVerificationRequired: true });

    await expect(handle({
      method: "POST",
      path: "/accounts",
      now,
      body: {
        email: "owner@example.com",
        password: "secure password",
        returnTo: "/invite?token=league-invite",
      },
    })).resolves.toEqual({
      status: 202,
      body: {
        accepted: true,
        message: "If this email can be registered, a verification link is on its way.",
      },
    });
    await expect(handle({
      method: "POST",
      path: "/sessions",
      now,
      body: { email: "owner@example.com", password: "secure password" },
    })).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "email_unverified" } },
    });

    const verificationToken = new URL(mailSender.messages[0]!.actionUrl).searchParams.get("token")!;
    expect(new URL(mailSender.messages[0]!.actionUrl).searchParams.get("returnTo"))
      .toBe("/invite?token=league-invite");
    await expect(handle({
      method: "POST",
      path: "/email-verifications/consume",
      now: new Date(now.getTime() + 1_000),
      body: { token: verificationToken },
    })).resolves.toEqual({ status: 200, body: { verified: true } });
    const mailCountAfterVerification = mailSender.messages.length;
    await expect(handle({
      method: "POST",
      path: "/accounts",
      now: new Date(now.getTime() + 1_500),
      body: { email: "OWNER@example.com", password: "attacker replacement password" },
    })).resolves.toMatchObject({ status: 202, body: { accepted: true } });
    expect(mailSender.messages).toHaveLength(mailCountAfterVerification);
    await expect(handle({
      method: "POST",
      path: "/sessions",
      now: new Date(now.getTime() + 2_000),
      body: { email: "owner@example.com", password: "secure password" },
    })).resolves.toMatchObject({ status: 200 });

    const missingReset = await handle({
      method: "POST",
      path: "/password-resets",
      now,
      body: { email: "missing@example.com" },
    });
    const existingReset = await handle({
      method: "POST",
      path: "/password-resets",
      now,
      body: { email: "owner@example.com" },
    });
    expect(existingReset).toEqual(missingReset);
    const resetToken = new URL(mailSender.messages.at(-1)!.actionUrl).searchParams.get("token")!;
    await expect(handle({
      method: "POST",
      path: "/password-resets/consume",
      now: new Date(now.getTime() + 3_000),
      body: {
        token: resetToken,
        newPassword: "replacement password",
        newPasswordConfirmation: "replacement password",
      },
    })).resolves.toEqual({ status: 200, body: { reset: true } });
  });

  it("rate limits verification and password reset requests by normalized email", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      verificationRateLimiter: createNormalizedEmailRateLimiter({
        maxAttempts: 1,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
      passwordResetRateLimiter: createNormalizedEmailRateLimiter({
        maxAttempts: 1,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
    });

    await expect(handle({
      method: "POST",
      path: "/email-verifications",
      clientAddress: "127.0.0.1",
      now,
      body: { email: "Owner@Example.com" },
    })).resolves.toMatchObject({ status: 202 });
    await expect(handle({
      method: "POST",
      path: "/email-verifications",
      clientAddress: "127.0.0.1",
      now,
      body: { email: " owner@example.COM " },
    })).resolves.toMatchObject({ status: 429, body: { error: { code: "auth_rate_limited" } } });

    await expect(handle({
      method: "POST",
      path: "/password-resets",
      clientAddress: "127.0.0.2",
      now,
      body: { email: "Owner@Example.com" },
    })).resolves.toMatchObject({ status: 202 });
    await expect(handle({
      method: "POST",
      path: "/password-resets",
      clientAddress: "127.0.0.2",
      now,
      body: { email: " owner@example.COM " },
    })).resolves.toMatchObject({ status: 429, body: { error: { code: "auth_rate_limited" } } });
  });

  it("rate limits password reset consumption by client address", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      passwordResetConsumeRateLimiter: createClientAddressRateLimiter({
        maxAttempts: 1,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
    });
    const request = {
      method: "POST",
      path: "/password-resets/consume",
      clientAddress: "127.0.0.3",
      now,
      body: {
        token: "invalid-token",
        newPassword: "replacement secure password",
        newPasswordConfirmation: "replacement secure password",
      },
    } as const;

    await expect(handle(request)).resolves.toMatchObject({ status: 400 });
    await expect(handle(request)).resolves.toMatchObject({
      status: 429,
      body: { error: { code: "rate_limited" } },
    });
  });

  it("serves the current player catalog to signed-in users without requiring a league", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const currentPlayerCatalogProvider = vi.fn(async () => playerCatalog);
    const handle = createPlatformHttpHandler(app, { currentPlayerCatalogProvider });
    const login = await createLoggedInAccount(handle, "board-first@example.com");

    await expect(handle({ method: "GET", path: "/player-catalog" })).resolves.toMatchObject({
      status: 401,
      body: { error: { code: "auth_required" } },
    });
    await expect(handle({
      method: "GET",
      path: "/player-catalog",
      sessionToken: login.sessionToken,
    })).resolves.toEqual({
      status: 200,
      body: { players: playerCatalog },
    });
    await expect(handle({
      method: "POST",
      path: "/player-catalog",
      sessionToken: login.sessionToken,
    })).resolves.toMatchObject({ status: 405 });
    expect(currentPlayerCatalogProvider).toHaveBeenCalledTimes(1);
  });

  it("prices Practice from only the latest matching league snapshot", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      currentPlayerCatalogProvider: async () => playerCatalog,
    });
    const cam = await createLoggedInAccount(handle, "latest-practice-pricing@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "published" });
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [{
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: season.teams[0]?.ownerId,
          teamId: season.teams[0]?.id,
        }],
      },
    });
    store.pricingSnapshots.save(createPricingSnapshot({
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      modelVersion: "older-large-model",
      scenarioId: "expected",
      inputSnapshot: {
        id: "older-large-input",
        hash: hashPricingSnapshotInputs({ version: "older-large" }),
      },
      prices: Array.from({ length: 5_000 }, (_, index) => ({
        name: `Older Player ${index}`,
        normalizedName: `older player ${index}`,
        position: "WR" as const,
        price: 1,
      })),
    }));
    const latest = store.pricingSnapshots.save(createPricingSnapshot({
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      modelVersion: "latest-model",
      scenarioId: "expected",
      inputSnapshot: {
        id: "latest-input",
        hash: hashPricingSnapshotInputs({ version: "latest" }),
      },
      prices: playerCatalog.map(player => ({
        name: player.name,
        normalizedName: canonicalPlayerIdentityKey(player.name),
        position: player.position,
        price: player.name === "Puka Nacua" ? 41 : player.expectedPrice,
      })),
    }));
    const legacyList = vi.spyOn(app, "listLeaguePricingSnapshots")
      .mockRejectedValue(new Error("Practice must not list every pricing snapshot."));

    await expect(handle({
      method: "GET",
      path: "/player-catalog",
      query: { seasonId: season.id },
      sessionToken: cam.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        personalized: true,
        pricingModelRunId: latest.modelRunId,
        players: expect.arrayContaining([
          expect.objectContaining({ name: "Puka Nacua", marketPrice: 41 }),
        ]),
      },
    });
    expect(legacyList).not.toHaveBeenCalled();
  });

  it("marks snake keepers on the Practice catalog", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const liveDraftRoomSetupRepository = new InMemoryLiveDraftRoomSetupRepository();
    const handle = createPlatformHttpHandler(app, {
      currentPlayerCatalogProvider: async () => snakePlayerCatalog,
      liveDraftRoomSetupRepository,
    });
    const cam = await createLoggedInAccount(handle, "snake-practice-keepers@example.com");
    const season = snakeSeason();
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [{
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: season.teams[0]?.ownerId,
          teamId: season.teams[0]?.id,
        }],
      },
    });
    await liveDraftRoomSetupRepository.save({
      seasonId: season.id,
      sourceVersion: "snake-keepers",
      playerCatalog: snakePlayerCatalog,
      initialRosters: [{
        teamId: season.teams[0]?.id ?? "snake-team-1",
        playerId: "player 1",
        playerName: "Player 1",
        position: "RB",
        price: 1,
        keeperRound: 1,
        source: "keeper",
      }],
      updatedAt: now,
    });

    await expect(handle({
      method: "GET",
      path: "/player-catalog",
      query: { seasonId: season.id },
      sessionToken: cam.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        draftFormat: "snake",
        players: expect.arrayContaining([
          expect.objectContaining({
            name: "Player 1",
            isKeeper: true,
            keeperRound: 1,
            keeperTeamId: season.teams[0]?.id,
          }),
        ]),
      },
    });
  });

  it("returns a typed conflict without persisting a snake hosted room through provisioning", async () => {
    const liveDraftRoomRepository = new InMemoryLiveDraftRoomRepository();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      liveDraftRoomRepository,
      simulationRunner: mockRunner,
    });
    const handle = createPlatformHttpHandler(app, {
      allowPublicSignup: true,
      provisioningToken: "test-provisioning-token",
    });
    const cam = await createLoggedInAccount(handle, "snake-hosted-room@example.com");
    const season = snakeSeason();

    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [{
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: season.teams[0]?.ownerId,
          teamId: season.teams[0]?.id,
        }],
      },
    });

    const response = await handle({
      method: "POST",
      path: "/live-rooms",
      sessionToken: cam.sessionToken,
      headers: { "x-mockd-provisioning-token": "test-provisioning-token" },
      body: {
        seasonId: season.id,
        roomId: "room_snake",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog: snakePlayerCatalog,
        now,
      },
    });

    expect(response).toEqual({
      status: 409,
      body: {
        error: {
          code: "snake_live_room_unavailable",
          message: "Hosted live rooms currently support auction drafts. Use Mock Draft for this snake league.",
        },
      },
    });
    expect(liveDraftRoomRepository.rooms()).toEqual([]);
  });

  it("keeps league Market and strategy values separate from auction-pool allocation", async () => {
    const currentCatalog = [
      { name: "Puka Nacua", position: "WR", expectedPrice: 50, seasonProjection: 240 },
      {
        name: "Jahmyr Gibbs",
        position: "RB",
        expectedPrice: 30,
        seasonProjection: 210,
        seasonProjectionAdjustmentFactor: 2 / 3,
        seasonProjectionScoring: defaultScoringSettings,
      },
      {
        name: "De'Von Achane",
        position: "RB",
        expectedPrice: 20,
        seasonProjection: 230,
        seasonProjectionAdjustmentFactor: 1.5,
        seasonProjectionScoring: defaultScoringSettings,
      },
      { name: "George Kittle", position: "TE", expectedPrice: 10 },
      { name: "Jake Elliott", position: "K", expectedPrice: 5 },
    ] as const satisfies readonly LiveDraftRoomPlayerCatalogEntry[];
    let simulationExpectedPrices: Readonly<Record<string, number>> | undefined;
    let simulationHumanValues: Readonly<Record<string, number>> | undefined;
    let simulationTargetConstraints: readonly SeasonSimulationTargetConstraint[] | undefined;
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      currentPlayerCatalogProvider: async () => currentCatalog,
      liveDraftRoomSetupProvider: async () => ({ playerCatalog: currentCatalog, initialRosters: [] }),
      seasonSimulationRunner: async input => {
        simulationExpectedPrices = input.playerExpectedPrices;
        simulationHumanValues = input.playerHumanValues;
        simulationTargetConstraints = input.targetConstraints;
        return {
          draftFormat: "auction",
          runCount: input.runCount,
          completedCount: input.runCount,
          seedPrefix: input.seedPrefix ?? "market-source-test",
          strategy: {
            rawInput: input.strategyInput ?? "",
            preferredPositions: [],
            summary: "Balanced",
            warnings: [],
          },
          playerExposure: [],
          positionCounts: {},
          runs: [],
        };
      },
    });
    const cam = await createLoggedInAccount(handle, "market-source@example.com");
    const baseSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "draft" });
    const teams = baseSeason.teams.slice(0, 4).map((team, index) => ({
      ...team,
      id: `market-team-${index + 1}`,
      leagueSeasonId: "market-season-2026",
      ownerId: `market-owner-${index + 1}`,
    }));
    const season: LeagueSeason = {
      ...baseSeason,
      id: "market-season-2026",
      leagueId: "market-league",
      league: { ...baseSeason.league, id: "market-league", name: "Market League" },
      teams,
      settings: {
        ...baseSeason.settings,
        expectedTeamCount: 4,
        auction: { budgetDollars: 100, minimumBidDollars: 1 },
        roster: {
          rosterSize: 1,
          lineup: { WR: 1 },
          lineupSlotCount: 1,
          rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 1, DST: 1 },
        },
      },
    };
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [{
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: teams[0]?.ownerId,
          teamId: teams[0]?.id,
        }],
      },
    });
    const rebuilt = await handle({
      method: "POST",
      path: `/seasons/${season.id}/pricing/rebuild`,
      sessionToken: cam.sessionToken,
      body: {
        modelVersion: "market-source-test",
        scenarioIds: ["expected"],
        baselinePrices: currentCatalog.map(player => ({
          name: player.name,
          normalizedName: canonicalPlayerIdentityKey(player.name),
          position: player.position,
          price: player.expectedPrice,
        })),
      },
    });
    const pukaSnapshot = (
      expectBodyRecord(rebuilt.body).snapshots as readonly {
        rows: readonly { playerName: string; marketPrice: number; scenarioPrice: number }[];
      }[]
    )[0]?.rows.find(row => row.playerName === "Puka Nacua");

    expect(pukaSnapshot?.scenarioPrice).toBeGreaterThan(pukaSnapshot?.marketPrice ?? Number.NaN);
    await expect(handle({
      method: "GET",
      path: "/player-catalog",
      query: { seasonId: season.id, strategy: "balanced" },
      sessionToken: cam.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        players: expect.arrayContaining([
          expect.objectContaining({ name: "Puka Nacua", marketPrice: 50, myValue: 55 }),
          expect.objectContaining({ name: "Jahmyr Gibbs", marketPrice: 30, myValue: 21 }),
          expect.objectContaining({ name: "De'Von Achane", marketPrice: 20, myValue: 31 }),
        ]),
      },
    });

    const mockResponse = await handle({
      method: "POST",
      path: "/season-mock-drafts",
      sessionToken: cam.sessionToken,
      body: { seasonId: season.id, strategy: "balanced" },
    });
    expect(mockResponse).toMatchObject({ status: 201 });
    const mockSession = expectBodyRecord(expectBodyRecord(mockResponse.body).mockSession);
    const mockSnapshot = expectBodyRecord(mockSession.configurationSnapshot);
    const mockPayload = expectBodyRecord(mockSnapshot.payload);
    const mockExpectedPrices = mockPayload.playerExpectedPrices as Readonly<Record<string, number>>;
    const mockHumanValues = mockPayload.playerHumanValues as Readonly<Record<string, number>>;
    expect(mockExpectedPrices[canonicalPlayerIdentityKey("Puka Nacua")]).toBe(50);
    expect(mockExpectedPrices[canonicalPlayerIdentityKey("Jahmyr Gibbs")]).toBe(30);
    expect(mockExpectedPrices[canonicalPlayerIdentityKey("De'Von Achane")]).toBe(20);
    expect(mockHumanValues[canonicalPlayerIdentityKey("Jahmyr Gibbs")]).toBe(21);
    expect(mockHumanValues[canonicalPlayerIdentityKey("De'Von Achane")]).toBe(31);

    await expect(handle({
      method: "PUT",
      path: "/practice-shortlist",
      sessionToken: cam.sessionToken,
      body: { seasonId: season.id, playerName: "Puka Nacua", maxBid: 57 },
    })).resolves.toMatchObject({
      status: 200,
      body: { item: { playerName: "Puka Nacua", maxBid: 57 } },
    });

    await expect(handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: cam.sessionToken,
      body: { seasonId: season.id, count: 1 },
    })).resolves.toMatchObject({ status: 200 });
    expect(simulationExpectedPrices?.[canonicalPlayerIdentityKey("Puka Nacua")]).toBe(50);
    expect(simulationHumanValues?.[canonicalPlayerIdentityKey("Jahmyr Gibbs")]).toBe(21);
    expect(simulationHumanValues?.[canonicalPlayerIdentityKey("De'Von Achane")]).toBe(31);
    expect(simulationTargetConstraints).toEqual([{
      playerName: "Puka Nacua",
      maxAuctionPrice: 57,
    }]);

    const fullPprSeason: LeagueSeason = {
      ...season,
      settings: {
        ...season.settings,
        scoring: { ...season.settings.scoring, reception: 1 },
      },
    };
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season: fullPprSeason,
        memberships: [{
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: teams[0]?.ownerId,
          teamId: teams[0]?.id,
        }],
      },
    });
    await expect(handle({
      method: "GET",
      path: "/player-catalog",
      query: { seasonId: season.id, strategy: "balanced" },
      sessionToken: cam.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        players: expect.arrayContaining([
          expect.objectContaining({ name: "Jahmyr Gibbs", marketPrice: 30, myValue: 31 }),
          expect.objectContaining({ name: "De'Von Achane", marketPrice: 20, myValue: 21 }),
        ]),
      },
    });
  });

  it("reviews ESPN league settings for a signed-in commissioner before creating anything", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const outcome = {
      kind: "manual-review-required",
      provider: "espn",
      confirmationRequired: true,
      reason: "private_or_unauthorized",
      externalLeagueId: "214674",
      season: 2026,
      confirmationMethods: ["screenshot", "manual"],
      message: "This ESPN league is private. Confirm its settings from screenshots or enter them manually.",
    } as const;
    const espnLeagueSettingsImporter = vi.fn(async () => outcome);
    const handle = createPlatformHttpHandler(app, {
      espnLeagueSettingsImporter,
      leagueImportRateLimiter: createClientAddressRateLimiter({
        maxAttempts: 1,
        windowMs: 60_000,
        maxTrackedEmails: 10,
      }),
    });
    const login = await createLoggedInAccount(handle, "espn-review@example.com");

    await expect(handle({
      method: "POST",
      path: "/league-imports/espn/review",
      body: { leagueIdOrUrl: "214674", season: 2026 },
    })).resolves.toMatchObject({ status: 401, body: { error: { code: "auth_required" } } });

    await expect(handle({
      method: "POST",
      path: "/league-imports/espn/review",
      sessionToken: login.sessionToken,
      body: { leagueIdOrUrl: "214674", season: 2026 },
    })).resolves.toEqual({ status: 200, body: outcome });
    await expect(handle({
      method: "POST",
      path: "/league-imports/espn/review",
      sessionToken: login.sessionToken,
      body: { leagueIdOrUrl: "214674", season: 2026 },
    })).resolves.toMatchObject({
      status: 429,
      body: { error: { code: "rate_limited" } },
      headers: { "Retry-After": "60" },
    });
    expect(espnLeagueSettingsImporter).toHaveBeenCalledWith({ leagueIdOrUrl: "214674", season: 2026 });
    expect(espnLeagueSettingsImporter).toHaveBeenCalledTimes(1);
  });

  it("extracts team and manager identities before a private ESPN league is created", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const leagueMembersScreenshotAnalyzer = {
      analyze: vi.fn(async () => ({
        leagueName: "The Sunday Games",
        externalLeagueId: "214674",
        teams: [{
          draftOrderPosition: 1,
          abbreviation: "Mack",
          teamDisplayName: "Short King",
          managerDisplayNames: ["Cam Farina"],
          confidence: "high" as const,
          issues: [],
          confirmed: false,
        }],
      })),
    };
    const handle = createPlatformHttpHandler(app, { leagueMembersScreenshotAnalyzer });
    const login = await createLoggedInAccount(handle, "private-espn@example.com");

    const response = await handle({
      method: "POST",
      path: "/league-imports/espn/members-screenshot-review",
      sessionToken: login.sessionToken,
      body: { mimeType: "image/png", base64: "encoded-image" },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        import: {
          leagueName: "The Sunday Games",
          externalLeagueId: "214674",
          teams: [expect.objectContaining({
            teamDisplayName: "Short King",
            managerDisplayNames: ["Cam Farina"],
          })],
        },
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/email|status|invite/i);
  });

  it("reports whether pre-creation screenshot analysis is available", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const unavailableHandle = createPlatformHttpHandler(app);
    const unavailableLogin = await createLoggedInAccount(unavailableHandle, "screenshot-unavailable@example.com");

    await expect(unavailableHandle({
      method: "GET",
      path: "/league-imports/espn/members-screenshot-review",
    })).resolves.toMatchObject({ status: 401 });
    await expect(unavailableHandle({
      method: "GET",
      path: "/league-imports/espn/members-screenshot-review",
      sessionToken: unavailableLogin.sessionToken,
    })).resolves.toEqual({ status: 200, body: { available: false } });

    const availableHandle = createPlatformHttpHandler(app, {
      leagueMembersScreenshotAnalyzer: { analyze: vi.fn() },
    });
    await expect(availableHandle({
      method: "GET",
      path: "/league-imports/espn/members-screenshot-review",
      sessionToken: unavailableLogin.sessionToken,
    })).resolves.toEqual({ status: 200, body: { available: true } });
  });

  it("creates a confirmed league for the signed-in commissioner with generated ids", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const login = await createLoggedInAccount(handle, "league-creator@example.com");
    const setup = {
      provider: "espn",
      externalLeagueId: "214674",
      leagueName: "The Sunday Games",
      seasonYear: 2026,
      expectedTeamCount: 4,
      teams: [
        { externalTeamId: "1", displayName: "Short King", managerNames: ["Cam"] },
        { externalTeamId: "2", displayName: "Dart Vader", managerNames: ["Beaton"] },
        { externalTeamId: "3", displayName: "Old Dogs", managerNames: ["Jacob"] },
        { externalTeamId: "4", displayName: "Peace Bridge", managerNames: ["Nick"] },
      ],
      draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
      scoring: { ...defaultScoringSettings },
      rosterSlots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1, BENCH: 7 },
    };

    await expect(handle({ method: "POST", path: "/leagues", body: { setup } }))
      .resolves.toMatchObject({ status: 401 });
    const response = await handle({
      method: "POST",
      path: "/leagues",
      sessionToken: login.sessionToken,
      body: { setup },
    });

    expect(response).toMatchObject({
      status: 201,
      body: {
        season: {
          id: expect.stringMatching(/^season-/),
          leagueId: expect.stringMatching(/^league-/),
          setupStatus: "draft",
          settings: { draftFormat: "auction" },
        },
      },
    });
    const season = expectBodyRecord(response.body).season as { leagueId: string };
    expect(await app.listLeagueMemberships(season.leagueId)).toEqual([
      expect.objectContaining({ userId: login.account.id, leagueId: season.leagueId, role: "owner" }),
    ]);
    const createdSeason = expectBodyRecord(response.body).season as { id: string };
    await expect(handle({
      method: "POST",
      path: `/seasons/${createdSeason.id}/publish`,
      sessionToken: login.sessionToken,
      body: {},
    })).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "season_review_confirmation_required" } },
    });
    await expect(handle({
      method: "POST",
      path: `/seasons/${createdSeason.id}/publish`,
      sessionToken: login.sessionToken,
      body: { confirmed: true },
    })).resolves.toMatchObject({
      status: 200,
      body: { season: { id: createdSeason.id, setupStatus: "published" } },
    });

    const member = await createLoggedInAccount(handle, "league-member@example.com");
    const registeredSeason = expectBodyRecord(response.body).season as LeagueSeason;
    await app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season: registeredSeason,
      memberships: [
        { userId: login.account.id, leagueId: registeredSeason.leagueId, role: "owner" },
        { userId: member.account.id, leagueId: registeredSeason.leagueId, role: "member" },
      ],
      now,
    });
    await expect(handle({
      method: "POST",
      path: `/leagues/${registeredSeason.leagueId}/archive`,
      sessionToken: member.sessionToken,
    })).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "shared_mutation_denied" } },
    });
    await expect(handle({
      method: "POST",
      path: `/leagues/${registeredSeason.leagueId}/archive`,
    })).resolves.toMatchObject({ status: 401 });
    await expect(handle({
      method: "POST",
      path: `/leagues/${registeredSeason.leagueId}/archive`,
      sessionToken: login.sessionToken,
      now: new Date(now.getTime() + 1),
    })).resolves.toEqual({
      status: 200,
      body: { archived: true, leagueId: registeredSeason.leagueId },
    });
    await expect(handle({
      method: "GET",
      path: `/seasons/${registeredSeason.id}`,
      sessionToken: login.sessionToken,
    })).resolves.toMatchObject({ status: 200, body: { season: { id: registeredSeason.id } } });
  });

  it("returns a retryable response when the account league-creation window is full", async () => {
    const store = new InMemoryPlatformStore(undefined, {
      leagueCreationLimits: {
        maxActiveLeaguesPerAccount: 10,
        maxCreatedLeaguesPerWindow: 1,
        creationWindowMs: 60 * 60 * 1_000,
      },
    });
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const login = await createLoggedInAccount(handle, "limited-league-creator@example.com");
    const setup = {
      provider: "espn",
      externalLeagueId: "214674",
      leagueName: "The Sunday Games",
      seasonYear: 2026,
      expectedTeamCount: 4,
      teams: [
        { externalTeamId: "1", displayName: "Short King", managerNames: ["Cam"] },
        { externalTeamId: "2", displayName: "Dart Vader", managerNames: ["Beaton"] },
        { externalTeamId: "3", displayName: "Old Dogs", managerNames: ["Jacob"] },
        { externalTeamId: "4", displayName: "Peace Bridge", managerNames: ["Nick"] },
      ],
      draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
      scoring: { ...defaultScoringSettings },
      rosterSlots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1, BENCH: 7 },
    };

    await expect(handle({
      method: "POST",
      path: "/leagues",
      sessionToken: login.sessionToken,
      now,
      body: { setup },
    })).resolves.toMatchObject({ status: 201 });
    await expect(handle({
      method: "POST",
      path: "/leagues",
      sessionToken: login.sessionToken,
      now: new Date(now.getTime() + 30_000),
      body: { setup: { ...setup, externalLeagueId: "214675" } },
    })).resolves.toEqual({
      status: 429,
      headers: { "Retry-After": "3570" },
      body: {
        error: {
          code: "league_creation_rate_limited",
          message: "Too many leagues were created recently. Try again later.",
        },
      },
    });
  });

  it("previews, persists, lists, and removes commissioner keeper commands", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const liveDraftRoomSetupRepository = new InMemoryLiveDraftRoomSetupRepository();
    const handle = createPlatformHttpHandler(app, {
      currentPlayerCatalogProvider: async () => playerCatalog,
      liveDraftRoomSetupRepository,
      liveDraftRoomSetupProvider: async () => ({ playerCatalog, initialRosters: [] }),
    });
    const cam = await createLoggedInAccount(handle, "keeper-commissioner@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "draft" });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [{
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        }],
      },
    });

    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/keepers/preview`,
      sessionToken: cam.sessionToken,
      body: { command: "cam keeping achane 50" },
    })).resolves.toMatchObject({
      status: 200,
      body: {
        kind: "preview",
        team: { id: camTeam.id },
        player: { name: "De'Von Achane", position: "RB" },
        keeper: { auctionCostDollars: 50 },
      },
    });

    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/keepers/apply`,
      sessionToken: cam.sessionToken,
      body: { command: "cam keeping achane 50", confirmed: false },
    })).resolves.toMatchObject({ status: 400, body: { error: { code: "keeper_confirmation_required" } } });

    const applied = await handle({
      method: "POST",
      path: `/seasons/${season.id}/keepers/apply`,
      sessionToken: cam.sessionToken,
      body: { command: "cam keeping achane 50", confirmed: true },
    });
    expect(applied).toMatchObject({
      status: 200,
      body: {
        keepers: [{ teamId: camTeam.id, playerId: "devon achane", price: 50 }],
        pricing: { snapshots: [{ rows: expect.any(Array) }] },
      },
    });
    await expect(handle({
      method: "GET",
      path: "/player-catalog",
      query: { seasonId: season.id },
      sessionToken: cam.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        draftFormat: "auction",
        personalized: true,
        strategyKey: "balanced",
        players: expect.arrayContaining([
          expect.objectContaining({ marketPrice: 73, myValue: 78, leagueValue: 78 }),
          expect.objectContaining({
            name: "De'Von Achane",
            isKeeper: true,
            keeperTeamId: camTeam.id,
            keeperPrice: 50,
          }),
        ]),
      },
    });
    await expect(liveDraftRoomSetupRepository.findForSeason(season.id)).resolves.toMatchObject({
      initialRosters: [{ teamId: camTeam.id, playerName: "De'Von Achane", price: 50 }],
    });

    await expect(handle({
      method: "GET",
      path: `/seasons/${season.id}/keepers`,
      sessionToken: cam.sessionToken,
    })).resolves.toMatchObject({ status: 200, body: { keepers: [{ playerName: "De'Von Achane" }] } });

    await expect(handle({
      method: "DELETE",
      path: `/seasons/${season.id}/keepers`,
      sessionToken: cam.sessionToken,
      body: { teamId: camTeam.id, playerId: "devon achane" },
    })).resolves.toMatchObject({ status: 200, body: { keepers: [] } });

    await handle({
      method: "POST",
      path: `/seasons/${season.id}/keepers/apply`,
      sessionToken: cam.sessionToken,
      body: { command: "cam keeping achane 50", confirmed: true },
    });
    await handle({
      method: "POST",
      path: `/seasons/${season.id}/publish`,
      sessionToken: cam.sessionToken,
      body: { confirmed: true },
    });
    const createdRoomResponse = await handle({
      method: "POST",
      path: `/seasons/${season.id}/live-room`,
      sessionToken: cam.sessionToken,
      body: {},
    });
    expect(createdRoomResponse).toMatchObject({
      status: 201,
      body: {
        room: {
          board: expect.arrayContaining([
            expect.objectContaining({ name: "Puka Nacua", marketPrice: 73, expectedPrice: 73 }),
          ]),
          teamSummaries: expect.arrayContaining([
            expect.objectContaining({
              teamId: camTeam.id,
              spent: 50,
              budgetRemaining: 150,
              rosterSlotsRemaining: 15,
              roster: [expect.objectContaining({ name: "De'Von Achane", source: "keeper", price: 50 })],
            }),
          ]),
        },
      },
    });
    expectPublicBrowserPayload(createdRoomResponse.body);

    const synchronizeInitialRosters = vi.spyOn(app, "synchronizeLiveDraftRoomInitialRosters")
      .mockRejectedValueOnce(new Error("The draft started while the keeper was being saved."));
    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/keepers/apply`,
      sessionToken: cam.sessionToken,
      body: { command: "cam keeping achane 49", confirmed: true },
    })).resolves.toMatchObject({ status: 500 });
    await expect(liveDraftRoomSetupRepository.findForSeason(season.id)).resolves.toMatchObject({
      initialRosters: [{ teamId: camTeam.id, playerName: "De'Von Achane", price: 50 }],
    });
    synchronizeInitialRosters.mockRestore();

    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/keepers/apply`,
      sessionToken: cam.sessionToken,
      body: { command: "cam keeping achane 48", confirmed: true },
    })).resolves.toMatchObject({
      status: 200,
      body: { keepers: [{ teamId: camTeam.id, playerName: "De'Von Achane", price: 48 }] },
    });
    const roomId = `room-${season.id}-real`;
    await expect(app.getLiveDraftRoomState({
      actorSessionToken: cam.sessionToken,
      roomId,
    })).resolves.toMatchObject({
      selectedTeam: {
        teamId: camTeam.id,
        spent: 48,
        budgetRemaining: 152,
        rosterSlotsRemaining: 15,
        roster: [expect.objectContaining({ name: "De'Von Achane", source: "keeper", price: 48 })],
      },
    });
    const roomAfterKeeperUpdate = await app.getLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      roomId,
    });
    const latestPricing = (await app.listLeaguePricingSnapshots({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      scenarioId: "expected",
    })).at(-1);
    const pukaPrice = latestPricing?.rows.find(row => row.playerName === "Puka Nacua");
    const pukaRoomPlayer = roomAfterKeeperUpdate.playerCatalog.find(player => player.name === "Puka Nacua");
    expect(pukaRoomPlayer?.expectedPrice).toBe(Math.round(pukaPrice?.scenarioPrice ?? Number.NaN));
    expect(pukaRoomPlayer?.marketPrice).toBe(73);

    const pukaRoomPriceBeforeFailure = roomAfterKeeperUpdate.playerCatalog
      .find(player => player.name === "Puka Nacua")?.expectedPrice;
    const rebuildPricing = vi.spyOn(app, "rebuildLeaguePricing")
      .mockRejectedValueOnce(new Error("Pricing persistence failed."));
    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/keepers/apply`,
      sessionToken: cam.sessionToken,
      body: { command: "cam keeping achane 47", confirmed: true },
    })).resolves.toMatchObject({ status: 500 });
    rebuildPricing.mockRestore();
    await expect(liveDraftRoomSetupRepository.findForSeason(season.id)).resolves.toMatchObject({
      initialRosters: [{ playerName: "De'Von Achane", price: 48 }],
    });
    await expect(app.getLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      roomId,
    })).resolves.toMatchObject({
      initialRosters: [{ playerName: "De'Von Achane", price: 48 }],
      playerCatalog: expect.arrayContaining([
        expect.objectContaining({ name: "Puka Nacua", expectedPrice: pukaRoomPriceBeforeFailure }),
      ]),
    });

    await expect(handle({
      method: "DELETE",
      path: `/seasons/${season.id}/keepers`,
      sessionToken: cam.sessionToken,
      body: { teamId: camTeam.id, playerId: "devon achane" },
      now: new Date(now.getTime() + 1_000),
    })).resolves.toMatchObject({ status: 200, body: { keepers: [] } });
    await expect(app.getLiveDraftRoomState({
      actorSessionToken: cam.sessionToken,
      roomId,
    })).resolves.toMatchObject({
      selectedTeam: {
        teamId: camTeam.id,
        spent: 0,
        budgetRemaining: 200,
        rosterSlotsRemaining: 16,
        roster: [],
      },
    });
    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/keepers/apply`,
      sessionToken: cam.sessionToken,
      body: { command: "cam keeping achane 48", confirmed: true },
      now: new Date(now.getTime() + 2_000),
    })).resolves.toMatchObject({ status: 200 });

    const synchronizedRoom = await app.getLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      roomId,
    });
    await app.startLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      roomId,
      expectedRevision: synchronizedRoom.revision,
      idempotencyKey: "start:keeper-lock",
    });
    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/keepers/apply`,
      sessionToken: cam.sessionToken,
      body: { command: "cam keeping achane 47", confirmed: true },
    })).resolves.toMatchObject({
      status: 409,
      body: {
        error: {
          code: "keeper_setup_locked",
          message: "Keepers are locked after the live draft starts.",
        },
      },
    });
    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/upload-preview`,
      sessionToken: cam.sessionToken,
      body: {
        fileName: "2025-results.csv",
        mimeType: "text/csv",
        base64: Buffer.from("owner,player,position,price\nCam,Puka Nacua,WR,$60").toString("base64"),
        seasonYear: 2025,
      },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "historical_import_locked" } },
    });
  });

  it("does not save a keeper when the resulting pricing snapshot would conflict", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const liveDraftRoomSetupRepository = new InMemoryLiveDraftRoomSetupRepository();
    const handle = createPlatformHttpHandler(app, {
      liveDraftRoomSetupRepository,
      liveDraftRoomSetupProvider: async () => ({ playerCatalog, initialRosters: [] }),
    });
    const cam = await createLoggedInAccount(handle, "keeper-conflict@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "draft" });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [{
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        }],
      },
    });
    const prepared = await app.preflightLeaguePricing({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      modelVersion: "league-history-keepers-v2",
      scenarioIds: ["expected"],
      baselinePrices: playerCatalog
        .filter(player => player.name !== "De'Von Achane")
        .map(player => ({
          name: player.name,
          normalizedName: canonicalPlayerIdentityKey(player.name),
          position: player.position,
          price: player.expectedPrice,
        })),
      currentKeeperCount: 1,
      keeperLockedSpend: 50,
      now,
    });
    const snapshot = prepared.snapshots[0];
    if (snapshot === undefined) throw new Error("Expected prepared pricing snapshot.");
    store.pricingSnapshots.save({
      ...snapshot,
      rows: snapshot.rows.map((row, index) => index === 0 ? { ...row, livePrice: row.livePrice + 1 } : row),
    });

    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/keepers/apply`,
      sessionToken: cam.sessionToken,
      body: { command: "cam keeping achane 50", confirmed: true },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "pricing_snapshot_conflict" } },
    });
    await expect(liveDraftRoomSetupRepository.findForSeason(season.id)).resolves.toBeNull();
  });

  it("does not commit historical records when the resulting pricing snapshot would conflict", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      liveDraftRoomSetupProvider: async () => ({ playerCatalog, initialRosters: [] }),
    });
    const cam = await createLoggedInAccount(handle, "history-conflict@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "draft" });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [{
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        }],
      },
    });
    const preview = await handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/preview`,
      sessionToken: cam.sessionToken,
      body: {
        sourceText: "owner,player,position,price,year\nCam,Puka Nacua,WR,70,2025",
        seasonYear: 2025,
      },
    });
    const batchId = expectString(expectBodyRecord(expectBodyRecord(preview.body).batch).id);
    const proposed = await app.prepareHistoricalImportCommit({
      actorSessionToken: cam.sessionToken,
      batchId,
      expectedLeagueId: season.leagueId,
      expectedLeagueSeasonId: season.id,
      expectedSeasonYear: 2025,
      pricingSeasonYear: season.seasonYear,
      now,
    });
    const prepared = await app.preflightLeaguePricing({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      modelVersion: "league-history-v2",
      scenarioIds: ["expected"],
      baselinePrices: playerCatalog.map(player => ({
        name: player.name,
        normalizedName: canonicalPlayerIdentityKey(player.name),
        position: player.position,
        price: player.expectedPrice,
      })),
      historicalSaleRecords: proposed.projectedHistoricalSaleRecords,
      currentKeeperCount: 0,
      keeperLockedSpend: 0,
      now,
    });
    const snapshot = prepared.snapshots[0];
    if (snapshot === undefined) throw new Error("Expected prepared pricing snapshot.");
    store.pricingSnapshots.save({
      ...snapshot,
      rows: snapshot.rows.map((row, index) => index === 0 ? { ...row, livePrice: row.livePrice + 1 } : row),
    });

    await expect(handle({
      method: "POST",
      path: `/historical-imports/${batchId}/commit`,
      sessionToken: cam.sessionToken,
      body: { seasonId: season.id, seasonYear: 2025 },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "pricing_snapshot_conflict" } },
    });
    expect(store.historicalImports.findBatchById(batchId)).toMatchObject({ status: "previewed" });
    expect(store.historicalImports.currentRecords(season.leagueId, 2025)).toEqual([]);
  });

  it("authorizes commissioner spreadsheet imports before parsing the upload", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const owner = await createLoggedInAccount(handle, "history-owner@example.com");
    const member = await createLoggedInAccount(handle, "history-member@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "draft" });
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: owner.sessionToken,
      body: {
        season,
        memberships: [
          { userId: owner.account.id, leagueId: season.leagueId, role: "owner" },
          { userId: member.account.id, leagueId: season.leagueId, role: "member" },
        ],
      },
    });
    const upload = {
      fileName: "draft.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: Buffer.from("not an xlsx archive").toString("base64"),
      seasonYear: 2025,
    };

    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/upload-preview`,
      sessionToken: member.sessionToken,
      body: upload,
    })).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "shared_mutation_denied" } },
    });
    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/upload-preview`,
      sessionToken: owner.sessionToken,
      body: upload,
    })).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "invalid_historical_upload" } },
    });
  });

  it("returns a clear document limit error without saving a historical preview", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const owner = await createLoggedInAccount(handle, "history-size-limit@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "draft" });
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: owner.sessionToken,
      body: {
        season,
        memberships: [{ userId: owner.account.id, leagueId: season.leagueId, role: "owner" }],
      },
    });
    const rows = Array.from(
      { length: 2_500 },
      (_, index) => `Cam,Player ${index + 1},RB,1,2025`,
    );

    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/preview`,
      sessionToken: owner.sessionToken,
      body: {
        sourceText: ["owner,player,position,price,year", ...rows].join("\n"),
        seasonYear: 2025,
      },
    })).resolves.toMatchObject({
      status: 422,
      body: {
        error: {
          code: "historical_import_document_too_large",
          message: "Historical draft files may contain at most 2500 rows.",
        },
      },
    });
    expect(store.historicalImports.batches()).toEqual([]);
  });

  it("creates and replays a league-aware snake mock for the claimed team", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    let currentSnakeCatalog: readonly LiveDraftRoomPlayerCatalogEntry[] = snakePlayerCatalog;
    const handle = createPlatformHttpHandler(app, {
      liveDraftRoomSetupProvider: async () => ({ playerCatalog: currentSnakeCatalog, initialRosters: [] }),
    });
    const cam = await createLoggedInAccount(handle, "snake-mock@example.com");
    const season = snakeSeason();
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [{
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: season.teams[0]?.ownerId,
          teamId: season.teams[0]?.id,
        }],
      },
    });

    const created = await handle({
      method: "POST",
      path: "/season-mock-drafts",
      sessionToken: cam.sessionToken,
      body: { seasonId: season.id },
    });
    expect(created).toMatchObject({
      status: 201,
      body: {
        mockSession: {
          seasonId: season.id,
          teamId: "snake-team-1",
          draftMode: {
            format: "snake",
          },
          configurationSnapshot: {
            status: "ready",
            schema: "mockd-season-mock",
            version: 2,
          },
        },
        state: { session: { status: "setup", revision: 0 } },
      },
    });
    const mockSession = expectBodyRecord(created.body).mockSession as { id: string };

    const started = await handle({
      method: "POST",
      path: `/season-mock-drafts/${mockSession.id}/commands`,
      sessionToken: cam.sessionToken,
      body: {
        seasonId: season.id,
        commandId: "start-1",
        command: { type: "start", expectedRevision: 0 },
      },
    });
    expect(started).toMatchObject({
      status: 200,
      body: { state: { session: { status: "active", revision: 1, currentPick: { teamId: "snake-team-1" } } } },
    });

    const picked = await handle({
      method: "POST",
      path: `/season-mock-drafts/${mockSession.id}/commands`,
      sessionToken: cam.sessionToken,
      body: {
        seasonId: season.id,
        commandId: "pick-1",
        command: { type: "pick", expectedRevision: 1, playerId: "player 1" },
      },
    });
    expect(picked).toMatchObject({
      status: 200,
      body: {
        state: {
          session: { revision: 2, currentPick: { overall: 8, teamId: "snake-team-1" } },
          board: {
            picks: expect.arrayContaining([
              expect.objectContaining({ selection: expect.objectContaining({ source: "ai" }) }),
            ]),
          },
        },
      },
    });

    await expect(handle({
      method: "POST",
      path: `/season-mock-drafts/${mockSession.id}/commands`,
      sessionToken: cam.sessionToken,
      body: {
        seasonId: season.id,
        commandId: "pick-1",
        command: { type: "pick", expectedRevision: 1, playerId: "player 1" },
      },
    })).resolves.toMatchObject({
      status: 200,
      body: {
        mockSession: { commandLog: [{}, {}] },
        state: { session: { revision: 2 } },
      },
    });

    await expect(handle({
      method: "POST",
      path: `/season-mock-drafts/${mockSession.id}/commands`,
      sessionToken: cam.sessionToken,
      body: {
        seasonId: season.id,
        commandId: "stale-pick",
        command: { type: "pick", expectedRevision: 1, playerId: "player 8" },
      },
    })).resolves.toMatchObject({ status: 409, body: { error: { code: "stale_revision" } } });

    currentSnakeCatalog = [{ name: "Replacement Player", position: "RB", expectedPrice: 1 }];
    await expect(handle({
      method: "GET",
      path: `/season-mock-drafts/${mockSession.id}`,
      query: { seasonId: season.id },
      sessionToken: cam.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        state: {
          session: { revision: 2, commandLog: expect.any(Array) },
          board: { players: expect.arrayContaining([expect.objectContaining({ name: "Player 1" })]) },
        },
      },
    });

    await expect(handle({
      method: "POST",
      path: `/season-mock-drafts/${mockSession.id}/commands`,
      sessionToken: cam.sessionToken,
      body: {
        seasonId: season.id,
        commandId: "pick-2",
        command: { type: "pick", expectedRevision: 2, playerId: "player 8" },
      },
    })).resolves.toMatchObject({ body: { state: { session: { canComplete: true, revision: 3 } } } });
    await expect(handle({
      method: "POST",
      path: `/season-mock-drafts/${mockSession.id}/commands`,
      sessionToken: cam.sessionToken,
      body: {
        seasonId: season.id,
        commandId: "complete-1",
        command: { type: "complete", expectedRevision: 3 },
      },
    })).resolves.toMatchObject({
      status: 200,
      body: {
        mockSession: { status: "completed" },
        state: { session: { status: "completed", revision: 4 } },
        results: {
          teams: expect.arrayContaining([
            expect.objectContaining({
              teamId: "snake-team-1",
              isUserTeam: true,
              rank: expect.any(Number),
              roster: expect.arrayContaining([
                expect.objectContaining({ playerName: "Player 1", week1Points: 0 }),
              ]),
            }),
          ]),
          rosteredPlayerCount: 8,
        },
      },
    });

    const legacySession = await app.createMockDraftSession({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: season.teams[0]?.ownerId ?? "",
      teamId: season.teams[0]?.id ?? "",
      draftMode: { format: "snake", mockCount: 1, label: "Legacy mock" },
      status: "setup",
    });
    await expect(handle({
      method: "GET",
      path: `/season-mock-drafts/${legacySession.id}`,
      query: { seasonId: season.id },
      sessionToken: cam.sessionToken,
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "snapshot_migration_required" } },
    });
  });

  it("returns a typed retry response when interactive mock creation is rate limited", async () => {
    const store = new InMemoryPlatformStore(undefined, {
      mockDraftSessionResourcePolicy: {
        maxActiveSessionsPerUser: 100,
        maxActiveSessionsPerUserSeason: 100,
        maxCreationsPerWindow: 2,
        creationWindowMs: 60_000,
      },
    });
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const setupProvider = vi.fn(async () => ({ playerCatalog: snakePlayerCatalog, initialRosters: [] }));
    const handle = createPlatformHttpHandler(app, { liveDraftRoomSetupProvider: setupProvider });
    const cam = await createLoggedInAccount(handle, "mock-rate-limit@example.com");
    const season = snakeSeason();
    const team = season.teams[0];
    if (team === undefined) throw new Error("Expected a team fixture.");
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [{
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: team.ownerId,
          teamId: team.id,
        }],
      },
    });
    const createMock = (createdAt: Date) => handle({
      method: "POST",
      path: "/season-mock-drafts",
      sessionToken: cam.sessionToken,
      now: createdAt,
      body: {
        seasonId: season.id,
        strategy: "balanced",
      },
    });

    await expect(createMock(now)).resolves.toMatchObject({ status: 201 });
    await expect(createMock(new Date(now.getTime() + 1_000))).resolves.toMatchObject({ status: 201 });
    await expect(createMock(new Date(now.getTime() + 2_000))).resolves.toEqual({
      status: 429,
      headers: { "Retry-After": "58" },
      body: {
        error: {
          code: "session_creation_rate_limited",
          message: "Too many mock drafts were started recently. Try again later.",
        },
      },
    });
    expect(setupProvider).toHaveBeenCalledTimes(2);
  });

  it("returns the typed active-session quota response when reset would reactivate past the limit", async () => {
    const store = new InMemoryPlatformStore(undefined, {
      mockDraftSessionResourcePolicy: {
        maxActiveSessionsPerUser: 2,
        maxActiveSessionsPerUserSeason: 1,
        maxCreationsPerWindow: 100,
      },
    });
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const cam = await createLoggedInAccount(handle, "mock-reset-limit@example.com");
    const season = snakeSeason();
    const team = season.teams[0];
    if (team === undefined) throw new Error("Expected a team fixture.");
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [{
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: team.ownerId,
          teamId: team.id,
        }],
      },
    });
    const createMock = (createdAt: Date) => handle({
      method: "POST",
      path: "/mock-sessions",
      sessionToken: cam.sessionToken,
      now: createdAt,
      body: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: team.ownerId,
        teamId: team.id,
        draftMode: { format: "snake", mockCount: 1 },
      },
    });
    const completedResponse = await createMock(now);
    const completedSession = expectBodyRecord(expectBodyRecord(completedResponse.body).mockSession);
    const completedSessionId = expectString(completedSession.id);
    store.mockDraftSessions.markCompleted({
      userId: cam.account.id,
      sessionId: completedSessionId,
      expectedRevision: 1,
      now: new Date(now.getTime() + 1_000),
    });
    await expect(createMock(new Date(now.getTime() + 2_000))).resolves.toMatchObject({ status: 201 });

    await expect(handle({
      method: "POST",
      path: `/mock-sessions/${completedSessionId}/reset`,
      sessionToken: cam.sessionToken,
      now: new Date(now.getTime() + 3_000),
      body: { expectedRevision: 1 },
    })).resolves.toEqual({
      status: 409,
      body: {
        error: {
          code: "season_active_session_limit",
          message: "Finish or abandon an active mock draft for this season before starting another.",
        },
      },
    });
  });

  it("returns typed command-log limit responses without breaking stored-command retries", async () => {
    const store = new InMemoryPlatformStore(undefined, {
      mockDraftSessionResourcePolicy: {
        maxCommandsPerSession: 2,
        maxCommandBytesPerSession: 24,
        maxActiveSessionsPerUser: 100,
        maxActiveSessionsPerUserSeason: 100,
        maxCreationsPerWindow: 100,
      },
    });
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const cam = await createLoggedInAccount(handle, "mock-command-limits@example.com");
    const season = snakeSeason();
    const team = season.teams[0];
    if (team === undefined) throw new Error("Expected a team fixture.");
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [{
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: team.ownerId,
          teamId: team.id,
        }],
      },
    });
    const createMockSession = async (): Promise<string> => {
      const created = await handle({
        method: "POST",
        path: "/mock-sessions",
        sessionToken: cam.sessionToken,
        body: {
          leagueId: season.leagueId,
          seasonId: season.id,
          ownerId: team.ownerId,
          teamId: team.id,
          draftMode: { format: "snake", mockCount: 1 },
        },
      });
      return expectString(expectBodyRecord(expectBodyRecord(created.body).mockSession).id);
    };
    const bytesSessionId = await createMockSession();
    const utf8CommandRequest = {
      method: "POST",
      path: `/mock-sessions/${bytesSessionId}/commands`,
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 1,
        expectedCommandCount: 0,
        commandId: "cmd_utf8",
        idempotencyKey: "command:utf8",
        command: "éé",
      },
    } as const;

    await expect(handle(utf8CommandRequest)).resolves.toMatchObject({ status: 200 });
    await expect(handle(utf8CommandRequest)).resolves.toMatchObject({ status: 200 });
    await expect(handle({
      method: "POST",
      path: `/mock-sessions/${bytesSessionId}/commands`,
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 1,
        expectedCommandCount: 1,
        commandId: "cmd_over_bytes",
        command: "x",
      },
    })).resolves.toEqual({
      status: 413,
      body: {
        error: {
          code: "session_command_bytes_limit",
          message: "This mock draft reached its command storage limit. Finish or reset it before continuing.",
        },
      },
    });

    const countSessionId = await createMockSession();
    for (const [index, command] of ["a", "b"].entries()) {
      await expect(handle({
        method: "POST",
        path: `/mock-sessions/${countSessionId}/commands`,
        sessionToken: cam.sessionToken,
        body: {
          expectedRevision: 1,
          expectedCommandCount: index,
          commandId: `cmd_${command}`,
          command,
        },
      })).resolves.toMatchObject({ status: 200 });
    }
    await expect(handle({
      method: "POST",
      path: `/mock-sessions/${countSessionId}/commands`,
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 1,
        expectedCommandCount: 2,
        commandId: "cmd_over_count",
        command: "c",
      },
    })).resolves.toEqual({
      status: 409,
      body: {
        error: {
          code: "session_command_count_limit",
          message: "This mock draft reached its command limit. Finish or reset it before continuing.",
        },
      },
    });

    await expect(handle({
      method: "GET",
      path: "/mock-sessions",
      sessionToken: cam.sessionToken,
      query: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: team.ownerId,
      },
    })).resolves.toMatchObject({
      status: 200,
      body: {
        mockSessions: expect.arrayContaining([
          expect.objectContaining({
            id: bytesSessionId,
            commandLog: [expect.objectContaining({ id: "cmd_utf8" })],
          }),
          expect.objectContaining({
            id: countSessionId,
            commandLog: [
              expect.objectContaining({ id: "cmd_a" }),
              expect.objectContaining({ id: "cmd_b" }),
            ],
          }),
        ]),
      },
    });
  });


  it("lets an owner abandon their season mock and durably releases its active quota", async () => {
    const resourcePolicy = {
      maxActiveSessionsPerUser: 1,
      maxActiveSessionsPerUserSeason: 1,
      maxCreationsPerWindow: 100,
    };
    const store = new InMemoryPlatformStore(undefined, {
      mockDraftSessionResourcePolicy: resourcePolicy,
    });
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    let setupAvailable = true;
    const setupProvider = vi.fn(async () => {
      if (!setupAvailable) throw new Error("Draft setup is temporarily unavailable.");
      return { playerCatalog: snakePlayerCatalog, initialRosters: [] };
    });
    const handle = createPlatformHttpHandler(app, { liveDraftRoomSetupProvider: setupProvider });
    const cam = await createLoggedInAccount(handle, "mock-abandon-owner@example.com");
    const rival = await createLoggedInAccount(handle, "mock-abandon-rival@example.com");
    const season = snakeSeason();
    const camTeam = season.teams[0];
    const rivalTeam = season.teams[1];
    if (camTeam === undefined || rivalTeam === undefined) throw new Error("Expected two team fixtures.");
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [
          {
            userId: cam.account.id,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: camTeam.ownerId,
            teamId: camTeam.id,
          },
          {
            userId: rival.account.id,
            leagueId: season.leagueId,
            role: "member",
            ownerId: rivalTeam.ownerId,
            teamId: rivalTeam.id,
          },
        ],
      },
    });
    const createMock = (handler: PlatformHttpHandler, createdAt: Date) => handler({
      method: "POST",
      path: "/season-mock-drafts",
      sessionToken: cam.sessionToken,
      now: createdAt,
      body: { seasonId: season.id, strategy: "balanced" },
    });
    const created = await createMock(handle, now);
    const createdSession = expectBodyRecord(expectBodyRecord(created.body).mockSession);
    const sessionId = expectString(createdSession.id);
    const revision = Number(createdSession.revision);

    await expect(createMock(handle, new Date(now.getTime() + 1_000))).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "season_active_session_limit" } },
    });
    setupAvailable = false;
    await expect(handle({
      method: "POST",
      path: `/season-mock-drafts/${sessionId}/abandon`,
      sessionToken: rival.sessionToken,
      now: new Date(now.getTime() + 2_000),
      body: { seasonId: season.id, expectedRevision: revision },
    })).resolves.toMatchObject({
      status: 404,
      body: { error: { code: "session_not_found" } },
    });
    await expect(handle({
      method: "POST",
      path: `/season-mock-drafts/${sessionId}/abandon`,
      sessionToken: cam.sessionToken,
      now: new Date(now.getTime() + 3_000),
      body: { seasonId: season.id, expectedRevision: revision },
    })).resolves.toMatchObject({
      status: 200,
      body: {
        mockSession: {
          id: sessionId,
          status: "abandoned",
          abandonedAt: new Date(now.getTime() + 3_000),
        },
      },
    });
    await expect(handle({
      method: "POST",
      path: `/season-mock-drafts/${sessionId}/abandon`,
      sessionToken: cam.sessionToken,
      now: new Date(now.getTime() + 3_500),
      body: { seasonId: season.id, expectedRevision: revision },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "session_not_writable" } },
    });
    expect(setupProvider).toHaveBeenCalledTimes(1);

    const restoredStore = new InMemoryPlatformStore(store.snapshot(), {
      mockDraftSessionResourcePolicy: resourcePolicy,
    });
    const restoredHandle = createPlatformHttpHandler(
      createPlatformApp({ store: restoredStore, simulationRunner: mockRunner }),
      { liveDraftRoomSetupProvider: setupProvider },
    );
    setupAvailable = true;
    await expect(createMock(restoredHandle, new Date(now.getTime() + 4_000))).resolves.toMatchObject({
      status: 201,
      body: { mockSession: { status: "setup" } },
    });
  });

  it("uses the same durable mock contract for auction leagues", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      liveDraftRoomSetupProvider: async () => ({
        playerCatalog: snakePlayerCatalog,
        initialRosters: [{
          teamId: "snake-team-1",
          playerId: "player 1",
          playerName: "Player 1",
          position: "RB",
          price: 42,
          source: "keeper",
        }],
      }),
    });
    const cam = await createLoggedInAccount(handle, "auction-mock@example.com");
    const snake = snakeSeason();
    const season: LeagueSeason = {
      ...snake,
      id: "auction-season-2026",
      teams: snake.teams.map(team => ({ ...team, leagueSeasonId: "auction-season-2026" })),
      settings: {
        ...snake.settings,
        draftFormat: "auction",
        snake: undefined,
        auction: { budgetDollars: 200, minimumBidDollars: 1 },
      },
    };
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [{
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: season.teams[0]?.ownerId,
          teamId: season.teams[0]?.id,
        }],
      },
    });
    const created = await handle({
      method: "POST",
      path: "/season-mock-drafts",
      sessionToken: cam.sessionToken,
      body: { seasonId: season.id, strategy: "wr-heavy" },
    });
    expect(created).toMatchObject({
      status: 201,
      body: {
        mockSession: {
          draftMode: { format: "auction", label: expect.stringContaining("WR Heavy") },
          configurationSnapshot: {
            payload: {
              playerExpectedPrices: expect.any(Object),
              playerHumanValues: expect.any(Object),
            },
          },
        },
        state: {
          session: { status: "setup", phase: "not_started" },
          board: {
            players: expect.arrayContaining([
              expect.objectContaining({
                id: "player 1",
                expectedPrice: expect.any(Number),
                humanValue: expect.any(Number),
                available: false,
              }),
            ]),
          },
          teams: expect.arrayContaining([
            expect.objectContaining({
              id: "snake-team-1",
              spent: 42,
              budgetRemaining: 158,
              rosterSlotsRemaining: 1,
              maxBid: 158,
              roster: [expect.objectContaining({
                playerId: "player 1",
                price: 42,
                source: "keeper",
              })],
            }),
          ]),
        },
      },
    });
    const createdBody = expectBodyRecord(created.body);
    const mockSession = createdBody.mockSession as { id: string };
    const setupState = createdBody.state as { teams: readonly unknown[] };
    const started = await handle({
      method: "POST",
      path: `/season-mock-drafts/${mockSession.id}/commands`,
      sessionToken: cam.sessionToken,
      body: {
        seasonId: season.id,
        commandId: "start-auction",
        command: { type: "start", expectedRevision: 0 },
      },
    });
    expect(started).toMatchObject({
      status: 200,
      body: { state: { session: { status: "active", phase: "awaiting_human_nomination" } } },
    });
    expect(expectBodyRecord(expectBodyRecord(started.body).state).teams).toEqual(setupState.teams);
  });

  it("runs private league-aware simulations for a claimed team", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const liveDraftRoomSetupRepository = new InMemoryLiveDraftRoomSetupRepository();
    const handle = createPlatformHttpHandler(app, {
      liveDraftRoomSetupProvider: async () => ({ playerCatalog: snakePlayerCatalog, initialRosters: [] }),
      liveDraftRoomSetupRepository,
      currentPlayerCatalogProvider: async () => snakePlayerCatalog.map((player, index) => ({
        ...player,
        week1Projection: index + 1,
      })),
      simulationRateLimiter: createClientAddressRateLimiter({
        maxAttempts: 3,
        windowMs: 60_000,
        maxTrackedEmails: 10,
      }),
    });
    const cam = await createLoggedInAccount(handle, "snake-simulations@example.com");
    const outsider = await createLoggedInAccount(handle, "simulation-outsider@example.com");
    const season = snakeSeason();
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [{
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: season.teams[0]?.ownerId,
          teamId: season.teams[0]?.id,
        }],
      },
    });
    await liveDraftRoomSetupRepository.save({
      seasonId: season.id,
      sourceVersion: "legacy-catalog-without-projections",
      playerCatalog: snakePlayerCatalog,
      initialRosters: [],
      updatedAt: now,
    });

    await expect(handle({
      method: "POST",
      path: "/season-simulations",
      body: { seasonId: season.id, count: 2, strategy: "Draft Player 1 by round 1" },
    })).resolves.toMatchObject({ status: 401, body: { error: { code: "auth_required" } } });
    await expect(handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: outsider.sessionToken,
      body: { seasonId: season.id, count: 2, strategy: "Draft Player 1 by round 1" },
    })).resolves.toMatchObject({ status: 403, body: { error: { code: "membership_required" } } });
    await expect(handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: cam.sessionToken,
      body: { seasonId: season.id, count: 101, strategy: "Draft Player 1 by round 1" },
    })).resolves.toMatchObject({ status: 400, body: { error: { code: "invalid_run_count" } } });

    const simulationResponse = await handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: cam.sessionToken,
      now,
      body: {
        seasonId: season.id,
        count: 2,
        strategy: "Draft Player 1 by round 1",
        note: "Compare a first-round target.",
      },
    });
    expect(simulationResponse).toMatchObject({
      status: 200,
      body: {
        simulation: {
          draftFormat: "snake",
          runCount: 2,
          completedCount: 2,
          strategy: {
            target: { playerName: "Player 1", maxSnakeRound: 1 },
            warnings: [],
          },
          targetOutcome: { playerName: "Player 1", hitCount: 2, hitRate: 1 },
          runs: expect.arrayContaining([
            expect.objectContaining({
              label: "Run 1",
              teams: expect.arrayContaining([
                expect.objectContaining({ roster: expect.any(Array), week1Points: expect.any(Number) }),
              ]),
            }),
          ]),
        },
      },
    });
    const simulation = expectBodyRecord(expectBodyRecord(simulationResponse.body).simulation);
    const historyId = expectString(expectBodyRecord(simulationResponse.body).historyId);
    const runs = simulation.runs as Array<{ teams: Array<{ roster: Array<{ week1Points: number }> }> }>;
    expect(runs[0]?.teams.flatMap(team => team.roster).some(player => player.week1Points > 0)).toBe(true);
    const newerSimulationResponse = await handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: cam.sessionToken,
      now: new Date(now.getTime() + 1_000),
      body: { seasonId: season.id, count: 1, strategy: "Draft Player 2 by round 2" },
    });
    const newerHistoryId = expectString(expectBodyRecord(newerSimulationResponse.body).historyId);
    await expect(handle({
      method: "GET",
      path: "/season-simulations",
      query: { seasonId: season.id },
      sessionToken: cam.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        history: [
          { id: newerHistoryId, simulation: { runCount: 1, draftFormat: "snake" } },
          {
            id: historyId,
            note: "Compare a first-round target.",
            simulation: { runCount: 2, draftFormat: "snake" },
          },
        ],
      },
    });
    await expect(handle({
      method: "GET",
      path: `/season-simulations/${historyId}`,
      sessionToken: cam.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        historyId,
        note: "Compare a first-round target.",
        simulation: { runCount: 2, runs: expect.any(Array) },
      },
    });
    const streamedSimulationResponse = await handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: cam.sessionToken,
      now: new Date(now.getTime() + 2_000),
      headers: { accept: "text/event-stream" },
      body: { seasonId: season.id, count: 2, strategy: "Draft Player 1 by round 1" },
    });
    expect(streamedSimulationResponse).toMatchObject({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
    const stream = streamedSimulationResponse.body;
    if (
      stream === null
      || typeof stream !== "object"
      || !(Symbol.asyncIterator in stream)
    ) {
      throw new Error("Expected a season simulation event stream.");
    }
    let streamedEvents = "";
    for await (const chunk of stream as AsyncIterable<string>) streamedEvents += chunk;
    expect(streamedEvents).toContain('event: progress\ndata: {"completed":1,"total":2}');
    expect(streamedEvents).toContain('event: progress\ndata: {"completed":2,"total":2}');
    expect(streamedEvents).toContain('event: result\ndata: {"simulation":');
    await expect(handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: cam.sessionToken,
      now: new Date(now.getTime() + 3_000),
      body: { seasonId: season.id, count: 2, strategy: "Draft Player 1 by round 1" },
    })).resolves.toMatchObject({
      status: 429,
      body: { error: { code: "rate_limited" } },
      headers: { "Retry-After": "57" },
    });
  });

  it("persists a Practice shortlist privately for each league member", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      liveDraftRoomSetupProvider: async () => ({ playerCatalog, initialRosters: [] }),
    });
    const cam = await createLoggedInAccount(handle, "practice-shortlist@example.com");
    const outsider = await createLoggedInAccount(handle, "practice-shortlist-outsider@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [{
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: season.teams[0]?.ownerId,
          teamId: season.teams[0]?.id,
        }],
      },
    });

    await expect(handle({
      method: "GET",
      path: "/practice-shortlist",
      query: { seasonId: season.id },
    })).resolves.toMatchObject({ status: 401 });
    await expect(handle({
      method: "PUT",
      path: "/practice-shortlist",
      sessionToken: outsider.sessionToken,
      body: { seasonId: season.id, playerName: "Puka Nacua", position: "WR" },
    })).resolves.toMatchObject({ status: 403, body: { error: { code: "membership_required" } } });
    await expect(handle({
      method: "PUT",
      path: "/practice-shortlist",
      sessionToken: cam.sessionToken,
      body: { seasonId: season.id, playerName: "Puka Nacua", maxBid: 0 },
    })).resolves.toMatchObject({ status: 400, body: { error: { code: "invalid_max_bid" } } });
    await expect(handle({
      method: "PUT",
      path: "/practice-shortlist",
      sessionToken: cam.sessionToken,
      body: { seasonId: season.id, playerName: "puka nacua", position: "WR" },
    })).resolves.toMatchObject({
      status: 200,
      body: { item: { playerName: "Puka Nacua", position: "WR", userId: cam.account.id } },
    });
    await expect(handle({
      method: "GET",
      path: "/practice-shortlist",
      query: { seasonId: season.id },
      sessionToken: cam.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: { items: [{ playerName: "Puka Nacua", position: "WR" }] },
    });
    expect(store.snapshot().practiceShortlistItems).toHaveLength(1);
    await expect(handle({
      method: "DELETE",
      path: "/practice-shortlist",
      sessionToken: cam.sessionToken,
      body: { seasonId: season.id, playerName: "Puka Nacua" },
    })).resolves.toMatchObject({ status: 200, body: { removed: true } });
    expect(store.snapshot().practiceShortlistItems).toHaveLength(0);
  });

  it("changes a signed-in password, clears the cookie, and requires every device to sign in again", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const firstLogin = await createLoggedInAccount(handle, "password-http@example.com");
    const secondLogin = await handle({
      method: "POST",
      path: "/sessions",
      body: { email: firstLogin.account.email, password: "secure password" },
    });
    const secondToken = sessionTokenFrom(secondLogin);

    await expect(handle({
      method: "PUT",
      path: "/session/password",
      sessionToken: "",
      body: {
        currentPassword: "secure password",
        newPassword: "replacement secure password",
        newPasswordConfirmation: "replacement secure password",
      },
    })).resolves.toMatchObject({
      status: 401,
      body: { error: { code: "auth_required" } },
    });
    await expect(handle({
      method: "PUT",
      path: "/session/password",
      sessionToken: firstLogin.sessionToken,
      body: {
        currentPassword: "wrong current password",
        newPassword: "replacement secure password",
        newPasswordConfirmation: "replacement secure password",
      },
    })).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "invalid_current_password" } },
    });

    const response = await handle({
      method: "PUT",
      path: "/session/password",
      sessionToken: firstLogin.sessionToken,
      now: new Date(now.getTime() + 2),
      body: {
        currentPassword: "secure password",
        newPassword: "replacement secure password",
        newPasswordConfirmation: "replacement secure password",
      },
    });
    expect(response).toMatchObject({
      status: 200,
      body: { ok: true },
      headers: { "Set-Cookie": expect.stringContaining("Max-Age=0") },
    });
    await expect(handle({ method: "GET", path: "/session", sessionToken: firstLogin.sessionToken }))
      .resolves.toMatchObject({ status: 401 });
    await expect(handle({ method: "GET", path: "/session", sessionToken: secondToken }))
      .resolves.toMatchObject({ status: 401 });
    await expect(handle({
      method: "POST",
      path: "/sessions",
      body: { email: firstLogin.account.email, password: "secure password" },
    })).resolves.toMatchObject({ status: 401 });
    await expect(handle({
      method: "POST",
      path: "/sessions",
      body: { email: firstLogin.account.email, password: "replacement secure password" },
    })).resolves.toMatchObject({ status: 200 });
  });

  it("connects onboarding and invitation lifecycle routes to league membership", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const invitationRepository = new InMemoryPlatformInvitationRepository();
    const acceptedMemberships: unknown[] = [];
    const onboardingRepository = {
      listForUser: async (userId: string) => userId === "missing" ? [] : [{
        leagueId: "league-214674",
        leagueName: "Sunday Games",
        seasonId: "league-214674-season-2026",
        seasonYear: 2026,
        membership: { role: "owner" as const },
        canManageLeague: true,
        readiness: {
          leagueSetup: "ready" as const,
          teamClaim: "needs_attention" as const,
          liveDraft: "needs_attention" as const,
        },
        liveDraft: null,
      }],
    };
    const handle = createPlatformHttpHandler(app, {
      invitationRepository,
      leagueSetupRepository: store,
      onboardingRepository,
      allowPublicSignup: true,
      applyAcceptedMembership: result => {
        acceptedMemberships.push(result.membership);
      },
    });
    const cam = await createLoggedInAccount(handle, "cam@example.com");
    const seth = await createLoggedInAccount(handle, "seth@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Sunday Games",
      setupStatus: "published",
    });
    await app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [{ userId: cam.account.id, leagueId: season.leagueId, role: "owner" }],
      now,
    });
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (sethTeam === undefined) throw new Error("Expected Seth team fixture.");
    await issuePlatformInvitation(invitationRepository, {
      leagueId: season.leagueId,
      seasonId: season.id,
      email: seth.account.email,
      role: "member",
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      ownerDisplayName: sethTeam.ownerDisplayName,
      teamDisplayName: sethTeam.displayName,
      invitedByUserId: cam.account.id,
      now,
      expiresAt: new Date(now.getTime() + 86_400_000),
    }, {
      idFactory: () => "invite_seth",
      tokenFactory: () => "initial-token",
    });

    await expect(handle({
      method: "GET",
      path: "/onboarding",
      sessionToken: cam.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: { account: { id: cam.account.id }, leagues: [{ leagueName: "Sunday Games" }] },
    });
    await expect(handle({
      method: "GET",
      path: `/invitations?seasonId=${encodeURIComponent(season.id)}`,
      sessionToken: seth.sessionToken,
    })).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "membership_required" } },
    });
    await expect(handle({
      method: "GET",
      path: `/invitations?seasonId=${encodeURIComponent(season.id)}`,
      sessionToken: cam.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: { invitations: [{ id: "invite_seth", status: "pending" }] },
    });

    const beatonTeam = season.teams.find(team => team.ownerDisplayName === "Beaton");
    if (beatonTeam === undefined) throw new Error("Expected Beaton team fixture.");
    const issued = await handle({
      method: "POST",
      path: "/invitations",
      sessionToken: cam.sessionToken,
      now,
      body: {
        seasonId: season.id,
        teamId: beatonTeam.id,
        email: " Beaton@Example.com ",
      },
    });
    expect(issued).toMatchObject({
      status: 201,
      body: {
        invitation: {
          email: "beaton@example.com",
          role: "member",
          teamDisplayName: beatonTeam.displayName,
          acceptPath: expect.stringContaining("/invite?token="),
        },
      },
    });
    await expect(handle({
      method: "POST",
      path: "/invitations",
      sessionToken: seth.sessionToken,
      now,
      body: {
        seasonId: season.id,
        teamId: beatonTeam.id,
        email: "other@example.com",
      },
    })).resolves.toMatchObject({ status: 403 });
    await expect(handle({
      method: "POST",
      path: "/invitations",
      sessionToken: cam.sessionToken,
      now,
      body: {
        seasonId: season.id,
        teamId: "missing-team",
        email: "other@example.com",
      },
    })).resolves.toMatchObject({
      status: 404,
      body: { error: { code: "team_not_found" } },
    });

    const reissued = await handle({
      method: "POST",
      path: "/invitations/invite_seth/reissue",
      sessionToken: cam.sessionToken,
      now,
    });
    expect(reissued).toMatchObject({
      status: 200,
      body: { invitation: { status: "pending", acceptPath: expect.stringContaining("/invite?token=") } },
    });
    const reissuedBody = expectBodyRecord(reissued.body);
    const reissuedInvitation = expectBodyRecord(reissuedBody.invitation);
    const token = new URL(expectString(reissuedInvitation.acceptPath), "http://mockd.local")
      .searchParams.get("token");
    if (token === null) throw new Error("Expected reissued invitation token.");

    await expect(handle({
      method: "GET",
      path: `/invitations/details?token=${encodeURIComponent(token)}`,
      now,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        invitation: { kind: "team", teamId: sethTeam.id },
        teams: [{ id: sethTeam.id, status: "available" }],
      },
    });
    await expect(handle({
      method: "POST",
      path: "/invitations/claim",
      sessionToken: seth.sessionToken,
      body: { token, teamId: sethTeam.id },
      now,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        invitation: { status: "accepted" },
        membership: { userId: seth.account.id, teamId: sethTeam.id },
      },
    });
    expect(acceptedMemberships).toEqual([
      expect.objectContaining({ userId: seth.account.id, leagueId: season.leagueId }),
    ]);
  });

  it("shares one league invitation and lets each account claim an available team", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const invitationRepository = new InMemoryPlatformInvitationRepository();
    const commissioner = await createLoggedInAccount(
      createPlatformHttpHandler(app, { allowPublicSignup: true }),
      "commissioner@example.com",
    );
    const seth = await createLoggedInAccount(
      createPlatformHttpHandler(app, { allowPublicSignup: true }),
      "seth@example.com",
    );
    const hoody = await createLoggedInAccount(
      createPlatformHttpHandler(app, { allowPublicSignup: true }),
      "hoody@example.com",
    );
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Sunday Games",
      setupStatus: "published",
    });
    const commissionerTeam = season.teams[0];
    const sethTeam = season.teams[1];
    const hoodyTeam = season.teams[2];
    if (commissionerTeam === undefined || sethTeam === undefined || hoodyTeam === undefined) {
      throw new Error("Expected at least three teams.");
    }
    let memberships: PlatformLeagueMembership[] = [{
      userId: commissioner.account.id,
      leagueId: season.leagueId,
      role: "owner",
      ownerId: commissionerTeam.ownerId,
      teamId: commissionerTeam.id,
    }];
    await app.registerLeagueSeason({
      actorSessionToken: commissioner.sessionToken,
      season,
      memberships,
      now,
    });
    const handle = createPlatformHttpHandler(app, {
      invitationRepository,
      leagueSetupRepository: store,
      allowPublicSignup: true,
      applyAcceptedMembership: result => {
        memberships = [
          ...memberships.filter(candidate => candidate.userId !== result.membership.userId),
          result.membership,
        ];
        store.registerLeagueSeason({
          season,
          memberships,
          createdByUserId: result.invitation.id,
          now,
        });
      },
    });

    const issued = await handle({
      method: "POST",
      path: "/invitations",
      sessionToken: commissioner.sessionToken,
      now,
      body: { seasonId: season.id },
    });
    expect(issued).toMatchObject({
      status: 201,
      body: {
        invitation: {
          kind: "league",
          status: "pending",
          acceptPath: expect.stringContaining("/invite?token="),
        },
      },
    });
    const invitation = expectBodyRecord(expectBodyRecord(issued.body).invitation);
    const token = new URL(expectString(invitation.acceptPath), "http://mockd.local")
      .searchParams.get("token");
    if (token === null) throw new Error("Expected shared league token.");

    await expect(handle({
      method: "GET",
      path: `/invitations/details?token=${encodeURIComponent(token)}`,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        league: { name: "Sunday Games", seasonYear: season.seasonYear },
        teams: expect.arrayContaining([
          expect.objectContaining({ id: commissionerTeam.id, status: "claimed" }),
          expect.objectContaining({ id: sethTeam.id, status: "available" }),
          expect.objectContaining({ id: hoodyTeam.id, status: "available" }),
        ]),
      },
    });

    await expect(handle({
      method: "POST",
      path: "/invitations/claim",
      sessionToken: seth.sessionToken,
      now,
      body: { token, teamId: sethTeam.id },
    })).resolves.toMatchObject({
      status: 200,
      body: { membership: { userId: seth.account.id, teamId: sethTeam.id } },
    });
    await expect(handle({
      method: "POST",
      path: "/invitations/claim",
      sessionToken: seth.sessionToken,
      now: new Date(now.getTime() + 31 * 24 * 60 * 60 * 1_000),
      body: { token, teamId: sethTeam.id },
    })).resolves.toMatchObject({
      status: 410,
      body: { error: { code: "invitation_expired" } },
    });
    await expect(handle({
      method: "POST",
      path: "/invitations/claim",
      sessionToken: hoody.sessionToken,
      now,
      body: { token, teamId: sethTeam.id },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "team_already_claimed" } },
    });
    expect(await store.findMembership(hoody.account.id, season.leagueId)).toBeNull();
    await expect(handle({
      method: "POST",
      path: "/invitations/claim",
      sessionToken: hoody.sessionToken,
      now,
      body: { token, teamId: hoodyTeam.id },
    })).resolves.toMatchObject({
      status: 200,
      body: { membership: { userId: hoody.account.id, teamId: hoodyTeam.id } },
    });
    expect(await invitationRepository.findById(expectString(invitation.id)))
      .toMatchObject({ kind: "league", status: "pending" });
  });

  it("rejects invitations for claimed teams and existing league members while preserving pending conflicts", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const invitationRepository = new InMemoryPlatformInvitationRepository();
    const handle = createPlatformHttpHandler(app, {
      invitationRepository,
      allowPublicSignup: true,
    });
    const commissioner = await createLoggedInAccount(handle, "commissioner@example.com");
    const existingMember = await createLoggedInAccount(handle, "member@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Sunday Games",
      setupStatus: "published",
    });
    const claimedTeam = season.teams[0];
    const firstOpenTeam = season.teams[1];
    const secondOpenTeam = season.teams[2];
    if (claimedTeam === undefined || firstOpenTeam === undefined || secondOpenTeam === undefined) {
      throw new Error("Expected at least three team fixtures.");
    }
    await app.registerLeagueSeason({
      actorSessionToken: commissioner.sessionToken,
      season,
      memberships: [
        { userId: commissioner.account.id, leagueId: season.leagueId, role: "owner" },
        {
          userId: existingMember.account.id,
          leagueId: season.leagueId,
          role: "admin",
          ownerId: claimedTeam.ownerId,
          teamId: claimedTeam.id,
        },
      ],
      now,
    });

    await expect(handle({
      method: "POST",
      path: "/invitations",
      sessionToken: commissioner.sessionToken,
      now,
      body: {
        seasonId: season.id,
        teamId: claimedTeam.id,
        email: "new-manager@example.com",
      },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "invitation_team_claimed" } },
    });
    await expect(handle({
      method: "POST",
      path: "/invitations",
      sessionToken: commissioner.sessionToken,
      now,
      body: {
        seasonId: season.id,
        teamId: firstOpenTeam.id,
        email: " MEMBER@example.com ",
      },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "invitation_existing_member" } },
    });

    await expect(handle({
      method: "POST",
      path: "/invitations",
      sessionToken: commissioner.sessionToken,
      now,
      body: {
        seasonId: season.id,
        teamId: firstOpenTeam.id,
        email: "pending@example.com",
      },
    })).resolves.toMatchObject({ status: 201 });
    await expect(handle({
      method: "POST",
      path: "/invitations",
      sessionToken: commissioner.sessionToken,
      now,
      body: {
        seasonId: season.id,
        teamId: secondOpenTeam.id,
        email: "pending@example.com",
      },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "invitation_email_conflict" } },
    });
    await expect(handle({
      method: "POST",
      path: "/invitations",
      sessionToken: commissioner.sessionToken,
      now,
      body: {
        seasonId: season.id,
        teamId: firstOpenTeam.id,
        email: "different@example.com",
      },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "invitation_team_conflict" } },
    });

    await issuePlatformInvitation(invitationRepository, {
      leagueId: season.leagueId,
      seasonId: season.id,
      email: existingMember.account.email,
      role: "member",
      ownerId: firstOpenTeam.ownerId,
      teamId: firstOpenTeam.id,
      ownerDisplayName: firstOpenTeam.ownerDisplayName,
      teamDisplayName: firstOpenTeam.displayName,
      invitedByUserId: commissioner.account.id,
      now,
      expiresAt: new Date(now.getTime() + 86_400_000),
    }, {
      idFactory: () => "invite_existing_member_race",
      tokenFactory: () => "existing-member-race-token",
    });
    await expect(handle({
      method: "POST",
      path: "/invitations/accept",
      sessionToken: existingMember.sessionToken,
      now,
      body: { token: "existing-member-race-token" },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "invitation_existing_member" } },
    });

    const invitedManager = await createLoggedInAccount(handle, "invited-manager@example.com");
    const claimingManager = await createLoggedInAccount(handle, "claiming-manager@example.com");
    await issuePlatformInvitation(invitationRepository, {
      leagueId: season.leagueId,
      seasonId: season.id,
      email: invitedManager.account.email,
      role: "member",
      ownerId: secondOpenTeam.ownerId,
      teamId: secondOpenTeam.id,
      ownerDisplayName: secondOpenTeam.ownerDisplayName,
      teamDisplayName: secondOpenTeam.displayName,
      invitedByUserId: commissioner.account.id,
      now,
      expiresAt: new Date(now.getTime() + 86_400_000),
    }, {
      idFactory: () => "invite_claimed_team_race",
      tokenFactory: () => "claimed-team-race-token",
    });
    await app.registerLeagueSeason({
      actorSessionToken: commissioner.sessionToken,
      season,
      memberships: [
        { userId: commissioner.account.id, leagueId: season.leagueId, role: "owner" },
        {
          userId: existingMember.account.id,
          leagueId: season.leagueId,
          role: "admin",
          ownerId: claimedTeam.ownerId,
          teamId: claimedTeam.id,
        },
        {
          userId: claimingManager.account.id,
          leagueId: season.leagueId,
          role: "member",
          ownerId: secondOpenTeam.ownerId,
          teamId: secondOpenTeam.id,
        },
      ],
      now,
    });
    await expect(handle({
      method: "POST",
      path: "/invitations/accept",
      sessionToken: invitedManager.sessionToken,
      now,
      body: { token: "claimed-team-race-token" },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "invitation_team_claimed" } },
    });
  });

  it("serves unauthenticated health and readiness probes", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);

    await expect(handle({ method: "GET", path: "/healthz" })).resolves.toEqual({
      status: 200,
      body: {
        service: "mockd-platform",
        status: "ok",
      },
    });
    await expect(handle({ method: "GET", path: "/readyz" })).resolves.toEqual({
      status: 200,
      body: {
        service: "mockd-platform",
        status: "ok",
      },
    });
    await expect(handle({ method: "POST", path: "/readyz" })).resolves.toEqual({
      status: 405,
      body: {
        error: {
          code: "method_not_allowed",
          message: "Method is not allowed for this route.",
        },
      },
    });

  });

  it("reports unavailable when a readiness dependency fails", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const readinessProbe = vi.fn(async () => false);
    const handle = createPlatformHttpHandler(app, { readinessProbe });

    await expect(handle({ method: "GET", path: "/healthz" })).resolves.toMatchObject({
      status: 200,
      body: { status: "ok" },
    });
    await expect(handle({ method: "GET", path: "/readyz" })).resolves.toEqual({
      status: 503,
      body: {
        service: "mockd-platform",
        status: "unavailable",
      },
    });
    expect(readinessProbe).toHaveBeenCalledOnce();
  });

  it("creates accounts, logs in, and returns stable auth error responses", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);

    const created = await handle({
      method: "POST",
      path: "/accounts",
      body: {
        email: "  Cam@Example.com ",
        password: "secure password",
        now,
      },
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      account: {
        id: expect.stringMatching(/^acct_/),
        email: "cam@example.com",
      },
    });

    const duplicate = await handle({
      method: "POST",
      path: "/accounts",
      body: {
        email: "cam@example.com",
        password: "different password",
        now,
      },
    });

    expect(duplicate).toEqual({
      status: 409,
      body: {
        error: {
          code: "duplicate_email",
          message: "An account with this email already exists.",
        },
      },
    });

    const rejectedLogin = await handle({
      method: "POST",
      path: "/sessions",
      body: {
        email: "cam@example.com",
        password: "wrong password",
        now,
      },
    });

    expect(rejectedLogin).toEqual({
      status: 401,
      body: {
        error: {
          code: "invalid_credentials",
          message: "Email or password is incorrect.",
        },
      },
    });

    const login = await handle({
      method: "POST",
      path: "/sessions",
      headers: { host: "mockd.example.com" },
      body: {
        email: "cam@example.com",
        password: "secure password",
        now,
      },
    });

    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({
      account: {
        id: expect.stringMatching(/^acct_/),
        email: "cam@example.com",
      },
      session: {
        id: expect.stringMatching(/^sess_/),
        accountId: expect.any(String),
      },
    });
    expectPublicBrowserPayload(login.body);
    expect(JSON.stringify(login.body)).not.toContain("tokenHash");
    expect(JSON.stringify(login.body)).not.toContain("scrypt");
    expect(login.headers?.["Set-Cookie"]).toEqual(expect.stringContaining("mockd_session="));
    expect(login.headers?.["Set-Cookie"]).toEqual(expect.stringContaining("HttpOnly"));
    expect(login.headers?.["Set-Cookie"]).toEqual(expect.stringContaining("Secure"));
  });

  it("limits production account creation to matching pending invitations", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const invitationRepository = new InMemoryPlatformInvitationRepository();
    await invitationRepository.savePending({
      id: "invite_seth",
      leagueId: "league_1",
      seasonId: "season_2026",
      kind: "team",
      email: "seth@example.com",
      role: "member",
      ownerId: "seth",
      teamId: "team_seth",
      ownerDisplayName: "Seth",
      teamDisplayName: "Seth",
      invitedByUserId: "acct_cam",
      tokenHash: hashPlatformInvitationToken("valid-invitation-token"),
      status: "pending",
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: now,
    });
    await invitationRepository.savePending({
      id: "invite_league",
      leagueId: "league_1",
      seasonId: "season_2026",
      kind: "league",
      role: "member",
      invitedByUserId: "acct_cam",
      tokenHash: hashPlatformInvitationToken("shared-league-token"),
      status: "pending",
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: now,
    });
    const handle = createPlatformHttpHandler(app, { invitationRepository });

    await expect(handle({
      method: "POST",
      path: "/accounts",
      now,
      body: { email: "other@example.com", password: "secure password" },
    })).resolves.toEqual({
      status: 403,
      body: {
        error: {
          code: "invitation_required",
          message: "Use the account link from your league invitation.",
        },
      },
    });

    await expect(handle({
      method: "POST",
      path: "/accounts",
      now,
      body: {
        email: "seth@example.com",
        password: "secure password",
        invitationToken: "valid-invitation-token",
      },
    })).resolves.toMatchObject({
      status: 201,
      body: { account: { email: "seth@example.com" } },
    });

    await expect(handle({
      method: "POST",
      path: "/accounts",
      now,
      body: {
        email: "new-manager@example.com",
        password: "secure password",
        invitationToken: "shared-league-token",
      },
    })).resolves.toMatchObject({
      status: 201,
      body: { account: { email: "new-manager@example.com" } },
    });
  });

  it("rate limits normalized account attempts and client auth traffic", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      accountRateLimiter: createNormalizedEmailRateLimiter({
        maxAttempts: 1,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
      authClientRateLimiter: createClientAddressRateLimiter({
        maxAttempts: 10,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
    });

    await expect(handle({
      method: "POST",
      path: "/accounts",
      clientAddress: "127.0.0.1",
      now,
      body: { email: "User@Example.com", password: "secure password" },
    })).resolves.toMatchObject({ status: 201 });
    await expect(handle({
      method: "POST",
      path: "/accounts",
      clientAddress: "127.0.0.1",
      now,
      body: { email: " user@example.COM ", password: "secure password" },
    })).resolves.toEqual({
      status: 429,
      headers: { "Retry-After": "60" },
      body: {
        error: {
          code: "auth_rate_limited",
          message: "Too many attempts. Try again later.",
        },
      },
    });
  });

  it("bootstraps and clears the current browser session", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const cam = await createLoggedInAccount(handle, "cam@example.com");

    const current = await handle({
      method: "GET",
      path: "/session",
      sessionToken: cam.sessionToken,
      now,
    });
    const loggedOut = await handle({
      method: "DELETE",
      path: "/session",
      sessionToken: cam.sessionToken,
      headers: { host: "mockd.example.com" },
      now: new Date(now.getTime() + 1_000),
    });
    const afterLogout = await handle({
      method: "GET",
      path: "/session",
      sessionToken: cam.sessionToken,
      now: new Date(now.getTime() + 2_000),
    });

    expect(current).toMatchObject({
      status: 200,
      body: {
        account: {
          id: cam.account.id,
          email: "cam@example.com",
        },
      },
    });
    expect(loggedOut).toEqual({
      status: 200,
      headers: {
        "Set-Cookie": "mockd_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax",
      },
      body: { ok: true },
    });
    expect(afterLogout).toEqual({
      status: 401,
      body: {
        error: {
          code: "auth_required",
          message: "Sign in before using this workspace.",
        },
      },
    });
  });

  it("marks session cookies Secure for HTTPS and forwarded HTTPS requests", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);

    await handle({
      method: "POST",
      path: "/accounts",
      body: {
        email: "https@example.com",
        password: "secure password",
        now,
      },
    });

    const loginRequest = {
      method: "POST",
      path: "/sessions",
      isSecure: true,
      headers: { host: "localhost:3000" },
      body: {
        email: "https@example.com",
        password: "secure password",
        now,
      },
    } satisfies PlatformHttpRequest;
    const login = await handle(loginRequest);
    const sessionToken = sessionTokenFrom(login);

    expect(login.headers?.["Set-Cookie"]).toEqual(expect.stringContaining("Secure"));
    expect(login.headers?.["Set-Cookie"]).toEqual(expect.stringContaining("SameSite=Lax"));

    const logout = await handle({
      method: "DELETE",
      path: "/session",
      isSecure: true,
      sessionToken,
      headers: { host: "localhost:3000" },
      now: new Date(now.getTime() + 1_000),
    } satisfies PlatformHttpRequest);

    expect(logout.headers?.["Set-Cookie"]).toBe(
      "mockd_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax",
    );

    const forwardedLogin = await handle({
      method: "POST",
      path: "/sessions",
      headers: { host: "localhost:3000", "x-forwarded-proto": "https,http" },
      body: {
        email: "https@example.com",
        password: "secure password",
        now,
      },
    });

    expect(forwardedLogin.headers?.["Set-Cookie"]).toEqual(expect.stringContaining("Secure"));
    expect(forwardedLogin.headers?.["Set-Cookie"]).toEqual(expect.stringContaining("SameSite=Lax"));
  });

  it("keeps loopback HTTP session cookies compatible with local development", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);

    await handle({
      method: "POST",
      path: "/accounts",
      body: {
        email: "local@example.com",
        password: "secure password",
        now,
      },
    });

    const login = await handle({
      method: "POST",
      path: "/sessions",
      headers: { host: "127.0.0.1:3000" },
      body: {
        email: "local@example.com",
        password: "secure password",
        now,
      },
    });
    const sessionToken = sessionTokenFrom(login);

    expect(login.headers?.["Set-Cookie"]).toEqual(expect.stringContaining("SameSite=Lax"));
    expect(login.headers?.["Set-Cookie"]).not.toEqual(expect.stringContaining("Secure"));

    const logout = await handle({
      method: "DELETE",
      path: "/session",
      sessionToken,
      headers: { host: "127.0.0.1:3000" },
      now: new Date(now.getTime() + 1_000),
    });

    expect(logout.headers?.["Set-Cookie"]).toBe(
      "mockd_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax",
    );
  });

  it("does not authenticate protected routes with session tokens in query strings or bodies", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const cam = await createLoggedInAccount(handle, "cam@example.com");

    const queryTokenResponse = await handle({
      method: "GET",
      path: `/seasons/missing-season?sessionToken=${encodeURIComponent(cam.sessionToken)}`,
    });
    const bodyTokenResponse = await handle({
      method: "GET",
      path: "/seasons/missing-season",
      body: {
        sessionToken: cam.sessionToken,
      },
    });

    expect(queryTokenResponse).toEqual({
      status: 401,
      body: {
        error: {
          code: "auth_required",
          message: "Sign in before using this workspace.",
        },
      },
    });
    expect(bodyTokenResponse).toEqual(queryTokenResponse);
  });

  it("uses trusted request time instead of client-provided body or query time for auth", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);

    const created = await handle({
      method: "POST",
      path: "/accounts",
      now,
      body: {
        email: "cam@example.com",
        password: "secure password",
        now: new Date("2099-01-01T00:00:00.000Z"),
      },
    });
    const login = await handle({
      method: "POST",
      path: "/sessions",
      now,
      body: {
        email: "cam@example.com",
        password: "secure password",
        now: new Date("2099-01-01T00:00:00.000Z"),
      },
    });
    const account = expectAccount(expectBodyRecord(created.body).account);
    const sessionToken = sessionTokenFrom(login);
    const afterDefaultSessionExpiry = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);

    expect(account.createdAt).toEqual(now);

    const protectedResponse = await handle({
      method: "GET",
      path: `/seasons/missing-season?now=${encodeURIComponent(now.toISOString())}`,
      sessionToken,
      now: afterDefaultSessionExpiry,
      body: {
        now,
      },
    });

    expect(protectedResponse).toEqual({
      status: 401,
      body: {
        error: {
          code: "auth_required",
          message: "Sign in before using this workspace.",
        },
      },
    });
  });

  it("returns user-facing live sale validation errors through the HTTP boundary", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      allowPublicSignup: true,
      provisioningToken: "test-provisioning-token",
      currentPlayerCatalogProvider: async () => playerCatalog,
      postDraftProjectionProvider: async (projectionSeason, catalog, evaluatedAt) => ({
        metadata: {
          snapshotId: "test-projections",
          leagueId: projectionSeason.leagueId,
          seasonId: projectionSeason.id,
          scoringSettingsId: postDraftScoringSettingsIdForSeason(projectionSeason),
          generatedAt: evaluatedAt.toISOString(),
          validThrough: new Date(evaluatedAt.getTime() + 60_000).toISOString(),
          week: 1,
        },
        projections: catalog.map((player, index) => ({
          playerId: `player-${index + 1}`,
          playerName: player.name,
          position: player.position,
          seasonProjectedPoints: Math.max(1, player.expectedPrice) * 4,
          weeklyProjectedPoints: Math.max(1, player.expectedPrice),
        })),
      }),
    });
    const cam = await createLoggedInAccount(handle, "cam@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [
          {
            userId: cam.account.id,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: camTeam.ownerId,
            teamId: camTeam.id,
          },
        ],
        now,
      },
    });

    await handle({
      method: "POST",
      path: "/live-rooms",
      sessionToken: cam.sessionToken,
      headers: { "x-mockd-provisioning-token": "test-provisioning-token" },
      body: {
        seasonId: season.id,
        roomId: "room_wr_limit",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog,
        initialRosters: [
          { teamId: camTeam.id, playerName: "WR One", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Two", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Three", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Four", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Five", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Six", position: "WR", price: 1 },
        ],
        now,
      },
    });

    await handle({
      method: "POST",
      path: "/live-rooms/room_wr_limit/start",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 1,
        idempotencyKey: "start-room-wr-limit",
        now: new Date(now.getTime() + 1_000),
      },
    });

    const overLimitSale = await handle({
      method: "POST",
      path: "/live-rooms/room_wr_limit/sales",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 2,
        idempotencyKey: "sale:legette:2",
        sale: "cam legette 2",
        now: new Date(now.getTime() + 2_000),
      },
    });

    expect(overLimitSale).toEqual({
      status: 409,
      body: {
        error: {
          code: "position_limit",
          message: "Cam cannot buy Xavier Legette: roster limit is 6 WRs.",
        },
      },
    });
  });

  it("claims a league season team for the authenticated account", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const cam = await createLoggedInAccount(handle, "cam@example.com");
    const seth = await createLoggedInAccount(handle, "seth@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [
          { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
          { userId: seth.account.id, leagueId: season.leagueId, role: "member" },
        ],
      },
    });

    await expect(handle({
      method: "GET",
      path: `/seasons/${season.id}`,
      sessionToken: seth.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        claimableTeams: expect.arrayContaining([expect.objectContaining({ id: sethTeam.id })]),
      },
    });
    const beforeClaim = await handle({
      method: "GET",
      path: `/seasons/${season.id}`,
      sessionToken: seth.sessionToken,
    });
    expect((expectBodyRecord(beforeClaim.body).claimableTeams as Array<{ id: string }>).map(team => team.id))
      .not.toContain(camTeam.id);

    const claim = await handle({
      method: "POST",
      path: `/seasons/${season.id}/team-claims`,
      sessionToken: seth.sessionToken,
      body: {
        ownerId: sethTeam.ownerId,
        teamId: sethTeam.id,
      },
    });

    expect(claim).toEqual({
      status: 200,
      body: {
        membership: {
          userId: seth.account.id,
          leagueId: season.leagueId,
          role: "member",
          ownerId: sethTeam.ownerId,
          teamId: sethTeam.id,
        },
      },
    });
    const afterClaim = await handle({
      method: "GET",
      path: `/seasons/${season.id}`,
      sessionToken: seth.sessionToken,
    });
    expect((expectBodyRecord(afterClaim.body).claimableTeams as Array<{ id: string }>).map(team => team.id))
      .not.toContain(sethTeam.id);
  });

  it("provisions a season live room from the server-owned draft setup", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const liveDraftRoomSetupProvider = vi.fn(async () => ({
      playerCatalog,
      initialRosters: [],
    }));
    const handle = createPlatformHttpHandler(app, { liveDraftRoomSetupProvider });
    const cam = await createLoggedInAccount(handle, "cam@example.com");
    const seth = await createLoggedInAccount(handle, "seth@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [
          { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
          { userId: seth.account.id, leagueId: season.leagueId, role: "member" },
        ],
      },
    });

    const denied = await handle({
      method: "POST",
      path: `/seasons/${season.id}/live-room`,
      sessionToken: seth.sessionToken,
      body: {},
    });
    expect(denied).toMatchObject({
      status: 403,
      body: { error: { code: "shared_mutation_denied" } },
    });

    const missingSetup = await createPlatformHttpHandler(app)({
      method: "POST",
      path: `/seasons/${season.id}/live-room`,
      sessionToken: cam.sessionToken,
      body: {},
    });
    expect(missingSetup).toEqual({
      status: 409,
      body: {
        error: {
          code: "live_draft_setup_missing",
          message: "Publish this season's player catalog and keepers before creating its live room.",
        },
      },
    });

    const startsAt = "2026-08-16T22:00:00.000Z";
    const created = await handle({
      method: "POST",
      path: `/seasons/${season.id}/live-room`,
      sessionToken: cam.sessionToken,
      body: { startsAt },
    });

    expect(liveDraftRoomSetupProvider).toHaveBeenCalledWith(season);
    expect(created).toMatchObject({
      status: 201,
      body: {
        room: {
          roomId: `room-${season.id}-real`,
          seasonId: season.id,
          status: "countdown",
          board: expect.arrayContaining([
            expect.objectContaining({ name: "Puka Nacua" }),
          ]),
          role: "commissioner",
          canMutateRoom: true,
        },
      },
    });
    expectPublicBrowserPayload(created.body);
    await expect(handle({
      method: "DELETE",
      path: `/seasons/${season.id}/live-room`,
      sessionToken: seth.sessionToken,
    })).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "shared_mutation_denied" } },
    });
    await expect(handle({
      method: "DELETE",
      path: `/seasons/${season.id}/live-room`,
      sessionToken: cam.sessionToken,
    })).resolves.toEqual({ status: 200, body: { ok: true } });
    await expect(app.hasLiveDraftRoomForSeason(season.id)).resolves.toBe(false);
    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/live-room`,
      sessionToken: cam.sessionToken,
      body: {},
    })).resolves.toMatchObject({ status: 201 });
  });

  it("routes season, simulation, mock session, live room, and export calls through PlatformApp", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      allowPublicSignup: true,
      provisioningToken: "test-provisioning-token",
      currentPlayerCatalogProvider: async () => playerCatalog,
      postDraftProjectionProvider: async (projectionSeason, catalog, evaluatedAt) => ({
        metadata: {
          snapshotId: "test-projections",
          leagueId: projectionSeason.leagueId,
          seasonId: projectionSeason.id,
          scoringSettingsId: postDraftScoringSettingsIdForSeason(projectionSeason),
          generatedAt: evaluatedAt.toISOString(),
          validThrough: new Date(evaluatedAt.getTime() + 60_000).toISOString(),
          week: 1,
        },
        projections: catalog.map((player, index) => ({
          playerId: `player-${index + 1}`,
          playerName: player.name,
          position: player.position,
          seasonProjectedPoints: Math.max(1, player.expectedPrice) * 4,
          weeklyProjectedPoints: Math.max(1, player.expectedPrice),
        })),
      }),
    });
    const cam = await createLoggedInAccount(handle, "cam@example.com");
    const seth = await createLoggedInAccount(handle, "seth@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    const registered = await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [
          {
            userId: cam.account.id,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: camTeam.ownerId,
            teamId: camTeam.id,
          },
          {
            userId: seth.account.id,
            leagueId: season.leagueId,
            role: "member",
            ownerId: sethTeam.ownerId,
            teamId: sethTeam.id,
          },
        ],
        now: now.toISOString(),
      },
    });

    expect(registered.status).toBe(200);
    expect(registered.body).toMatchObject({ season });

    const fetchedSeason = await handle({
      method: "GET",
      path: `/seasons/${season.id}`,
      headers: {
        "x-session-token": seth.sessionToken,
      },
    });

    expect(fetchedSeason.status).toBe(200);
    expect(fetchedSeason.body).toMatchObject({ season });

    const mismatchedSeason = await handle({
      method: "PUT",
      path: "/seasons/another-season",
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [
          {
            userId: cam.account.id,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: camTeam.ownerId,
            teamId: camTeam.id,
          },
        ],
        now,
      },
    });

    expect(mismatchedSeason).toEqual({
      status: 400,
      body: {
        error: {
          code: "season_id_mismatch",
          message: "Season body must match the route season id.",
        },
      },
    });

    const importPreview = await handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/upload-preview`,
      sessionToken: cam.sessionToken,
      body: {
        fileName: "draft-2025.csv",
        mimeType: "text/csv",
        base64: Buffer.from(
          "owner,player,position,price,year\nCam,Puka Nacua,WR,70,2025",
        ).toString("base64"),
        seasonYear: 2025,
        now,
      },
    });
    const previewBody = expectBodyRecord(importPreview.body);
    const previewBatch = expectBodyRecord(previewBody.batch);
    const previewBatchId = expectString(previewBatch.id);

    expect(importPreview.status).toBe(200);
    expect(importPreview.body).toMatchObject({
      source: {
        fileHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        sourceRowCount: 2,
      },
      batch: expect.objectContaining({ status: "previewed" }),
    });

    const committedImport = await handle({
      method: "POST",
      path: `/historical-imports/${previewBatchId}/commit`,
      sessionToken: cam.sessionToken,
      body: {
        seasonId: season.id,
        seasonYear: 2025,
        now: new Date(now.getTime() + 250).toISOString(),
      },
    });

    expect(committedImport.body).toMatchObject({
      committedRecords: [expect.objectContaining({ playerName: "Puka Nacua", priceDollars: 70 })],
      batch: expect.objectContaining({ seasonYear: 2025, leagueSeasonId: season.id }),
      pricing: expect.objectContaining({ snapshots: [expect.objectContaining({ scenarioId: "expected" })] }),
    });

    const secondImportPreview = await handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/preview`,
      sessionToken: cam.sessionToken,
      body: {
        sourceText: "owner,player,position,price,year\nCam,Jahmyr Gibbs,RB,72,2025",
        seasonYear: 2025,
        now: new Date(now.getTime() + 300).toISOString(),
      },
    });
    const secondPreviewBody = expectBodyRecord(secondImportPreview.body);
    const secondPreviewBatch = expectBodyRecord(secondPreviewBody.batch);
    const secondPreviewBatchId = expectString(secondPreviewBatch.id);
    const conflictingImportCommit = await handle({
      method: "POST",
      path: `/historical-imports/${secondPreviewBatchId}/commit`,
      sessionToken: cam.sessionToken,
      body: {
        seasonId: season.id,
        seasonYear: 2025,
        now: new Date(now.getTime() + 350).toISOString(),
      },
    });

    expect(conflictingImportCommit).toEqual({
      status: 409,
      body: {
        error: {
          code: "season_import_conflict",
          message: "Historical import batch already exists for this league season. Request replacement to supersede it.",
        },
      },
    });

    const pricingRebuild = await handle({
      method: "POST",
      path: `/seasons/${season.id}/pricing/rebuild`,
      sessionToken: cam.sessionToken,
      now: new Date(now.getTime() + 500),
      body: {
        modelVersion: "league-calibration-v1",
        scenarioIds: ["balanced"],
        baselinePrices: [
          { name: "Puka Nacua", normalizedName: "puka nacua", position: "WR", price: 50 },
        ],
      },
    });
    const pricingBody = expectBodyRecord(pricingRebuild.body);
    const modelRunId = expectString(pricingBody.modelRunId);

    expect(pricingRebuild.status).toBe(201);
    expect(pricingRebuild.body).toMatchObject({
      snapshots: [
        expect.objectContaining({
          scenarioId: "balanced",
          rows: [expect.objectContaining({ playerName: "Puka Nacua", marketPrice: 60 })],
        }),
      ],
    });

    const conflictingPricingRebuild = await handle({
      method: "POST",
      path: `/seasons/${season.id}/pricing/rebuild`,
      sessionToken: cam.sessionToken,
      now: new Date(now.getTime() + 550),
      body: {
        modelVersion: "league-calibration-v1",
        scenarioIds: ["balanced"],
        baselinePrices: [
          { name: "Puka Nacua", normalizedName: "puka nacua", position: "WR", price: 50 },
        ],
      },
    });

    expect(conflictingPricingRebuild).toMatchObject({
      status: 201,
      body: {
        modelRunId,
        snapshots: [expect.objectContaining({
          modelRunId,
          scenarioId: "balanced",
          createdAt: new Date(now.getTime() + 500).toISOString(),
        })],
      },
    });

    const listedPricing = await handle({
      method: "GET",
      path: `/seasons/${season.id}/pricing-snapshots?scenarioId=balanced`,
      sessionToken: seth.sessionToken,
    });
    const fetchedPricing = await handle({
      method: "GET",
      path: `/pricing-snapshots/${encodeURIComponent(modelRunId)}?scenarioId=balanced`,
      sessionToken: seth.sessionToken,
    });

    expect(listedPricing.body).toMatchObject({
      pricingSnapshots: [expect.objectContaining({ modelRunId })],
    });
    expect(fetchedPricing.body).toMatchObject({
      pricingSnapshot: expect.objectContaining({ modelRunId, scenarioId: "balanced" }),
    });

    const createdSimulation = await handle({
      method: "POST",
      path: "/simulations",
      sessionToken: cam.sessionToken,
      body: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
        count: 25,
        seedPrefix: "cam-puka-plan",
        idempotencyKey: "cam-puka-plan",
        strategy: {
          hardLocks: [
            { playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" },
          ],
        },
        now,
      },
    });
    const simulation = expectBodyRecord(createdSimulation.body).simulation;
    if (!isRecord(simulation)) throw new Error("Expected simulation response.");
    const simulationId = expectString(simulation.id);

    expect(createdSimulation.status).toBe(201);

    const enqueuedSimulationJob = await handle({
      method: "POST",
      path: `/simulations/${simulationId}/jobs`,
      sessionToken: cam.sessionToken,
      body: {
        idempotencyKey: "job:cam-puka-plan",
        now: new Date(now.getTime() + 750).toISOString(),
      },
    });

    expect(enqueuedSimulationJob.status).toBe(202);
    expect(enqueuedSimulationJob.body).toMatchObject({
      job: expect.objectContaining({
        kind: "simulation",
        status: "queued",
      }),
    });

    const listedJobs = await handle({
      method: "GET",
      path: "/jobs",
      sessionToken: cam.sessionToken,
    });

    expect(listedJobs.body).toMatchObject({
      jobs: [expect.objectContaining({ kind: "simulation" })],
    });
    const enqueuedJob = expectBodyRecord(enqueuedSimulationJob.body).job;
    if (!isRecord(enqueuedJob)) throw new Error("Expected job response.");
    const enqueuedJobId = expectString(enqueuedJob.id);

    const canceledJob = await handle({
      method: "POST",
      path: `/jobs/${enqueuedJobId}/cancel`,
      sessionToken: cam.sessionToken,
      body: {
        now: new Date(now.getTime() + 900).toISOString(),
      },
    });

    expect(canceledJob).toMatchObject({
      status: 200,
      body: {
        job: expect.objectContaining({
          id: enqueuedJobId,
          status: "canceled",
        }),
      },
    });
    const fetchedCanceledSimulation = await handle({
      method: "GET",
      path: `/simulations/${simulationId}`,
      sessionToken: cam.sessionToken,
    });

    expect(fetchedCanceledSimulation.body).toMatchObject({
      simulation: expect.objectContaining({
        id: simulationId,
        status: "canceled",
        result: undefined,
      }),
    });

    const rerunJob = await handle({
      method: "POST",
      path: `/jobs/${enqueuedJobId}/rerun`,
      sessionToken: cam.sessionToken,
      body: {
        idempotencyKey: "rerun-cam-puka-plan",
        now: new Date(now.getTime() + 950).toISOString(),
      },
    });
    const rerunJobBody = expectBodyRecord(rerunJob.body);
    const rerunJobRecord = expectBodyRecord(rerunJobBody.job);
    const rerunJobId = expectString(rerunJobRecord.id);

    expect(rerunJob).toMatchObject({
      status: 202,
      body: {
        job: expect.objectContaining({
          id: rerunJobId,
          status: "queued",
          idempotencyKey: `rerun:${enqueuedJobId}:rerun-cam-puka-plan`,
        }),
      },
    });
    expect(rerunJobId).not.toBe(enqueuedJobId);

    const listedSimulations = await handle({
      method: "GET",
      path: "/simulations",
      sessionToken: cam.sessionToken,
    });

    expect(listedSimulations.body).toMatchObject({
      simulations: [
        expect.objectContaining({ id: simulationId, status: "requested" }),
      ],
    });

    const fetchedSimulation = await handle({
      method: "GET",
      path: `/simulations/${simulationId}`,
      sessionToken: cam.sessionToken,
    });

    expect(fetchedSimulation.body).toMatchObject({
      simulation: expect.objectContaining({ id: simulationId, status: "requested" }),
    });

    const executedSimulation = await handle({
      method: "POST",
      path: `/simulations/${simulationId}/execute`,
      sessionToken: cam.sessionToken,
      body: {
        now: new Date(now.getTime() + 1_000).toISOString(),
      },
    });

    expect(executedSimulation.body).toMatchObject({
      simulation: expect.objectContaining({
        id: simulationId,
        status: "completed",
        result: expect.objectContaining({ runCount: 25 }),
      }),
    });

    const sethSimulation = await handle({
      method: "POST",
      path: "/simulations",
      sessionToken: seth.sessionToken,
      body: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: sethTeam.ownerId,
        teamId: sethTeam.id,
        count: 5,
        seedPrefix: "seth-private-run",
        idempotencyKey: "seth-private-run",
        strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
        now: new Date(now.getTime() + 1_100),
      },
    });
    const sethSimulationBody = expectBodyRecord(sethSimulation.body);
    const sethSimulationRecord = expectBodyRecord(sethSimulationBody.simulation);
    const sethSimulationId = expectString(sethSimulationRecord.id);

    const createdMockSession = await handle({
      method: "POST",
      path: "/mock-sessions",
      sessionToken: cam.sessionToken,
      body: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
        draftMode: { format: "auction", mockCount: 5, label: "Practice auction" },
        now,
      },
    });
    const mockSession = expectBodyRecord(createdMockSession.body).mockSession;
    if (!isRecord(mockSession)) throw new Error("Expected mock session response.");
    const mockSessionId = expectString(mockSession.id);

    expect(createdMockSession.status).toBe(201);

    const leakedResultReference = await handle({
      method: "POST",
      path: `/mock-sessions/${mockSessionId}/commands`,
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 1,
        expectedCommandCount: 0,
        commandId: "cmd_leak",
        command: "show seth result",
        idempotencyKey: "mock:leak",
        latestResultRef: { kind: "simulation-result", id: sethSimulationId },
        now: new Date(now.getTime() + 1_500).toISOString(),
      },
    });

    expect(leakedResultReference).toEqual({
      status: 403,
      body: {
        error: {
          code: "private_resource",
          message: "This prep artifact belongs to another user.",
        },
      },
    });

    const listedMockSessions = await handle({
      method: "GET",
      path: "/mock-sessions",
      sessionToken: cam.sessionToken,
      query: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: camTeam.ownerId,
      },
    });

    expect(listedMockSessions.body).toMatchObject({
      mockSessions: [expect.objectContaining({
        id: mockSessionId,
        commandLog: [],
        latestResultRef: undefined,
      })],
    });

    const appendedMockSession = await handle({
      method: "POST",
      path: `/mock-sessions/${mockSessionId}/commands`,
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 1,
        expectedCommandCount: 0,
        commandId: "cmd_puka",
        command: "draft puka for 62",
        idempotencyKey: "mock:puka:62",
        now: new Date(now.getTime() + 2_000).toISOString(),
      },
    });

    expect(appendedMockSession.body).toMatchObject({
      mockSession: expect.objectContaining({
        id: mockSessionId,
        commandLog: [expect.objectContaining({ id: "cmd_puka" })],
      }),
    });

    const resetMockSession = await handle({
      method: "POST",
      path: `/mock-sessions/${mockSessionId}/reset`,
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 1,
        now: new Date(now.getTime() + 3_000),
      },
    });

    expect(resetMockSession.body).toMatchObject({
      mockSession: expect.objectContaining({
        id: mockSessionId,
        revision: 2,
        commandLog: [],
      }),
    });

    const staleMockReset = await handle({
      method: "POST",
      path: `/mock-sessions/${mockSessionId}/reset`,
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 1,
      },
    });

    expect(staleMockReset).toEqual({
      status: 409,
      body: {
        error: {
          code: "stale_revision",
          message: "Mock draft session changed since this action was prepared. Refresh and try again.",
        },
      },
    });

    await expect(handle({
      method: "POST",
      path: "/live-rooms",
      sessionToken: cam.sessionToken,
      body: {},
    })).resolves.toMatchObject({ status: 404 });

    const createdRoom = await handle({
      method: "POST",
      path: "/live-rooms",
      sessionToken: cam.sessionToken,
      headers: { "x-mockd-provisioning-token": "test-provisioning-token" },
      body: {
        seasonId: season.id,
        roomId: "room_214674_2026",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog,
        initialRosters: [
          { teamId: camTeam.id, playerName: "De'Von Achane", position: "RB", price: 50, expectedPrice: 50 },
        ],
        now,
      },
    });

    expect(createdRoom.status).toBe(201);
    expect(createdRoom.body).toMatchObject({
      room: expect.objectContaining({
        roomId: "room_214674_2026",
        status: "setup",
        role: "commissioner",
        canMutateRoom: true,
      }),
    });
    expectPublicBrowserPayload(createdRoom.body);

    const fetchedRoom = await handle({
      method: "GET",
      path: "/live-rooms/room_214674_2026",
      sessionToken: seth.sessionToken,
    });

    expect(fetchedRoom.body).toMatchObject({
      room: expect.objectContaining({
        roomId: "room_214674_2026",
        role: "member",
        canMutateRoom: false,
      }),
    });
    expectPublicBrowserPayload(fetchedRoom.body);

    const initialEvents = await handle({
      method: "GET",
      path: "/live-rooms/room_214674_2026/events?afterRevision=0",
      sessionToken: seth.sessionToken,
    });
    expect(initialEvents.body).toMatchObject({
      events: {
        events: [expect.objectContaining({ event: "room.snapshot" })],
      },
    });
    expectPublicBrowserPayload(initialEvents.body);

    const startedRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/start",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 1,
        idempotencyKey: "start-room",
        now: new Date(now.getTime() + 4_000),
      },
    });

    expect(startedRoom.body).toMatchObject({
      room: expect.objectContaining({ status: "live", revision: 2 }),
    });
    expectPublicBrowserPayload(startedRoom.body);

    const pausedRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/pause",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 2,
        idempotencyKey: "pause-room",
        now: new Date(now.getTime() + 4_050),
      },
    });
    expect(pausedRoom.body).toMatchObject({
      room: expect.objectContaining({ status: "paused", revision: 3 }),
    });
    expectPublicBrowserPayload(pausedRoom.body);

    const saleWhilePaused = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/sales",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 3,
        idempotencyKey: "sale:while-paused",
        command: "cam puka 62",
      },
    });
    expect(saleWhilePaused).toMatchObject({
      status: 409,
      body: { error: { code: "room_paused" } },
    });

    const resumedRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/resume",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 3,
        idempotencyKey: "resume-room",
        now: new Date(now.getTime() + 4_075),
      },
    });
    expect(resumedRoom.body).toMatchObject({
      room: expect.objectContaining({ status: "live", revision: 4 }),
    });
    expectPublicBrowserPayload(resumedRoom.body);

    const memberRoomState = await handle({
      method: "GET",
      path: `/live-rooms/room_214674_2026/state?selectedTeamId=${encodeURIComponent(sethTeam.id)}`,
      sessionToken: seth.sessionToken,
    });
    expect(memberRoomState.body).toMatchObject({
      state: expect.objectContaining({
        role: "member",
        canMutateRoom: false,
        selectedTeam: expect.objectContaining({ teamId: sethTeam.id }),
      }),
    });
    expectPublicBrowserPayload(memberRoomState.body);

    const mismatchedStructuredSale = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/sales",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 4,
        idempotencyKey: "sale:mismatched-team-owner",
        structuredSale: {
          teamId: camTeam.id,
          ownerId: sethTeam.ownerId,
          playerName: "Puka Nacua",
          price: 1,
        },
        now: new Date(now.getTime() + 4_100),
      },
    });

    expect(mismatchedStructuredSale).toEqual({
      status: 400,
      body: {
        error: {
          code: "team_not_found",
          message: `Sale team does not match owner "${sethTeam.ownerId}".`,
        },
      },
    });

    const missingSaleRevision = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/sales",
      sessionToken: cam.sessionToken,
      body: {
        idempotencyKey: "sale:puka:missing-revision",
        command: "cam puka 62",
        now: new Date(now.getTime() + 4_500),
      },
    });

    expect(missingSaleRevision).toEqual({
      status: 400,
      body: {
        error: {
          code: "expected_revision_required",
          message: "Draft room mutation requires the current revision.",
        },
      },
    });

    const missingSaleIdempotencyKey = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/sales",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 4,
        command: "cam puka 62",
        now: new Date(now.getTime() + 4_600),
      },
    });

    expect(missingSaleIdempotencyKey).toEqual({
      status: 400,
      body: {
        error: {
          code: "idempotency_key_required",
          message: "Draft room mutation requires an idempotency key.",
        },
      },
    });

    const soldRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/sales",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 4,
        idempotencyKey: "sale:puka:62",
        command: "cam puka 62",
        now: new Date(now.getTime() + 5_000),
      },
    });

    expect(soldRoom.body).toMatchObject({
      room: expect.objectContaining({
        revision: 5,
        salesLog: [expect.objectContaining({ playerName: "Puka Nacua", price: 62 })],
      }),
    });
    expectPublicBrowserPayload(soldRoom.body);

    const retriedSoldRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/sales",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 4,
        idempotencyKey: "sale:puka:62",
        command: "cam puka 62",
        now: new Date(now.getTime() + 5_500),
      },
    });

    expect(retriedSoldRoom.body).toMatchObject({
      room: expect.objectContaining({
        revision: 5,
        salesLog: [expect.objectContaining({ playerName: "Puka Nacua", price: 62 })],
      }),
    });
    expectPublicBrowserPayload(retriedSoldRoom.body);

    const saleEvents = await handle({
      method: "GET",
      path: "/live-rooms/room_214674_2026/events?afterRevision=4",
      sessionToken: seth.sessionToken,
    });

    expect(saleEvents.body).toMatchObject({
      events: {
        currentRevision: 5,
        isStale: true,
        requiresSnapshot: false,
        events: [
          expect.objectContaining({
            event: "room.sale",
            revision: 5,
            data: expect.objectContaining({
              sale: expect.objectContaining({ playerName: "Puka Nacua", price: 62 }),
            }),
          }),
        ],
      },
    });
    expectPublicBrowserPayload(saleEvents.body);

    const saleEventStream = await handle({
      method: "GET",
      path: "/live-rooms/room_214674_2026/event-stream?afterRevision=4",
      sessionToken: seth.sessionToken,
    });

    expect(saleEventStream.status).toBe(200);
    expect(saleEventStream.headers).toMatchObject({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    });
    expect(saleEventStream.body).toContain("id: room_214674_2026:5\n");
    expect(saleEventStream.body).toContain("event: room.sale\n");
    expect(saleEventStream.body).toContain("\"playerName\":\"Puka Nacua\"");
    for (const payload of expectString(saleEventStream.body)
      .split("\n")
      .filter(line => line.startsWith("data: "))
      .map(line => JSON.parse(line.slice("data: ".length)))) {
      expectPublicBrowserPayload(payload);
    }

    const undoneRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/undo",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 5,
        idempotencyKey: "undo:puka:62",
        now: new Date(now.getTime() + 6_000),
      },
    });

    expect(undoneRoom.body).toMatchObject({
      room: expect.objectContaining({
        revision: 6,
        salesLog: [],
      }),
    });
    expectPublicBrowserPayload(undoneRoom.body);

    const resoldRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/sales",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 6,
        idempotencyKey: "sale:puka:62:after-undo",
        sale: "cam puka 62",
        now: new Date(now.getTime() + 7_000),
      },
    });

    const resoldSale = (resoldRoom.body as {
      room: { salesLog: Array<{ saleEventId: string }> };
    }).room.salesLog[0];
    if (resoldSale === undefined) throw new Error("Expected the replacement sale fixture.");
    expectPublicBrowserPayload(resoldRoom.body);

    const correctedRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/corrections",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 7,
        idempotencyKey: "correct:puka:seth:41",
        saleEventId: resoldSale.saleEventId,
        replacementSale: "seth puka 41",
        now: new Date(now.getTime() + 7_250),
      },
    });
    expect(correctedRoom.body).toMatchObject({
      room: expect.objectContaining({
        revision: 8,
        salesLog: [expect.objectContaining({ ownerDisplayName: "Seth", price: 41 })],
      }),
    });
    expectPublicBrowserPayload(correctedRoom.body);

    const undoneCorrection = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/undo",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 8,
        idempotencyKey: "undo:correction:puka",
        now: new Date(now.getTime() + 7_400),
      },
    });
    expect(undoneCorrection.body).toMatchObject({
      room: expect.objectContaining({
        revision: 9,
        salesLog: [expect.objectContaining({ ownerDisplayName: "Cam", price: 62 })],
      }),
    });
    expectPublicBrowserPayload(undoneCorrection.body);

    const memberExportArtifact = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/export-artifacts",
      sessionToken: seth.sessionToken,
      body: {
        exportedAt: new Date(now.getTime() + 7_500).toISOString(),
      },
    });

    expect(memberExportArtifact).toEqual({
      status: 403,
      body: {
        error: {
          code: "shared_mutation_denied",
          message: "Only league owners and admins can change shared draft data.",
        },
      },
    });

    const earlyExportArtifact = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/export-artifacts",
      sessionToken: cam.sessionToken,
      body: {
        exportedAt: new Date(now.getTime() + 7_500).toISOString(),
      },
    });

    expect(earlyExportArtifact).toEqual({
      status: 409,
      body: {
        error: {
          code: "draft_room_not_final",
          message: "Draft room must be ended before creating a final export artifact.",
        },
      },
    });

    const endedRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/end",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 9,
        idempotencyKey: "end-room",
        allowIncomplete: true,
        now: new Date(now.getTime() + 8_000),
      },
    });

    expect(endedRoom.body).toMatchObject({
      room: expect.objectContaining({ status: "ended", revision: 10 }),
    });
    expectPublicBrowserPayload(endedRoom.body);

    const myTeam = await handle({
      method: "GET",
      path: "/live-rooms/room_214674_2026/my-team",
      sessionToken: cam.sessionToken,
      now: new Date(now.getTime() + 8_500),
    });
    expect(myTeam).toMatchObject({
      status: 200,
      body: {
        roster: {
          teamId: camTeam.id,
          players: expect.arrayContaining([expect.objectContaining({ playerName: "De'Von Achane" })]),
        },
        analysis: {
          ownership: { userId: cam.account.id, teamId: camTeam.id },
          ranking: {
            status: "unavailable",
            teamCount: season.teams.length,
            reasons: [expect.objectContaining({ code: "roster_materially_incomplete" })],
          },
          strengths: [],
        },
      },
    });

    const exportedRoom = await handle({
      method: "GET",
      path: "/live-rooms/room_214674_2026/export?exportedAt=2026-08-09T12%3A00%3A09.000Z",
      sessionToken: seth.sessionToken,
    });

    expect(exportedRoom.body).toMatchObject({
      draftExport: expect.objectContaining({
        sheetName: "Draft Results",
        csv: expect.stringContaining("Puka Nacua,62"),
      }),
    });

    const exportArtifact = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/export-artifacts",
      sessionToken: cam.sessionToken,
      body: {
        exportedAt: "2026-08-09T12:00:10.000Z",
      },
    });
    expect(exportArtifact).toEqual({
      status: 409,
      body: {
        error: {
          code: "draft_room_not_final",
          message: "Final export requires every team to fill every roster slot.",
        },
      },
    });

    const reopenedRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/reopen",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 10,
        idempotencyKey: "reopen-room",
        now: new Date(now.getTime() + 11_000),
      },
    });
    expect(reopenedRoom.body).toMatchObject({
      room: expect.objectContaining({ status: "paused", revision: 11 }),
    });
    expectPublicBrowserPayload(reopenedRoom.body);
  });

  it("maps known domain errors and unexpected failures without leaking stack traces", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);

    const unauthenticated = await handle({
      method: "GET",
      path: "/seasons/missing-season",
    });

    expect(JSON.stringify(unauthenticated.body)).not.toContain("stack");
    expect(unauthenticated).toEqual({
      status: 401,
      body: {
        error: {
          code: "auth_required",
          message: "Sign in before using this workspace.",
        },
      },
    });

    const unknownFailureApp: Pick<PlatformApp, "createAccount"> = {
      createAccount: () => {
        throw new Error("database stack trace with secrets");
      },
    };
    const failingHandle = createPlatformHttpHandler({
      ...app,
      createAccount: unknownFailureApp.createAccount,
    });

    const failure = await failingHandle({
      method: "POST",
      path: "/accounts",
      body: {
        email: "fail@example.com",
        password: "secure password",
      },
    });

    expect(JSON.stringify(failure.body)).not.toContain("database stack trace with secrets");
    expect(JSON.stringify(failure.body)).not.toContain("stack");
    expect(failure).toEqual({
      status: 500,
      body: {
        error: {
          code: "internal_error",
          message: "Something went wrong.",
        },
      },
    });
  });
});
