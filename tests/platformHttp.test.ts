import { describe, expect, it, vi } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import type { MockBatch } from "../src/modeling/mockBatch.js";
import type { AccountRecord } from "../src/platform/auth.js";
import {
  createClientAddressRateLimiter,
  createNormalizedEmailRateLimiter,
} from "../src/platform/authRateLimit.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../src/platform/liveDraftRooms.js";
import {
  InMemoryPlatformInvitationRepository,
  hashPlatformInvitationToken,
  issuePlatformInvitation,
} from "../src/platform/platformInvitations.js";
import { createPlatformApp, InMemoryPlatformStore } from "../src/platform/platformApp.js";
import {
  createPlatformHttpHandler,
  type PlatformApp,
  type PlatformHttpHandler,
  type PlatformHttpRequest,
} from "../src/platform/platformHttp.js";
import type { SimulationMockBatchRunner } from "../src/platform/simulations.js";

const now = new Date("2026-08-09T12:00:00.000Z");

const playerCatalog = [
  { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
  { name: "Xavier Legette", position: "WR", expectedPrice: 2 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
  { name: "De'Von Achane", position: "RB", expectedPrice: 50 },
] as const satisfies readonly LiveDraftRoomPlayerCatalogEntry[];

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
    sessionToken: expectString(loginBody.sessionToken),
  };
};

describe("platform HTTP contract", () => {
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
      method: "POST",
      path: "/invitations/accept",
      sessionToken: seth.sessionToken,
      body: { token },
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
      sessionToken: expect.any(String),
    });
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
    const loginBody = expectBodyRecord(login.body);
    const sessionToken = expectString(loginBody.sessionToken);

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
    const loginBody = expectBodyRecord(login.body);
    const sessionToken = expectString(loginBody.sessionToken);

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
    const sessionToken = expectString(expectBodyRecord(login.body).sessionToken);
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
          startsAt: new Date(startsAt),
          playerCatalog: expect.arrayContaining([
            expect.objectContaining({ name: "Puka Nacua" }),
          ]),
        },
      },
    });
  });

  it("routes season, simulation, mock session, live room, and export calls through PlatformApp", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      allowPublicSignup: true,
      provisioningToken: "test-provisioning-token",
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
      path: `/seasons/${season.id}/historical-imports/preview`,
      sessionToken: cam.sessionToken,
      body: {
        sourceText: "owner,player,position,price,year,player id\nCam,Puka Nacua,WR,70,2026,player-puka",
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
        now: new Date(now.getTime() + 250).toISOString(),
      },
    });

    expect(committedImport.body).toMatchObject({
      committedRecords: [expect.objectContaining({ playerName: "Puka Nacua", priceDollars: 70 })],
    });

    const secondImportPreview = await handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/preview`,
      sessionToken: cam.sessionToken,
      body: {
        sourceText: "owner,player,position,price,year,player id\nCam,Jahmyr Gibbs,RB,72,2026,player-gibbs",
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

    expect(conflictingPricingRebuild).toEqual({
      status: 409,
      body: {
        error: {
          code: "pricing_snapshot_conflict",
          message: `Cannot overwrite pricing snapshot for modelRunId ${modelRunId} and scenarioId balanced with a different payload.`,
        },
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
      }),
    });

    const fetchedRoom = await handle({
      method: "GET",
      path: "/live-rooms/room_214674_2026",
      sessionToken: seth.sessionToken,
    });

    expect(fetchedRoom.body).toMatchObject({
      room: expect.objectContaining({ roomId: "room_214674_2026" }),
    });

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
        projection: expect.objectContaining({
          sales: [expect.objectContaining({ playerName: "Puka Nacua", price: 62 })],
        }),
      }),
    });

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
        projection: expect.objectContaining({
          sales: [expect.objectContaining({ playerName: "Puka Nacua", price: 62 })],
        }),
      }),
    });

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
        projection: expect.objectContaining({ sales: [] }),
      }),
    });

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
      room: { projection: { sales: Array<{ saleEventId: string }> } };
    }).room.projection.sales[0];
    if (resoldSale === undefined) throw new Error("Expected the replacement sale fixture.");

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
        projection: expect.objectContaining({
          sales: [expect.objectContaining({ ownerDisplayName: "Seth", price: 41 })],
        }),
      }),
    });

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
        projection: expect.objectContaining({
          sales: [expect.objectContaining({ ownerDisplayName: "Cam", price: 62 })],
        }),
      }),
    });

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
    const retriedExportArtifact = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/export-artifacts",
      sessionToken: cam.sessionToken,
    });

    expect(exportArtifact.status).toBe(201);
    expect(exportArtifact.body).toMatchObject({
      artifact: expect.objectContaining({
        roomId: "room_214674_2026",
        format: "csv",
        sourceRevision: 10,
      }),
      content: expect.stringContaining("Puka Nacua,62"),
    });
    expect(retriedExportArtifact).toEqual(exportArtifact);
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
