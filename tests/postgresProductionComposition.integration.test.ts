import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CapturingAuthMailSender } from "../src/platform/auth.js";
import {
  createNodePostgresClient,
  type NodePostgresClient,
} from "../src/platform/postgresClient.js";
import { applyPlatformPostgresMigrations } from "../src/platform/platformMigrations.js";
import {
  startPlatformWebFromEnv,
  type StartedPlatformWebProcess,
} from "../src/platform/startPlatformWeb.js";

const databaseUrl = process.env.MOCKD_POSTGRES_INTEGRATION_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl === undefined || databaseUrl.length === 0
  ? describe.skip
  : describe;

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

const jsonRequest = async (
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; setCookie: string | null; body: unknown }> => {
  const response = await fetch(`${baseUrl}${path}`, init);

  return {
    status: response.status,
    setCookie: response.headers.get("set-cookie"),
    body: await response.json(),
  };
};

const postJson = (
  baseUrl: string,
  path: string,
  body: unknown,
  sessionCookie?: string,
): Promise<{ status: number; setCookie: string | null; body: unknown }> =>
  jsonRequest(baseUrl, path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionCookie === undefined ? {} : { cookie: sessionCookie }),
    },
    body: JSON.stringify(body),
  });

const recordValue = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object.`);
  }

  return value as Record<string, unknown>;
};

const arrayValue = (value: unknown, label: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new Error(`Expected ${label} to be an array.`);

  return value;
};

const stringValue = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Expected ${label} to be a non-empty string.`);
  }

  return value;
};

const sessionCookieFor = (setCookie: string | null): string => {
  const cookie = setCookie?.split(";", 1)[0];
  if (cookie === undefined || !cookie.startsWith("mockd_session=")) {
    throw new Error("Expected a Mockd session cookie.");
  }

  return cookie;
};

describeWithPostgres("production Postgres composition", () => {
  let adminClient: NodePostgresClient;
  let runtime: StartedPlatformWebProcess | undefined;
  let schemaName: string;
  let draftToolsDirectory: string;
  let isolatedDatabaseUrl: string;

  beforeAll(async () => {
    if (databaseUrl === undefined || databaseUrl.length === 0) {
      throw new Error("MOCKD_POSTGRES_INTEGRATION_DATABASE_URL is required.");
    }

    schemaName = `mockd_production_smoke_${randomUUID().replaceAll("-", "")}`;
    adminClient = createNodePostgresClient({ databaseUrl, max: 1 });
    await adminClient.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);

    const isolatedUrl = new URL(databaseUrl);
    isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
    isolatedDatabaseUrl = isolatedUrl.toString();
    const migrationClient = createNodePostgresClient({ databaseUrl: isolatedDatabaseUrl, max: 1 });
    try {
      await applyPlatformPostgresMigrations(migrationClient);
    } finally {
      await migrationClient.close();
    }
    draftToolsDirectory = await mkdtemp(join(tmpdir(), "mockd-production-smoke-"));
  }, 30_000);

  afterAll(async () => {
    await runtime?.close();
    await rm(draftToolsDirectory, { force: true, recursive: true });
    if (adminClient !== undefined && schemaName !== undefined) {
      await adminClient.query(`DROP SCHEMA ${quoteIdentifier(schemaName)} CASCADE`);
    }
    await adminClient?.close();
  });

  it("persists signup, league setup, a keeper, and a hosted auction sale across restart", async () => {
    const mailSender = new CapturingAuthMailSender();
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      DATABASE_URL: isolatedDatabaseUrl,
      HOST: "127.0.0.1",
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: draftToolsDirectory,
      MOCKD_LIVE_DRAFT_DATA_MODE: "postgres",
      MOCKD_ALLOW_PUBLIC_SIGNUP: "true",
      MOCKD_AUTH_EMAIL_MODE: "resend",
      RESEND_API_KEY: "production-smoke-not-used",
      MOCKD_EMAIL_FROM: "accounts@mockd.example.com",
      MOCKD_PUBLIC_BASE_URL: "https://mockd.example.com",
      MOCKD_INVITATION_TOKEN_SECRET: "production-smoke-invitation-secret-at-least-32-characters",
      MOCKD_INITIALIZE_POSTGRES_SCHEMA: "false",
      MOCKD_SCREENSHOT_IMPORT_MODE: "disabled",
    };

    runtime = await startPlatformWebFromEnv(env, { authMailSender: mailSender });
    const baseUrl = runtime.server.url;
    const signup = await postJson(baseUrl, "/accounts", {
      email: "commissioner@example.com",
      password: "secure password",
    });
    expect(signup).toMatchObject({ status: 202, body: { accepted: true } });

    const verificationUrl = mailSender.messages[0]?.actionUrl;
    const verificationToken = verificationUrl === undefined
      ? ""
      : new URL(verificationUrl).searchParams.get("token") ?? "";
    expect(verificationToken).not.toBe("");
    await expect(postJson(baseUrl, "/email-verifications/consume", {
      token: verificationToken,
      newPassword: "mailbox proven password",
      newPasswordConfirmation: "mailbox proven password",
    })).resolves.toMatchObject({ status: 200, body: { verified: true } });

    const login = await postJson(baseUrl, "/sessions", {
      email: "commissioner@example.com",
      password: "mailbox proven password",
    });
    expect(login.status).toBe(200);
    const cookie = sessionCookieFor(login.setCookie);

    const leagueCreated = await postJson(baseUrl, "/leagues", {
      setup: {
        provider: "mockd",
        externalLeagueId: "production-smoke-2026",
        leagueName: "Production Smoke League",
        seasonYear: 2026,
        expectedTeamCount: 4,
        teams: [
          { externalTeamId: "owner11", displayName: "Owner11's Team", managerNames: ["Owner11"] },
          { externalTeamId: "owner04", displayName: "Owner04's Team", managerNames: ["Owner04"] },
          { externalTeamId: "alex", displayName: "Alex's Team", managerNames: ["Alex"] },
          { externalTeamId: "blair", displayName: "Blair's Team", managerNames: ["Blair"] },
        ],
        draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
        scoring: {
          passingYards: 0.04,
          passingTouchdown: 4,
          rushingYards: 0.1,
          rushingTouchdown: 6,
          receivingYards: 0.1,
          receivingTouchdown: 6,
          reception: 0.5,
        },
        rosterSlots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, DST: 1, K: 1, BENCH: 1 },
      },
    }, cookie);
    expect(
      leagueCreated.status,
      `League creation returned HTTP ${leagueCreated.status}: ${JSON.stringify(leagueCreated.body)}`,
    ).toBe(201);
    const season = recordValue(recordValue(leagueCreated.body, "league response").season, "season");
    const seasonId = stringValue(season.id, "season id");
    const teams = arrayValue(season.teams, "season teams").map((team, index) =>
      recordValue(team, `team ${index + 1}`)
    );
    const camTeam = teams.find(team => team.displayName === "Owner11's Team");
    if (camTeam === undefined) throw new Error("Expected the commissioner team.");
    const camTeamId = stringValue(camTeam.id, "commissioner team id");
    const camOwnerId = stringValue(camTeam.ownerId, "commissioner owner id");

    await expect(postJson(baseUrl, `/seasons/${seasonId}/team-claims`, {
      ownerId: camOwnerId,
      teamId: camTeamId,
    }, cookie)).resolves.toMatchObject({
      status: 200,
      body: { membership: { teamId: camTeamId, ownerId: camOwnerId, role: "owner" } },
    });

    const keeperSaved = await postJson(baseUrl, `/seasons/${seasonId}/keepers/apply`, {
      command: "Owner11 keeping De'Von Achane 50",
      confirmed: true,
    }, cookie);
    expect(keeperSaved).toMatchObject({
      status: 200,
      body: {
        keepers: [expect.objectContaining({
          teamId: camTeamId,
          playerName: "De'Von Achane",
          price: 50,
        })],
      },
    });

    await expect(postJson(baseUrl, `/seasons/${seasonId}/publish`, {
      confirmed: true,
    }, cookie)).resolves.toMatchObject({ status: 200, body: { season: { setupStatus: "published" } } });

    const roomCreated = await postJson(baseUrl, `/seasons/${seasonId}/live-room`, {}, cookie);
    expect(roomCreated).toMatchObject({
      status: 201,
      body: { room: { roomId: `room-${seasonId}-real`, revision: 1, status: "setup" } },
    });
    const roomId = `room-${seasonId}-real`;
    await expect(postJson(baseUrl, `/live-rooms/${roomId}/start`, {
      expectedRevision: 1,
      idempotencyKey: "production-smoke:start",
    }, cookie)).resolves.toMatchObject({ status: 200, body: { room: { revision: 2, status: "live" } } });

    await expect(postJson(baseUrl, `/live-rooms/${roomId}/sales`, {
      expectedRevision: 2,
      idempotencyKey: "production-smoke:puka:62",
      sale: "Owner11 Puka 62",
    }, cookie)).resolves.toMatchObject({
      status: 200,
      body: {
        room: {
          revision: 3,
          status: "live",
          salesLog: [expect.objectContaining({
            teamId: camTeamId,
            playerName: "Puka Nacua",
            price: 62,
          })],
        },
      },
    });

    await runtime.close();
    runtime = undefined;
    runtime = await startPlatformWebFromEnv(env, { authMailSender: mailSender });
    const restartedBaseUrl = runtime.server.url;
    const restartedLogin = await postJson(restartedBaseUrl, "/sessions", {
      email: "commissioner@example.com",
      password: "secure password",
    });
    expect(restartedLogin).toMatchObject({
      status: 200,
      body: { account: { email: "commissioner@example.com" } },
    });
    const restartedCookie = sessionCookieFor(restartedLogin.setCookie);
    const restartedHeaders = { cookie: restartedCookie };

    await expect(jsonRequest(restartedBaseUrl, "/onboarding", {
      headers: restartedHeaders,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        leagues: [expect.objectContaining({
          seasonId,
          membership: expect.objectContaining({
            role: "owner",
            ownerId: camOwnerId,
            teamId: camTeamId,
            teamDisplayName: "Owner11's Team",
          }),
          readiness: { leagueSetup: "ready", teamClaim: "ready", liveDraft: "ready" },
          liveDraft: { roomId, status: "live" },
        })],
      },
    });
    await expect(jsonRequest(restartedBaseUrl, `/seasons/${seasonId}/keepers`, {
      headers: restartedHeaders,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        keepers: [expect.objectContaining({
          teamId: camTeamId,
          playerName: "De'Von Achane",
          price: 50,
        })],
      },
    });
    await expect(jsonRequest(restartedBaseUrl, `/live-rooms/${roomId}`, {
      headers: restartedHeaders,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        room: {
          revision: 3,
          status: "live",
          salesLog: [expect.objectContaining({
            teamId: camTeamId,
            playerName: "Puka Nacua",
            price: 62,
          })],
          teamSummaries: expect.arrayContaining([expect.objectContaining({
            teamId: camTeamId,
            budgetRemaining: 88,
            roster: expect.arrayContaining([
              expect.objectContaining({ name: "De'Von Achane", price: 50, source: "keeper" }),
              expect.objectContaining({ name: "Puka Nacua", price: 62, source: "sale" }),
            ]),
          })]),
        },
      },
    });
  }, 60_000);
});
