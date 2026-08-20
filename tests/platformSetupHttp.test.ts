import { describe, expect, it, vi } from "vitest";
import { leagueConfig } from "../config/league.js";
import type { MockBatch } from "../src/modeling/mockBatch.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import { createPlatformApp, InMemoryPlatformStore } from "../src/platform/platformApp.js";
import type {
  LeagueSetupRepository,
  RegisterLeagueSeasonRepositoryInput,
} from "../src/platform/leagueSetup.js";
import { leagueSeasonSetupRevision } from "../src/platform/leagueSetup.js";
import {
  acceptPlatformInvitation,
  InMemoryPlatformInvitationRepository,
} from "../src/platform/platformInvitations.js";
import {
  applyLeagueSetupImport,
  previewLeagueSetupImport,
} from "../src/platform/platformSetupHttp.js";
import { createPlatformHttpHandler } from "../src/platform/platformHttp.js";
import { createClientAddressRateLimiter } from "../src/platform/authRateLimit.js";
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
  await app.createAccount({ email: "owner11@example.com", password: "owner11 password!", now });
  await app.createAccount({ email: "owner04@example.com", password: "owner04 password!", now });
  const owner11 = await app.login({ email: "owner11@example.com", password: "owner11 password!", now });
  const owner04 = await app.login({ email: "owner04@example.com", password: "owner04 password!", now });
  if (owner11 === null || owner04 === null) throw new Error("Expected fixture logins.");

  const season = buildCurrentMockdLeagueSeason(["Owner11", "Owner04", "Owner01"], {
    ...leagueConfig,
    teams: 3,
  }, {
    leagueName: "Setup Import League",
    setupStatus: "published",
  });
  const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
  const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
  if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

  await app.registerLeagueSeason({
    actorSessionToken: owner11.sessionToken,
    season,
    memberships: [
      { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      { userId: owner04.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
    ],
    now,
  });

  return { app, owner11, owner04, season };
};

const makeSeasonReadyForLiveRoom = async (
  app: ReturnType<typeof createPlatformApp>,
  owner11: { sessionToken: string },
  season: ReturnType<typeof buildCurrentMockdLeagueSeason>,
) => {
  const readySeason = buildCurrentMockdLeagueSeason(["Owner11", "Owner04", "Owner01", "Nick"], {
    ...leagueConfig,
    teams: 4,
  }, {
    leagueName: "Setup Import League",
    setupStatus: "published",
  });
  const memberships = (await app.listLeagueMemberships(season.leagueId)).map(membership => {
    const previousTeam = season.teams.find(team => team.id === membership.teamId);
    const readyTeam = readySeason.teams.find(team =>
      team.ownerDisplayName === previousTeam?.ownerDisplayName
    );

    return readyTeam === undefined
      ? membership
      : { ...membership, ownerId: readyTeam.ownerId, teamId: readyTeam.id };
  });
  await app.registerLeagueSeason({
    actorSessionToken: owner11.sessionToken,
    season: readySeason,
    memberships,
    now,
  });

  return readySeason;
};

class AsyncLeagueSetupRepository implements LeagueSetupRepository {
  readonly inner = new InMemoryPlatformStore();

  async registerLeagueSeason(input: RegisterLeagueSeasonRepositoryInput) {
    return this.inner.registerLeagueSeason(input);
  }

  async archiveLeague(input: Parameters<LeagueSetupRepository["archiveLeague"]>[0]) {
    return this.inner.archiveLeague(input);
  }

  async isLeagueArchived(leagueId: string) {
    return this.inner.isLeagueArchived(leagueId);
  }

  async claimLeagueSeasonTeam(input: Parameters<LeagueSetupRepository["claimLeagueSeasonTeam"]>[0]) {
    return this.inner.claimLeagueSeasonTeam(input);
  }

  async joinLeagueSeasonTeam(input: Parameters<LeagueSetupRepository["joinLeagueSeasonTeam"]>[0]) {
    return this.inner.joinLeagueSeasonTeam(input);
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
    const { app, owner11, season } = await setupRegisteredSeason();

    const response = await previewLeagueSetupImport(app, {
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Owner11,Owner11's Club,owner11@example.com,owner",
        " owner11 ,Owner11 Two,owner11-alt@example.com,member",
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

  it("keeps setup import preview available after the live draft room is created", async () => {
    const { app, owner11, season } = await setupRegisteredSeason();
    const readySeason = await makeSeasonReadyForLiveRoom(app, owner11, season);
    await app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: readySeason.id,
      roomId: "room-existing-preview",
      viewerPasswordHashRef: `account-membership:${season.id}`,
      playerCatalog: [{ name: "Puka Nacua", position: "WR", expectedPrice: 73 }],
      now,
    });

    const response = await previewLeagueSetupImport(app, {
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Owner11,Owner11's Club,owner11@example.com,owner",
        "Owner04,Owner04's Champs,owner04@example.com,member",
        "Owner01,Owner01's Team,owner01@example.com,member",
        "Nick,Nick's Team,nick@example.com,member",
      ].join("\n"),
      now,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      import: {
        status: "ready",
      },
    });
  });

  it("rejects setup import apply after the live draft room is created", async () => {
    const { app, owner11, season } = await setupRegisteredSeason();
    const readySeason = await makeSeasonReadyForLiveRoom(app, owner11, season);
    const existingSeason = await app.getLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      seasonId: readySeason.id,
      now,
    });
    const existingMemberships = await app.listLeagueMemberships(readySeason.leagueId);
    await app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: readySeason.id,
      roomId: "room-existing-setup-lock",
      viewerPasswordHashRef: `account-membership:${season.id}`,
      playerCatalog: [{ name: "Puka Nacua", position: "WR", expectedPrice: 73 }],
      now,
    });

    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: owner11.sessionToken,
      seasonId: readySeason.id,
      content: [
        "owner,team,email,role",
        "Owner11,Owner11's Renamed Club,owner11@example.com,owner",
        "Owner04,Owner04's Renamed Champs,owner04@example.com,member",
        "Owner01,Owner01's Renamed Team,owner01@example.com,member",
      ].join("\n"),
      now,
    });

    expect(response).toEqual({
      status: 409,
      body: {
        error: {
          code: "league_setup_locked",
          message: "Team assignments cannot be changed after this season's live draft room has been created.",
        },
      },
    });
    expect(await app.getLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      now,
    })).toEqual(existingSeason);
    expect(await app.listLeagueMemberships(season.leagueId)).toEqual(existingMemberships);
  });

  it("refuses a pasted list that would delete a team, and changes nothing", async () => {
    const { app, owner11, season } = await setupRegisteredSeason();
    const existingSeason = await app.getLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      now,
    });
    const existingMemberships = await app.listLeagueMemberships(season.leagueId);

    // Owner04 moves up and Owner11 is spelled differently. Owner11's row then
    // falls back to a slot Owner04 already took, so Owner11's team is dropped.
    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Owner04,Owner04's Club,owner04@example.com,member",
        "Owner11x,Owner11's Club,owner11@example.com,owner",
        "Owner01,Owner01's Club,owner01@example.com,member",
      ].join("\n"),
      now,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: "league_setup_deletes_teams",
        message: "These rows would delete a team and everything saved against it, including keepers: Owner11 (Owner11). Every team must appear exactly once.",
      },
    });
    expect(await app.getLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      now,
    })).toEqual(existingSeason);
    expect(await app.listLeagueMemberships(season.leagueId)).toEqual(existingMemberships);
  });

  it("returns a stable blocked-import error instead of applying duplicate owners", async () => {
    const { app, owner11, season } = await setupRegisteredSeason();

    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Owner11,Owner11's Club,owner11@example.com,owner",
        "owner11,Owner11 Two,owner11-alt@example.com,member",
        "Owner01,Owner01's Team,owner01@example.com,member",
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
    expect(await app.getLeagueSeason({ actorSessionToken: owner11.sessionToken, seasonId: season.id, now })).toEqual(season);
  });

  it("returns a stable blocked-import error instead of applying malformed rows", async () => {
    const { app, owner11, season } = await setupRegisteredSeason();

    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Owner11,Owner11's Club,owner11@example.com,owner",
        "Owner04,Owner04's Champs,owner04@example.com,member",
        "\"Owner01,Owner01's Team,owner01@example.com,admin",
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
    expect(await app.getLeagueSeason({ actorSessionToken: owner11.sessionToken, seasonId: season.id, now })).toEqual(season);
  });

  it("applies ready rows, keeps commissioner membership, maps known owner ids, and preserves invite emails", async () => {
    const { app, owner11, owner04, season } = await setupRegisteredSeason();

    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Owner11,Owner11's Club,owner11@example.com,owner",
        "Owner04,Owner04's Champs,owner04@example.com,member",
        "Owner01,Owner01's Team,owner01@example.com,admin",
      ].join("\n"),
      knownUsers: [
        { email: "owner04@example.com", accountId: owner04.account.id },
      ],
      now,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      season: expect.objectContaining({
        id: season.id,
        teams: [
          expect.objectContaining({ ownerDisplayName: "Owner11", displayName: "Owner11's Club" }),
          expect.objectContaining({ ownerDisplayName: "Owner04", displayName: "Owner04's Champs" }),
          expect.objectContaining({ ownerDisplayName: "Owner01", displayName: "Owner01's Team" }),
        ],
      }),
      memberships: expect.arrayContaining([
        expect.objectContaining({
          userId: owner11.account.id,
          leagueId: season.leagueId,
          role: "owner",
          inviteEmail: "owner11@example.com",
        }),
        expect.objectContaining({
          userId: owner04.account.id,
          leagueId: season.leagueId,
          role: "member",
          inviteEmail: "owner04@example.com",
        }),
      ]),
      pendingInvites: [
        expect.objectContaining({
          email: "owner01@example.com",
          role: "admin",
        }),
      ],
    });

    const updatedSeason = await app.getLeagueSeason({ actorSessionToken: owner04.sessionToken, seasonId: season.id, now });
    expect(updatedSeason.teams.map(team => team.displayName)).toEqual([
      "Owner11's Club",
      "Owner04's Champs",
      "Owner01's Team",
    ]);
    expect(app.store.findMembership(owner11.account.id, season.leagueId)).toMatchObject({
      userId: owner11.account.id,
      role: "owner",
      inviteEmail: "owner11@example.com",
    });
    expect(app.store.findMembership(owner04.account.id, season.leagueId)).toMatchObject({
      userId: owner04.account.id,
      role: "member",
      inviteEmail: "owner04@example.com",
    });
  });

  it("does not trust registered emails or client-provided account ids during setup import", async () => {
    const { app, owner11, season } = await setupRegisteredSeason();
    await app.createAccount({ email: "owner01@example.com", password: "owner01 password!", now });
    await app.createAccount({ email: "outsider@example.com", password: "outsider password1!", now });
    const owner01 = await app.login({ email: "owner01@example.com", password: "owner01 password!", now });
    const outsider = await app.login({ email: "outsider@example.com", password: "outsider password1!", now });
    if (owner01 === null || outsider === null) throw new Error("Expected fixture logins.");

    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Owner11,Owner11's Club,owner11@example.com,owner",
        "Owner04,Owner04's Champs,owner04@example.com,member",
        "Owner01,Owner01's Team,owner01@example.com,admin",
      ].join("\n"),
      knownUsers: [
        { email: "owner01@example.com", accountId: outsider.account.id },
      ],
      now,
    });

    expect(response.status).toBe(200);
    expect(app.store.findMembership(owner01.account.id, season.leagueId)).toBeNull();
    expect(app.store.findMembership(outsider.account.id, season.leagueId)).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain(owner01.account.id);
    expect(JSON.stringify(response.body)).not.toContain(outsider.account.id);
    expect(response.body).toMatchObject({
      pendingInvites: [{
        email: "owner01@example.com",
        role: "admin",
      }],
    });
  });

  it("keeps a registered non-member pending until the matching account accepts the invitation", async () => {
    const { app, owner11, season } = await setupRegisteredSeason();
    const invitationRepository = new InMemoryPlatformInvitationRepository();
    await app.createAccount({ email: "victim@example.com", password: "victim password1!", now });
    const victim = await app.login({ email: "victim@example.com", password: "victim password1!", now });
    if (victim === null) throw new Error("Expected victim fixture login.");

    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Owner11,Owner11's Club,owner11@example.com,owner",
        "Owner04,Owner04's Champs,owner04@example.com,member",
        "Victim,Victim's Team,victim@example.com,admin",
      ].join("\n"),
      knownUsers: [{ email: "victim@example.com", accountId: victim.account.id }],
      invitationRepository,
      now,
    });

    expect(response.status).toBe(200);
    expect(app.store.findMembership(victim.account.id, season.leagueId)).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain(victim.account.id);
    expect(response.body).toMatchObject({
      pendingInvites: [{
        email: "victim@example.com",
        role: "admin",
      }],
      invitations: [{
        email: "victim@example.com",
        status: "pending",
      }],
    });
    if (!("invitations" in response.body)) throw new Error("Expected setup import response.");
    const invitation = response.body.invitations[0];
    if (invitation === undefined || invitation.acceptPath === undefined) {
      throw new Error("Expected an actionable invitation.");
    }
    const token = new URL(invitation.acceptPath, "http://mockd.local").searchParams.get("token");
    if (token === null) throw new Error("Expected invitation token.");

    await expect(acceptPlatformInvitation(invitationRepository, {
      token,
      account: victim.account,
      now,
    })).resolves.toMatchObject({
      membership: {
        userId: victim.account.id,
        leagueId: season.leagueId,
        role: "admin",
      },
    });
  });

  it("preserves already claimed member access when team setup is reapplied without known user rows", async () => {
    const { app, owner11, owner04, season } = await setupRegisteredSeason();

    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Owner11,Owner11's Club,owner11@example.com,owner",
        "Owner04,Owner04's Renamed Team,owner04@example.com,member",
        "Owner01,Owner01's Team,owner01@example.com,admin",
      ].join("\n"),
      now,
    });

    expect(response.status).toBe(200);
    expect(app.store.findMembership(owner04.account.id, season.leagueId)).toMatchObject({
      userId: owner04.account.id,
      role: "member",
      inviteEmail: "owner04@example.com",
      ownerId: expect.stringContaining("owner04"),
      teamId: expect.stringContaining("owner04"),
    });

    const sethView = await app.getLeagueSeason({ actorSessionToken: owner04.sessionToken, seasonId: season.id, now });
    expect(sethView.teams.find(team => team.ownerDisplayName === "Owner04")).toMatchObject({
      displayName: "Owner04's Renamed Team",
    });
  });

  it("issues actionable invitations for setup rows without registered accounts", async () => {
    const { app, owner11, season } = await setupRegisteredSeason();
    const invitationRepository = new InMemoryPlatformInvitationRepository();

    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Owner11,Owner11's Club,owner11@example.com,owner",
        "Owner04,Owner04's Champs,owner04@example.com,member",
        "Owner01,Owner01's Team,owner01@example.com,admin",
      ].join("\n"),
      invitationRepository,
      now,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      invitations: [{
        email: "owner01@example.com",
        status: "pending",
        acceptPath: expect.stringMatching(/^\/invite\?token=/),
        reissuePath: expect.stringMatching(/^\/invitations\/.+\/reissue$/),
        revokePath: expect.stringMatching(/^\/invitations\/.+\/revoke$/),
      }],
    });
    expect(await invitationRepository.listForSeason(season.id)).toEqual([
      expect.objectContaining({
        email: "owner01@example.com",
        invitedByUserId: owner11.account.id,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    ]);
  });

  it("reports invitation failures after preserving the applied league setup", async () => {
    const { app, owner11, season } = await setupRegisteredSeason();
    const invitationRepository = new InMemoryPlatformInvitationRepository();
    invitationRepository.savePending = () => {
      throw new Error("Email provider unavailable.");
    };

    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Owner11,Owner11's Club,owner11@example.com,owner",
        "Owner04,Owner04's Champs,owner04@example.com,member",
        "Owner01,Owner01's Team,owner01@example.com,member",
      ].join("\n"),
      invitationRepository,
      now,
    });

    expect(response).toMatchObject({
      status: 207,
      body: {
        season: { id: season.id },
        invitations: [],
        invitationFailures: [{
          email: "owner01@example.com",
          message: "Email provider unavailable.",
        }],
      },
    });
  });

  it("preserves repository-backed claimed memberships when setup rows omit known users", async () => {
    const leagueSetupRepository = new AsyncLeagueSetupRepository();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      leagueSetupRepository,
      simulationRunner: mockRunner,
    });
    await app.createAccount({ email: "owner11@example.com", password: "owner11 password!", now });
    await app.createAccount({ email: "owner04@example.com", password: "owner04 password!", now });
    const owner11 = await app.login({ email: "owner11@example.com", password: "owner11 password!", now });
    const owner04 = await app.login({ email: "owner04@example.com", password: "owner04 password!", now });
    if (owner11 === null || owner04 === null) throw new Error("Expected fixture logins.");
    const season = buildCurrentMockdLeagueSeason(["Owner11", "Owner04", "Owner01"], {
      ...leagueConfig,
      teams: 3,
    }, {
      leagueName: "Setup Import League",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    await leagueSetupRepository.registerLeagueSeason({
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
      createdByUserId: owner11.account.id,
      now,
    });

    expect(app.store.findLeagueSeason(season.id)).toBeNull();
    const response = await applyLeagueSetupImport(app, {
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      content: [
        "owner,team,email,role",
        "Owner11,Owner11's Club,,owner",
        "Owner04,Owner04's Renamed Team,,member",
        "Owner01,Owner01's Team,owner01@example.com,admin",
      ].join("\n"),
      now,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      memberships: expect.arrayContaining([
        expect.objectContaining({
          userId: owner04.account.id,
          role: "member",
          ownerId: expect.stringContaining("owner04"),
          teamId: expect.stringContaining("owner04"),
        }),
      ]),
      pendingInvites: [
        expect.objectContaining({
          email: "owner01@example.com",
          role: "admin",
        }),
      ],
    });
    const sethView = await app.getLeagueSeason({ actorSessionToken: owner04.sessionToken, seasonId: season.id, now });
    expect(sethView.teams.find(team => team.ownerDisplayName === "Owner04")).toMatchObject({
      displayName: "Owner04's Renamed Team",
    });
  });

  it("routes season setup import preview through the platform HTTP handler", async () => {
    const { app, owner11, season } = await setupRegisteredSeason();
    const handle = createPlatformHttpHandler(app);

    const response = await handle({
      method: "POST",
      path: `/seasons/${season.id}/setup-import/preview`,
      sessionToken: owner11.sessionToken,
      body: {
        rows: [
          "owner,team,email,role",
          "Owner11,Owner11's Club,owner11@example.com,owner",
          "Owner04,Owner04's Champs,owner04@example.com,member",
          "Owner01,Owner01's Team,owner01@example.com,member",
        ],
        now,
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      import: {
        status: "ready",
        records: [
          expect.objectContaining({ ownerDisplayName: "Owner11", teamDisplayName: "Owner11's Club" }),
          expect.objectContaining({ ownerDisplayName: "Owner04", teamDisplayName: "Owner04's Champs" }),
          expect.objectContaining({ ownerDisplayName: "Owner01", teamDisplayName: "Owner01's Team" }),
        ],
      },
    });
  });

  it("lets only commissioners analyze a screenshot and returns a validated review model", async () => {
    const { app, owner11, owner04, season } = await setupRegisteredSeason();
    const analyze = vi.fn(async () => ({
      leagueName: "The Sunday Games",
      externalLeagueId: "100001",
      teams: ["Owner11", "Owner04", "Owner01"].map((manager, index) => ({
        draftOrderPosition: index + 1,
        abbreviation: manager.toUpperCase(),
        teamDisplayName: `${manager} Team`,
        managerDisplayNames: [manager],
        confidence: "high" as const,
        issues: [],
        confirmed: false,
      })),
    }));
    const handle = createPlatformHttpHandler(app, {
      leagueMembersScreenshotAnalyzer: { analyze },
      screenshotImportRateLimiter: createClientAddressRateLimiter({
        maxAttempts: 5,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
    });

    const memberResponse = await handle({
      method: "POST",
      path: `/seasons/${season.id}/setup-import/screenshot-analyze`,
      sessionToken: owner04.sessionToken,
      clientAddress: "203.0.113.8",
      body: { mimeType: "image/png", base64: "not-sent-to-stub" },
      now,
    });
    expect(memberResponse.status).toBe(403);
    expect(analyze).not.toHaveBeenCalled();

    const response = await handle({
      method: "POST",
      path: `/seasons/${season.id}/setup-import/screenshot-analyze`,
      sessionToken: owner11.sessionToken,
      clientAddress: "203.0.113.9",
      body: { mimeType: "image/png", base64: "sent-to-stub" },
      now,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      setupRevision: expect.any(String),
      import: {
        status: "ready",
        leagueName: "The Sunday Games",
        externalLeagueId: "100001",
        records: [
          expect.objectContaining({ abbreviation: "OWNER11", ownerDisplayName: "Owner11" }),
          expect.objectContaining({ abbreviation: "OWNER04", ownerDisplayName: "Owner04" }),
          expect.objectContaining({ abbreviation: "OWNER01", ownerDisplayName: "Owner01" }),
        ],
      },
      extraction: expect.objectContaining({ teams: expect.any(Array) }),
    });
    expect(analyze).toHaveBeenCalledWith({ mimeType: "image/png", base64: "sent-to-stub" });
  });

  it("rate limits screenshot analysis before incurring a second provider call", async () => {
    const { app, owner11, season } = await setupRegisteredSeason();
    const analyze = vi.fn(async () => ({
      leagueName: null,
      externalLeagueId: null,
      teams: [],
    }));
    const handle = createPlatformHttpHandler(app, {
      leagueMembersScreenshotAnalyzer: { analyze },
      screenshotImportRateLimiter: createClientAddressRateLimiter({
        maxAttempts: 1,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
    });
    const request = {
      method: "POST",
      path: `/seasons/${season.id}/setup-import/screenshot-analyze`,
      sessionToken: owner11.sessionToken,
      clientAddress: "203.0.113.10",
      body: { mimeType: "image/png", base64: "sent-to-stub" },
      now,
    };

    expect((await handle(request)).status).toBe(200);
    const limited = await handle(request);

    expect(limited).toMatchObject({
      status: 429,
      body: { error: { code: "rate_limited" } },
      headers: { "Retry-After": "60" },
    });
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it("applies reviewed screenshot teams without creating invitations", async () => {
    const { app, owner11, season } = await setupRegisteredSeason();
    const handle = createPlatformHttpHandler(app);
    const response = await handle({
      method: "POST",
      path: `/seasons/${season.id}/setup-import/screenshot-apply`,
      sessionToken: owner11.sessionToken,
      body: {
        setupRevision: leagueSeasonSetupRevision(season),
        leagueName: "The Sunday Games",
        externalLeagueId: "100001",
        teams: ["Owner11", "Owner04", "Owner01"].map((manager, index) => ({
          targetTeamId: season.teams[index]?.id,
          draftOrderPosition: index + 1,
          abbreviation: manager.toUpperCase(),
          teamDisplayName: `${manager} Team`,
          managerDisplayNames: index === 2 ? [manager, "Matt Co-manager"] : [manager],
          confidence: "high",
          issues: [],
          confirmed: false,
        })),
      },
      now,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      season: {
        league: { name: "The Sunday Games", provider: "espn", externalLeagueId: "100001" },
        teams: expect.arrayContaining([
          expect.objectContaining({
            abbreviation: "OWNER01",
            managerDisplayNames: ["Owner01", "Matt Co-manager"],
          }),
        ]),
      },
      pendingInvites: [],
      invitations: [],
    });
  });

  it("preserves account claims while explicitly mapped ESPN rows change order", async () => {
    const { app, owner11, season } = await setupRegisteredSeason();
    const membershipsBefore = await app.listLeagueMemberships(season.leagueId);
    const importedManagers = ["Owner04", "Owner11", "Owner01"];
    const targetTeamIds = importedManagers.map(manager =>
      season.teams.find(team => team.ownerDisplayName === manager)?.id
    );
    const response = await createPlatformHttpHandler(app)({
      method: "POST",
      path: `/seasons/${season.id}/setup-import/screenshot-apply`,
      sessionToken: owner11.sessionToken,
      body: {
        setupRevision: leagueSeasonSetupRevision(season),
        leagueName: "The Sunday Games",
        externalLeagueId: "100001",
        teams: importedManagers.map((manager, index) => ({
          targetTeamId: targetTeamIds[index],
          draftOrderPosition: index + 1,
          abbreviation: manager.toUpperCase(),
          teamDisplayName: `${manager} ESPN Team`,
          managerDisplayNames: [manager],
          confidence: "high",
          issues: [],
          confirmed: false,
        })),
      },
      now,
    });

    expect(response.status).toBe(200);
    await expect(app.listLeagueMemberships(season.leagueId)).resolves.toEqual(membershipsBefore);
    const appliedSeason = await app.getLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      now,
    });
    expect(appliedSeason.teams.find(team => team.id === targetTeamIds[0])?.ownerDisplayName).toBe("Owner04");
    expect(appliedSeason.teams.find(team => team.id === targetTeamIds[1])?.ownerDisplayName).toBe("Owner11");
  });

  it("rejects a screenshot import that omits a stored team profile", async () => {
    const { app, owner11, season } = await setupRegisteredSeason();
    const sourceTeam = season.teams[2];
    if (sourceTeam === undefined) throw new Error("Expected source team fixture.");
    const malformedSeason = {
      ...season,
      teams: [
        ...season.teams,
        {
          ...sourceTeam,
          id: `${sourceTeam.id}-legacy-extra`,
          ownerId: `${sourceTeam.ownerId}-legacy-extra`,
          ownerDisplayName: "Legacy Owner",
          displayName: "Legacy Team",
          draftOrderPosition: 4,
        },
      ],
    };
    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season: malformedSeason,
      memberships: await app.listLeagueMemberships(season.leagueId),
      now,
    });

    const response = await createPlatformHttpHandler(app)({
      method: "POST",
      path: `/seasons/${season.id}/setup-import/screenshot-apply`,
      sessionToken: owner11.sessionToken,
      body: {
        setupRevision: leagueSeasonSetupRevision(malformedSeason),
        leagueName: "The Sunday Games",
        externalLeagueId: "100001",
        teams: ["Owner11", "Owner04", "Owner01"].map((manager, index) => ({
          targetTeamId: season.teams[index]?.id,
          draftOrderPosition: index + 1,
          abbreviation: manager.toUpperCase(),
          teamDisplayName: `${manager} Team`,
          managerDisplayNames: [manager],
          confidence: "high",
          issues: [],
          confirmed: false,
        })),
      },
      now,
    });

    expect(response).toMatchObject({
      status: 400,
      body: {
        error: { code: "league_setup_import_blocked" },
        import: {
          status: "blocked",
          blockers: [{ code: "team_mapping_coverage_mismatch" }],
        },
      },
    });
    const persisted = await app.getLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      now,
    });
    expect(persisted.teams).toHaveLength(4);
  });

  it("rejects a screenshot review after league setup changed", async () => {
    const { app, owner11, season } = await setupRegisteredSeason();
    const handle = createPlatformHttpHandler(app);
    const response = await handle({
      method: "POST",
      path: `/seasons/${season.id}/setup-import/screenshot-apply`,
      sessionToken: owner11.sessionToken,
      body: {
        setupRevision: "stale-review",
        leagueName: "The Sunday Games",
        externalLeagueId: "100001",
        teams: ["Owner11", "Owner04", "Owner01"].map((manager, index) => ({
          targetTeamId: season.teams[index]?.id,
          draftOrderPosition: index + 1,
          abbreviation: manager.toUpperCase(),
          teamDisplayName: `${manager} Team`,
          managerDisplayNames: [manager],
          confidence: "high",
          issues: [],
          confirmed: false,
        })),
      },
      now,
    });

    expect(response).toMatchObject({
      status: 409,
      body: { error: { code: "league_setup_write_conflict" } },
    });
  });
});
