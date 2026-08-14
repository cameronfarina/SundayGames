import { beforeEach, describe, expect, it, vi } from "vitest";
import { leagueConfig } from "../config/league.js";
import type { MockBatch } from "../src/modeling/mockBatch.js";
import type { LeagueMembersScreenshotAnalyzer } from "../src/platform/openAiLeagueMembersScreenshotAnalyzer.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import { createPlatformApp, InMemoryPlatformStore } from "../src/platform/platformApp.js";
import { createPlatformHttpHandler } from "../src/platform/platformHttp.js";
import type { SimulationMockBatchRunner } from "../src/platform/simulations.js";

const now = new Date("2026-08-09T12:00:00.000Z");

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

const setup = async () => {
  const app = createPlatformApp({
    store: new InMemoryPlatformStore(),
    simulationRunner: mockRunner,
  });
  const owner = await app.createAccount({
    email: "owner@example.com",
    password: "owner password secure",
    now,
  });
  const member = await app.createAccount({
    email: "member@example.com",
    password: "member password secure",
    now,
  });
  const ownerLogin = await app.login({
    email: owner.email,
    password: "owner password secure",
    now,
  });
  const memberLogin = await app.login({
    email: member.email,
    password: "member password secure",
    now,
  });
  if (ownerLogin === null || memberLogin === null) {
    throw new Error("Expected fixture logins.");
  }
  const season = buildCurrentMockdLeagueSeason(["Owner", "Member"], {
    ...leagueConfig,
    teams: 2,
  }, { leagueName: "Contract League", setupStatus: "published" });
  await app.registerLeagueSeason({
    actorSessionToken: ownerLogin.sessionToken,
    season,
    memberships: [
      { userId: owner.id, leagueId: season.leagueId, role: "owner" },
      { userId: member.id, leagueId: season.leagueId, role: "member" },
    ],
    now,
  });
  return { app, memberLogin, ownerLogin, season };
};

describe("platform setup HTTP contracts", () => {
  let fixture: Awaited<ReturnType<typeof setup>>;
  let analyzer: LeagueMembersScreenshotAnalyzer;

  beforeEach(async () => {
    fixture = await setup();
    analyzer = { analyze: vi.fn(async () => ({
      leagueName: null,
      externalLeagueId: null,
      teams: [],
    })) };
  });

  it("rejects an unauthenticated screenshot request", async () => {
    const response = await createPlatformHttpHandler(fixture.app, {
      leagueMembersScreenshotAnalyzer: analyzer,
    })({
      method: "POST",
      path: `/seasons/${fixture.season.id}/setup-import/screenshot-analyze`,
      body: { mimeType: "image/png", base64: "image" },
      now,
    });

    expect(response).toEqual({
      status: 401,
      body: { error: { code: "auth_required", message: "Sign in before using this workspace." } },
    });
  });

  it("rejects a non-manager before screenshot analysis", async () => {
    const response = await createPlatformHttpHandler(fixture.app, {
      leagueMembersScreenshotAnalyzer: analyzer,
    })({
      method: "POST",
      path: `/seasons/${fixture.season.id}/setup-import/screenshot-analyze`,
      sessionToken: fixture.memberLogin.sessionToken,
      body: { mimeType: "image/png", base64: "image" },
      now,
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: "shared_mutation_denied",
        message: "Only league owners and admins can manage league setup.",
      },
    });
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });

  it("returns a validation error for an unreviewed screenshot body", async () => {
    const response = await createPlatformHttpHandler(fixture.app)({
      method: "POST",
      path: `/seasons/${fixture.season.id}/setup-import/screenshot-apply`,
      sessionToken: fixture.ownerLogin.sessionToken,
      body: {},
      now,
    });

    expect(response).toEqual({
      status: 400,
      body: {
        error: {
          code: "screenshot_review_required",
          message: "Analyze the screenshot before applying league teams.",
        },
      },
    });
  });

  it("returns the stable not-found contract for an unknown setup action", async () => {
    const response = await createPlatformHttpHandler(fixture.app)({
      method: "POST",
      path: `/seasons/${fixture.season.id}/setup-import/unknown`,
      sessionToken: fixture.ownerLogin.sessionToken,
      body: {},
      now,
    });

    expect(response).toEqual({
      status: 404,
      body: { error: { code: "route_not_found", message: "Route was not found." } },
    });
  });

  it("previews a valid setup import without changing the season", async () => {
    const response = await createPlatformHttpHandler(fixture.app)({
      method: "POST",
      path: `/seasons/${fixture.season.id}/setup-import/preview`,
      sessionToken: fixture.ownerLogin.sessionToken,
      body: { rows: [
        "owner,team,email,role",
        "Owner,Owner Team,owner@example.com,owner",
        "Member,Member Team,member@example.com,member",
      ] },
      now,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      import: { status: "ready", records: [
        { ownerDisplayName: "Owner", teamDisplayName: "Owner Team" },
        { ownerDisplayName: "Member", teamDisplayName: "Member Team" },
      ] },
    });
    await expect(fixture.app.getLeagueSeason({
      actorSessionToken: fixture.ownerLogin.sessionToken,
      seasonId: fixture.season.id,
      now,
    })).resolves.toEqual(fixture.season);
  });
});
