import { describe, expect, it } from "vitest";
import { InMemoryFantasyProsRepository } from "../src/platform/fantasyPros.js";
import { InMemoryPlatformStore, createPlatformApp } from "../src/platform/platformApp.js";
import {
  createPlatformHttpHandler,
  type PlatformHttpHandler,
  type PlatformHttpServices,
} from "../src/platform/platformHttp.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import { createLoggedInAccount } from "./platformHttp/support/auth.js";
import { leagueConfig, mockRunner, now, ownerOrder, playerCatalog } from "./platformHttp/support/fixtures.js";

const roomId = "room_advisory";
const provisioningToken = "test-provisioning-token";

const seedRankings = async (repository: InMemoryFantasyProsRepository): Promise<void> => {
  await repository.saveRankings({
    rankingType: "ros",
    scoring: "PPR",
    week: 4,
    fetchedAt: "2026-09-10T12:00:00.000Z",
    rankings: [
      { playerId: 1, playerName: "Puka Nacua", position: "WR", rankEcr: 3, tier: 1, positionRank: "WR2" },
      { playerId: 2, playerName: "Jahmyr Gibbs", position: "RB", rankEcr: 2, tier: 1, positionRank: "RB1", ecrDelta: 4 },
      { playerId: 3, playerName: "Xavier Legette", position: "WR", rankEcr: 190, tier: 12, positionRank: "WR72", ecrDelta: -6 },
    ],
  });
};

const openRoom = async (services: PlatformHttpServices): Promise<{
  handle: PlatformHttpHandler;
  sessionToken: string;
}> => {
  const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
  const handle = createPlatformHttpHandler(app, {
    allowPublicSignup: true,
    provisioningToken,
    currentPlayerCatalogProvider: async () => playerCatalog,
    ...services,
  });
  const owner = await createLoggedInAccount(handle, "advisory-owner@example.com");
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: "League 100001",
    setupStatus: "published",
  });
  const ownerTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
  if (ownerTeam === undefined) throw new Error("Expected Owner11 fixture team.");
  await handle({
    method: "PUT",
    path: `/seasons/${season.id}`,
    sessionToken: owner.sessionToken,
    body: {
      season,
      memberships: [{
        userId: owner.account.id,
        leagueId: season.leagueId,
        role: "owner",
        ownerId: ownerTeam.ownerId,
        teamId: ownerTeam.id,
      }],
      now,
    },
  });
  await handle({
    method: "POST",
    path: "/live-rooms",
    sessionToken: owner.sessionToken,
    headers: { "x-mockd-provisioning-token": provisioningToken },
    body: { seasonId: season.id, roomId, viewerPasswordHashRef: "viewer-password-hash", playerCatalog, now },
  });
  return { handle, sessionToken: owner.sessionToken };
};

describe("live draft room advisory route", () => {
  it("serves rank, tier, and momentum for every matched player on the room catalog", async () => {
    const repository = new InMemoryFantasyProsRepository();
    await seedRankings(repository);
    const { handle, sessionToken } = await openRoom({
      fantasyProsRepository: repository,
      fantasyProsConfigured: true,
    });

    const response = await handle({ method: "GET", path: `/live-rooms/${roomId}/advisory`, sessionToken });

    expect(response).toEqual({
      status: 200,
      body: {
        configured: true,
        basis: "ros",
        week: 4,
        players: [
          {
            normalizedPlayerName: "Puka Nacua",
            rankEcr: 3,
            tier: 1,
            positionRank: "WR2",
            momentum: "steady",
            ecrDelta: undefined,
          },
          {
            normalizedPlayerName: "Xavier Legette",
            rankEcr: 190,
            tier: 12,
            positionRank: "WR72",
            momentum: "falling",
            ecrDelta: -6,
          },
          {
            normalizedPlayerName: "Jahmyr Gibbs",
            rankEcr: 2,
            tier: 1,
            positionRank: "RB1",
            momentum: "rising",
            ecrDelta: 4,
          },
        ],
      },
    });
  });

  it("serves an empty advisory when FantasyPros is unconfigured", async () => {
    const { handle, sessionToken } = await openRoom({});

    const response = await handle({ method: "GET", path: `/live-rooms/${roomId}/advisory`, sessionToken });

    expect(response).toEqual({
      status: 200,
      body: { configured: false, basis: "ros", players: [], week: null },
    });
  });

  it("serves an empty advisory when the key is set but no dataset has synced", async () => {
    const { handle, sessionToken } = await openRoom({
      fantasyProsRepository: new InMemoryFantasyProsRepository(),
      fantasyProsConfigured: true,
    });

    const response = await handle({ method: "GET", path: `/live-rooms/${roomId}/advisory`, sessionToken });

    expect(response).toEqual({
      status: 200,
      body: { configured: true, basis: "weekly", players: [], week: null },
    });
  });

  it("falls back to the weekly basis when only weekly rankings are stored", async () => {
    const repository = new InMemoryFantasyProsRepository();
    await repository.saveRankings({
      rankingType: "weekly",
      scoring: "PPR",
      week: 7,
      fetchedAt: "2026-10-20T12:00:00.000Z",
      rankings: [{ playerId: 2, playerName: "Jahmyr Gibbs", position: "RB", rankEcr: 2, tier: 1 }],
    });
    const { handle, sessionToken } = await openRoom({
      fantasyProsRepository: repository,
      fantasyProsConfigured: true,
    });

    const response = await handle({ method: "GET", path: `/live-rooms/${roomId}/advisory`, sessionToken });

    expect(response).toMatchObject({
      status: 200,
      body: { basis: "weekly", week: 7 },
    });
  });

  it("requires a signed-in account", async () => {
    const { handle } = await openRoom({});

    await expect(handle({ method: "GET", path: `/live-rooms/${roomId}/advisory` })).resolves.toMatchObject({
      status: 401,
    });
  });

  it("keeps a non-member out of the room advisory", async () => {
    const repository = new InMemoryFantasyProsRepository();
    await seedRankings(repository);
    const { handle } = await openRoom({
      fantasyProsRepository: repository,
      fantasyProsConfigured: true,
    });
    const outsider = await createLoggedInAccount(handle, "outsider@example.com");

    await expect(handle({
      method: "GET",
      path: `/live-rooms/${roomId}/advisory`,
      sessionToken: outsider.sessionToken,
    })).resolves.toMatchObject({ status: 403 });
  });

  it("rejects a write to the advisory", async () => {
    const { handle, sessionToken } = await openRoom({});

    await expect(handle({
      method: "POST",
      path: `/live-rooms/${roomId}/advisory`,
      sessionToken,
    })).resolves.toMatchObject({ status: 405 });
  });
});
