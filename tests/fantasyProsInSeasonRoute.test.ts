import { beforeEach, describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import {
  InMemoryFantasyProsRepository,
  type FantasyProsRepository,
} from "../src/platform/fantasyPros.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../src/platform/liveDraftRooms.js";
import { InMemoryPlatformStore, createPlatformApp } from "../src/platform/platformApp.js";
import {
  createPlatformHttpHandler,
  type PlatformHttpHandler,
} from "../src/platform/platformHttp.js";
import { createLoggedInAccount, type LoggedInAccount } from "./platformHttp/support/auth.js";
import { mockRunner, now } from "./platformHttp/support/fixtures.js";

const provisioningToken = "test-provisioning-token";
const roomId = "room_in_season_2026";
const fetchedAt = "2026-09-17T09:00:00.000Z";

const drafted: readonly LiveDraftRoomPlayerCatalogEntry[] = [
  { name: "Trevor Lawrence", position: "QB", expectedPrice: 9, teamAbbreviation: "JAX", byeWeek: 8 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72, teamAbbreviation: "DET", byeWeek: 6 },
  { name: "De'Von Achane", position: "RB", expectedPrice: 50, teamAbbreviation: "MIA", byeWeek: 12 },
  { name: "Puka Nacua", position: "WR", expectedPrice: 73, teamAbbreviation: "LAR", byeWeek: 8 },
  { name: "Jayden Higgins", position: "WR", expectedPrice: 12, teamAbbreviation: "HOU", byeWeek: 6 },
  { name: "Xavier Legette", position: "WR", expectedPrice: 2, teamAbbreviation: "CAR", byeWeek: 14 },
  { name: "Cade Otton", position: "TE", expectedPrice: 4, teamAbbreviation: "TB", byeWeek: 9 },
  { name: "Cam Little", position: "K", expectedPrice: 1, teamAbbreviation: "JAX", byeWeek: 8 },
  { name: "Texans D/ST", position: "DST", expectedPrice: 3, teamAbbreviation: "HOU", byeWeek: 6 },
];

const undrafted: readonly LiveDraftRoomPlayerCatalogEntry[] = [
  { name: "Jalen Coker", position: "WR", expectedPrice: 1, teamAbbreviation: "CAR", byeWeek: 14 },
  { name: "Tyler Shough", position: "QB", expectedPrice: 1, teamAbbreviation: "NO", byeWeek: 11 },
];

const playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[] = [...drafted, ...undrafted];

const seedFantasyPros = async (repository: FantasyProsRepository): Promise<void> => {
  await repository.saveRankings({
    rankingType: "weekly",
    scoring: "PPR",
    week: 3,
    fetchedAt,
    rankings: [
      { playerId: 1, playerName: "Jahmyr Gibbs", position: "RB", teamAbbreviation: "DET", rankEcr: 1 },
      { playerId: 3, playerName: "Puka Nacua", position: "WR", teamAbbreviation: "LAR", rankEcr: 5 },
      { playerId: 2, playerName: "De'Von Achane", position: "RB", teamAbbreviation: "MIA", rankEcr: 9 },
      { playerId: 4, playerName: "Jayden Higgins", position: "WR", teamAbbreviation: "HOU", rankEcr: 30 },
      { playerId: 5, playerName: "Xavier Legette", position: "WR", teamAbbreviation: "CAR", rankEcr: 32 },
      { playerId: 6, playerName: "Cade Otton", position: "TE", teamAbbreviation: "TB", rankEcr: 35 },
      { playerId: 10, playerName: "Jalen Coker", position: "WR", teamAbbreviation: "CAR", rankEcr: 90 },
    ],
  });
  await repository.saveRankings({
    rankingType: "ros",
    scoring: "PPR",
    week: 0,
    fetchedAt,
    rankings: [
      { playerId: 1, playerName: "Jahmyr Gibbs", position: "RB", teamAbbreviation: "DET", rankEcr: 3, tier: 1, ownedEspn: 99.9, byeWeek: 6 },
      { playerId: 7, playerName: "Trevor Lawrence", position: "QB", teamAbbreviation: "JAC", rankEcr: 60, tier: 6, ownedEspn: 70 },
      { playerId: 9, playerName: "Houston Texans", position: "DST", teamAbbreviation: "HOU", rankEcr: 150, tier: 14, ownedEspn: 50 },
      { playerId: 10, playerName: "Jalen Coker", position: "WR", teamAbbreviation: "CAR", rankEcr: 127, tier: 12, ownedEspn: 37 },
      { playerId: 11, playerName: "Tyler Shough", position: "QB", teamAbbreviation: "NO", rankEcr: 125, tier: 12, ownedEspn: 41.3 },
    ],
  });
  await repository.saveProjections({
    week: 3,
    position: "RB",
    fetchedAt,
    projections: [
      { playerId: 1, playerName: "Jahmyr Gibbs", position: "RB", pointsPpr: 19.4 },
      { playerId: 2, playerName: "De'Von Achane", position: "RB", pointsPpr: 15.1 },
      { playerId: 3, playerName: "Puka Nacua", position: "WR", pointsPpr: 16 },
      { playerId: 4, playerName: "Jayden Higgins", position: "WR", pointsPpr: 12 },
      { playerId: 5, playerName: "Xavier Legette", position: "WR", pointsPpr: 9 },
      { playerId: 6, playerName: "Cade Otton", position: "TE", pointsPpr: 11 },
      { playerId: 7, playerName: "Trevor Lawrence", position: "QB", pointsPpr: 18 },
      { playerId: 9, playerName: "Houston Texans", position: "DST", pointsPpr: 7.5 },
    ],
  });
};

interface RoomContext {
  handle: PlatformHttpHandler;
  owner: LoggedInAccount;
  bystander: LoggedInAccount;
  season: LeagueSeason;
  teamId: string;
}

// The in-season route deliberately does not take a projection provider, so the
// handler here is given none.
const createRoomContext = async (
  repository?: FantasyProsRepository,
): Promise<RoomContext> => {
  const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
  const handle = createPlatformHttpHandler(app, {
    allowPublicSignup: true,
    provisioningToken,
    currentPlayerCatalogProvider: async () => playerCatalog,
    ...(repository === undefined
      ? {}
      : { fantasyProsRepository: repository, fantasyProsConfigured: true }),
  });
  const owner = await createLoggedInAccount(handle, "owner11@example.com");
  const bystander = await createLoggedInAccount(handle, "bystander@example.com");
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: "League 100001",
    setupStatus: "published",
  });
  const team = season.teams.find(candidate => candidate.ownerDisplayName === "Owner11");
  if (team === undefined) throw new Error("Expected the Owner11 fixture team.");

  await handle({
    method: "PUT",
    path: `/seasons/${season.id}`,
    sessionToken: owner.sessionToken,
    body: {
      season,
      memberships: [
        {
          userId: owner.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: team.ownerId,
          teamId: team.id,
        },
        { userId: bystander.account.id, leagueId: season.leagueId, role: "member" },
      ],
      now,
    },
  });
  await handle({
    method: "POST",
    path: "/live-rooms",
    sessionToken: owner.sessionToken,
    headers: { "x-mockd-provisioning-token": provisioningToken },
    body: {
      seasonId: season.id,
      roomId,
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      // Keeper-sourced roster rows carry no team abbreviation, which is the
      // harder case for matching a defense.
      initialRosters: drafted.map(player => ({
        teamId: team.id,
        playerName: player.name,
        position: player.position,
        price: 1,
      })),
      now,
    },
  });

  return { handle, owner, bystander, season, teamId: team.id };
};

const endRoom = async (context: RoomContext): Promise<void> => {
  const state = await context.handle({
    method: "GET",
    path: `/live-rooms/${roomId}`,
    sessionToken: context.owner.sessionToken,
  });
  const revision = JSON.parse(JSON.stringify(state.body)).room.revision;
  await context.handle({
    method: "POST",
    path: `/live-rooms/${roomId}/end`,
    sessionToken: context.owner.sessionToken,
    body: {
      expectedRevision: revision,
      idempotencyKey: "end-in-season-room",
      allowIncomplete: true,
      now: new Date(now.getTime() + 1_000),
    },
  });
};

const getInSeason = async (
  context: RoomContext,
  sessionToken?: string,
) => await context.handle({
  method: "GET",
  path: `/live-rooms/${roomId}/in-season`,
  ...(sessionToken === undefined ? {} : { sessionToken }),
});

describe("live room in-season route", () => {
  let context: RoomContext;
  let repository: InMemoryFantasyProsRepository;

  beforeEach(async () => {
    repository = new InMemoryFantasyProsRepository();
    await seedFantasyPros(repository);
    context = await createRoomContext(repository);
  });

  it("requires a signed-in account", async () => {
    await expect(getInSeason(context)).resolves.toMatchObject({
      status: 401,
      body: { error: { code: "auth_required" } },
    });
  });

  it("rejects a write", async () => {
    await endRoom(context);

    await expect(context.handle({
      method: "POST",
      path: `/live-rooms/${roomId}/in-season`,
      sessionToken: context.owner.sessionToken,
      body: {},
    })).resolves.toMatchObject({ status: 405 });
  });

  it("stays closed until the draft ends", async () => {
    await expect(getInSeason(context, context.owner.sessionToken)).resolves.toEqual({
      status: 409,
      body: {
        error: {
          code: "room_not_ended",
          message: "In-season tools open once the draft ends.",
        },
      },
    });
  });

  it("requires a claimed team", async () => {
    await endRoom(context);

    await expect(getInSeason(context, context.bystander.sessionToken)).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "private_team_required" } },
    });
  });

  it("serves the enriched roster, a lineup, and a waiver board", async () => {
    await endRoom(context);

    const response = await getInSeason(context, context.owner.sessionToken);
    const body = JSON.parse(JSON.stringify(response.body));

    expect(response.status).toBe(200);
    expect(body.configured).toBe(true);
    expect(body.week).toBe(3);
    expect(body.updatedAt).toBe(fetchedAt);
    expect(body.players).toHaveLength(drafted.length);
    expect(body.players.find((player: { playerName: string }) =>
      player.playerName === "Jahmyr Gibbs")).toMatchObject({
      fantasyProsPlayerId: 1,
      // Keeper rows carry no bye week, so it comes from FantasyPros instead.
      byeWeek: 6,
      weekly: { rankEcr: 1 },
      restOfSeason: { rankEcr: 3, tier: 1 },
      weeklyProjectedPoints: 19.4,
    });
    expect(body.lineup.basis).toBe("weekly_projection");
    // The kicker slot is absent because FantasyPros published no projection
    // for him; an unfillable slot is dropped rather than filled with a zero.
    expect(body.lineup.slots.map((slot: { slot: string }) => slot.slot))
      .toEqual(["QB", "RB1", "RB2", "WR1", "WR2", "TE", "FLEX", "DST"]);
    expect(body.waivers.source).toBe("widely_available");
    expect(body.waivers.players.map((player: { playerName: string }) => player.playerName))
      .toEqual(["Tyler Shough", "Jalen Coker"]);
  });

  it("leaves a kicker without FantasyPros numbers rather than sending zeros", async () => {
    await endRoom(context);

    const response = await getInSeason(context, context.owner.sessionToken);
    const body = JSON.parse(JSON.stringify(response.body));
    const kicker = body.players.find((player: { position: string }) => player.position === "K");

    expect(kicker.playerName).toBe("Cam Little");
    expect(kicker.weekly).toBeUndefined();
    expect(kicker.restOfSeason).toBeUndefined();
    expect(kicker.weeklyProjectedPoints).toBeUndefined();
    expect(kicker.fantasyProsPlayerId).toBeUndefined();
  });

  it("still serves the roster when FantasyPros is not wired up", async () => {
    const dark = await createRoomContext();
    await endRoom(dark);

    const response = await getInSeason(dark, dark.owner.sessionToken);
    const body = JSON.parse(JSON.stringify(response.body));

    expect(response.status).toBe(200);
    expect(body.configured).toBe(false);
    expect(body.week).toBeUndefined();
    expect(body.lineup).toBeUndefined();
    expect(body.waivers).toEqual({ source: "widely_available", ownershipThreshold: 50, players: [] });
    expect(body.players).toHaveLength(drafted.length);
  });
});
