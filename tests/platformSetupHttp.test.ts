import { describe, expect, it } from "vitest";
import { leagueConfig } from "../config/league.js";
import type { MockBatch } from "../src/modeling/mockBatch.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import { createPlatformApp, InMemoryPlatformStore } from "../src/platform/platformApp.js";
import type {
  LeagueSetupRepository,
  RegisterLeagueSeasonRepositoryInput,
} from "../src/platform/leagueSetup.js";
import {
  applyLeagueSetupImport,
  previewLeagueSetupImport,
} from "../src/platform/platformSetupHttp.js";
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

const setupRegisteredSeason = async () => {
  const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
  await app.createAccount({ email: "cam@example.com", password: "cam password", now });
  await app.createAccount({ email: "seth@example.com", password: "seth password", now });
  const cam = await app.login({ email: "cam@example.com", password: "cam password", now });
  const seth = await app.login({ email: "seth@example.com", password: "seth password", now });
  if (cam === null || seth === null) throw new Error("Expected fixture logins.");

  const season = buildCurrentMockdLeagueSeason(["Cam", "Seth", "Beaton"], {
    ...leagueConfig,
    teams: 3,
  }, {
    leagueName: "Setup Import League",
    setupStatus: "published",
  });
  const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
  const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
  if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

  await app.registerLeagueSeason({
    actorSessionToken: cam.sessionToken,
    season,
    memberships: [
      { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      { userId: seth.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
    ],
    now,
  });

  return { app, cam, seth, season };
};

class AsyncLeagueSetupRepository implements LeagueSetupRepository {
  readonly inner = new InMemoryPlatformStore();

  async registerLeagueSeason(input: RegisterLeagueSeasonRepositoryInput) {
    return this.inner.registerLeagueSeason(input);
  }

  async claimLeagueSeasonTeam(input: Parameters<LeagueSetupRepository["claimLeagueSeasonTeam"]>[0]) {
    return this.inner.claimLeagueSeasonTeam(input);
  }

  async findLeagueSeason(seasonId: string) {
    return this.inner.findLeagueSeason(seasonId);
  }

  async hasLeagueSeasonForLeague(leagueId: string) {
    return this.inner.hasLeagueSeasonForLeague(leagueId);
  }

  async findLeagueSeasonForLeagueYear(leagueId: string, seasonYear: number) {
    return this.inner.findLeagueSeasonForLeagueYear(leagueId, seasonYear);
  }

  async findMembership(userId: string, leagueId: string) {
    return this.inner.findMembership(userId, leagueId);
  }

  async membershipsForLeague(leagueId: string) {
    return this.inner.membershipsForLeague(leagueId);
  }
}

describe("platform setup import HTTP helpers", () => {
  it("previews malformed rows and duplicate owners as blockers using the season team count", async () => {
    const { app, cam, season } = await setupRegisteredSeason();

    const response = await previewLeagueSetupImport(app, {
      actorSessionToken: cam.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Cam,Cam's Club,cam@example.com,owner",
        " cam ,Cam Two,cam-alt@example.com,member",
        "\"Broken,Broken Team,broken@example.com,member",
      ].join("\n"),
      now,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      import: {
        status: "blocked",
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: "duplicate_owner_name", rowNumber: 2 }),
          expect.objectContaining({ code: "duplicate_owner_name", rowNumber: 3 }),
          expect.objectContaining({ code: "malformed_row", rowNumber: 4 }),
        ]),
        rows: [
          expect.objectContaining({ rowNumber: 2, status: "blocked" }),
          expect.objectContaining({ rowNumber: 3, status: "blocked" }),
          expect.objectContaining({ rowNumber: 4, status: "blocked", record: null }),
        ],
        records: [],
      },
    });
  });

  it("returns a stable blocked-import error instead of applying duplicate owners", async () => {
    const { app, cam, season } = await setupRegisteredSeason();

    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: cam.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Cam,Cam's Club,cam@example.com,owner",
        "cam,Cam Two,cam-alt@example.com,member",
        "Beaton,Beaton's Team,beaton@example.com,member",
      ].join("\n"),
      now,
    });

    expect(response).toEqual({
      status: 400,
      body: {
        error: {
          code: "league_setup_import_blocked",
          message: "Resolve league setup import blockers before applying.",
        },
        import: expect.objectContaining({
          status: "blocked",
          records: [],
        }),
      },
    });
    expect(await app.getLeagueSeason({ actorSessionToken: cam.sessionToken, seasonId: season.id, now })).toEqual(season);
  });

  it("returns a stable blocked-import error instead of applying malformed rows", async () => {
    const { app, cam, season } = await setupRegisteredSeason();

    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: cam.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Cam,Cam's Club,cam@example.com,owner",
        "Seth,Seth's Champs,seth@example.com,member",
        "\"Beaton,Beaton's Team,beaton@example.com,admin",
      ].join("\n"),
      now,
    });

    expect(response).toEqual({
      status: 400,
      body: {
        error: {
          code: "league_setup_import_blocked",
          message: "Resolve league setup import blockers before applying.",
        },
        import: expect.objectContaining({
          status: "blocked",
          blockers: expect.arrayContaining([
            expect.objectContaining({ code: "malformed_row", rowNumber: 4 }),
          ]),
          records: [],
        }),
      },
    });
    expect(await app.getLeagueSeason({ actorSessionToken: cam.sessionToken, seasonId: season.id, now })).toEqual(season);
  });

  it("applies ready rows, keeps commissioner membership, maps known owner ids, and preserves invite emails", async () => {
    const { app, cam, seth, season } = await setupRegisteredSeason();

    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: cam.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Cam,Cam's Club,cam@example.com,owner",
        "Seth,Seth's Champs,seth@example.com,member",
        "Beaton,Beaton's Team,beaton@example.com,admin",
      ].join("\n"),
      knownUsers: [
        { email: "seth@example.com", accountId: seth.account.id },
      ],
      now,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      season: expect.objectContaining({
        id: season.id,
        teams: [
          expect.objectContaining({ ownerDisplayName: "Cam", displayName: "Cam's Club" }),
          expect.objectContaining({ ownerDisplayName: "Seth", displayName: "Seth's Champs" }),
          expect.objectContaining({ ownerDisplayName: "Beaton", displayName: "Beaton's Team" }),
        ],
      }),
      memberships: expect.arrayContaining([
        expect.objectContaining({
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          inviteEmail: "cam@example.com",
        }),
        expect.objectContaining({
          userId: seth.account.id,
          leagueId: season.leagueId,
          role: "member",
          inviteEmail: "seth@example.com",
        }),
      ]),
      pendingInvites: [
        expect.objectContaining({
          email: "beaton@example.com",
          role: "admin",
        }),
      ],
    });

    const updatedSeason = await app.getLeagueSeason({ actorSessionToken: seth.sessionToken, seasonId: season.id, now });
    expect(updatedSeason.teams.map(team => team.displayName)).toEqual([
      "Cam's Club",
      "Seth's Champs",
      "Beaton's Team",
    ]);
    expect(app.store.findMembership(cam.account.id, season.leagueId)).toMatchObject({
      userId: cam.account.id,
      role: "owner",
      inviteEmail: "cam@example.com",
    });
    expect(app.store.findMembership(seth.account.id, season.leagueId)).toMatchObject({
      userId: seth.account.id,
      role: "member",
      inviteEmail: "seth@example.com",
    });
  });

  it("matches registered accounts by import email and ignores mismatched client-provided account ids", async () => {
    const { app, cam, season } = await setupRegisteredSeason();
    await app.createAccount({ email: "beaton@example.com", password: "beaton password", now });
    await app.createAccount({ email: "outsider@example.com", password: "outsider password", now });
    const beaton = await app.login({ email: "beaton@example.com", password: "beaton password", now });
    const outsider = await app.login({ email: "outsider@example.com", password: "outsider password", now });
    if (beaton === null || outsider === null) throw new Error("Expected fixture logins.");

    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: cam.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Cam,Cam's Club,cam@example.com,owner",
        "Seth,Seth's Champs,seth@example.com,member",
        "Beaton,Beaton's Team,beaton@example.com,admin",
      ].join("\n"),
      knownUsers: [
        { email: "beaton@example.com", accountId: outsider.account.id },
      ],
      now,
    });

    expect(response.status).toBe(200);
    expect(app.store.findMembership(beaton.account.id, season.leagueId)).toMatchObject({
      userId: beaton.account.id,
      role: "admin",
      inviteEmail: "beaton@example.com",
    });
    expect(app.store.findMembership(outsider.account.id, season.leagueId)).toBeNull();
  });

  it("preserves already claimed member access when team setup is reapplied without known user rows", async () => {
    const { app, cam, seth, season } = await setupRegisteredSeason();

    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: cam.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Cam,Cam's Club,cam@example.com,owner",
        "Seth,Seth's Renamed Team,seth@example.com,member",
        "Beaton,Beaton's Team,beaton@example.com,admin",
      ].join("\n"),
      now,
    });

    expect(response.status).toBe(200);
    expect(app.store.findMembership(seth.account.id, season.leagueId)).toMatchObject({
      userId: seth.account.id,
      role: "member",
      inviteEmail: "seth@example.com",
      ownerId: expect.stringContaining("seth"),
      teamId: expect.stringContaining("seth"),
    });

    const sethView = await app.getLeagueSeason({ actorSessionToken: seth.sessionToken, seasonId: season.id, now });
    expect(sethView.teams.find(team => team.ownerDisplayName === "Seth")).toMatchObject({
      displayName: "Seth's Renamed Team",
    });
  });

  it("preserves repository-backed claimed memberships when setup rows omit known users", async () => {
    const leagueSetupRepository = new AsyncLeagueSetupRepository();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      leagueSetupRepository,
      simulationRunner: mockRunner,
    });
    await app.createAccount({ email: "cam@example.com", password: "cam password", now });
    await app.createAccount({ email: "seth@example.com", password: "seth password", now });
    const cam = await app.login({ email: "cam@example.com", password: "cam password", now });
    const seth = await app.login({ email: "seth@example.com", password: "seth password", now });
    if (cam === null || seth === null) throw new Error("Expected fixture logins.");
    const season = buildCurrentMockdLeagueSeason(["Cam", "Seth", "Beaton"], {
      ...leagueConfig,
      teams: 3,
    }, {
      leagueName: "Setup Import League",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    await leagueSetupRepository.registerLeagueSeason({
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: seth.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
      createdByUserId: cam.account.id,
      now,
    });

    expect(app.store.findLeagueSeason(season.id)).toBeNull();
    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: cam.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Cam,Cam's Club,,owner",
        "Seth,Seth's Renamed Team,,member",
        "Beaton,Beaton's Team,beaton@example.com,admin",
      ].join("\n"),
      now,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      memberships: expect.arrayContaining([
        expect.objectContaining({
          userId: seth.account.id,
          role: "member",
          ownerId: expect.stringContaining("seth"),
          teamId: expect.stringContaining("seth"),
        }),
      ]),
      pendingInvites: [
        expect.objectContaining({
          email: "beaton@example.com",
          role: "admin",
        }),
      ],
    });
    const sethView = await app.getLeagueSeason({ actorSessionToken: seth.sessionToken, seasonId: season.id, now });
    expect(sethView.teams.find(team => team.ownerDisplayName === "Seth")).toMatchObject({
      displayName: "Seth's Renamed Team",
    });
  });

  it("routes season setup import preview through the platform HTTP handler", async () => {
    const { app, cam, season } = await setupRegisteredSeason();
    const handle = createPlatformHttpHandler(app);

    const response = await handle({
      method: "POST",
      path: `/seasons/${season.id}/setup-import/preview`,
      sessionToken: cam.sessionToken,
      body: {
        rows: [
          "owner,team,email,role",
          "Cam,Cam's Club,cam@example.com,owner",
          "Seth,Seth's Champs,seth@example.com,member",
          "Beaton,Beaton's Team,beaton@example.com,member",
        ],
        now,
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      import: {
        status: "ready",
        records: [
          expect.objectContaining({ ownerDisplayName: "Cam", teamDisplayName: "Cam's Club" }),
          expect.objectContaining({ ownerDisplayName: "Seth", teamDisplayName: "Seth's Champs" }),
          expect.objectContaining({ ownerDisplayName: "Beaton", teamDisplayName: "Beaton's Team" }),
        ],
      },
    });
  });
});
