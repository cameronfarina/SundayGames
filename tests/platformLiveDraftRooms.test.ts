import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../src/platform/leagueSeason.js";
import {
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  type LiveDraftRoomPlayerCatalogEntry,
} from "../src/platform/liveDraftRooms.js";

const now = new Date("2026-08-09T12:00:00.000Z");
const commissioner = { userId: "user_commish", leagueId: "league-214674", role: "admin" } as const;
const member = { userId: "user_member", leagueId: "league-214674", role: "member" } as const;
const nonMember = { userId: "user_outside", leagueId: "other-league", role: "admin" } as const;

const playerCatalog = [
  { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
  { name: "Xavier Legette", position: "WR", expectedPrice: 2 },
  { name: "Amon-Ra St. Brown", position: "WR", expectedPrice: 67 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
  { name: "De'Von Achane", position: "RB", expectedPrice: 50 },
  { name: "Trevor Lawrence", position: "QB", expectedPrice: 9 },
] as const satisfies readonly LiveDraftRoomPlayerCatalogEntry[];

const publishedSeason = (): LeagueSeason =>
  buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    setupStatus: "published",
    leagueName: "Sunday league",
  });

const createRoom = (
  repository = new InMemoryLiveDraftRoomRepository(),
  options: Partial<Parameters<InMemoryLiveDraftRoomRepository["createRoom"]>[0]> = {},
) =>
  repository.createRoom({
    season: publishedSeason(),
    roomId: "room_sunday",
    commissionerUserId: "user_commish",
    viewerPasswordHashRef: "viewer-password-hash",
    playerCatalog,
    createdAt: now,
    ...options,
  });

const startRoom = (
  repository: InMemoryLiveDraftRoomRepository,
  expectedRevision = 1,
) =>
  repository.startRoom({
    roomId: "room_sunday",
    actor: commissioner,
    expectedRevision,
    idempotencyKey: `start:room_sunday:${expectedRevision}`,
    now: new Date(now.getTime() + 1_000),
  });

const teamByOwner = (season: LeagueSeason, ownerDisplayName: string) => {
  const team = season.teams.find(candidate => candidate.ownerDisplayName === ownerDisplayName);
  if (team === undefined) throw new Error(`Expected ${ownerDisplayName} team fixture.`);

  return team;
};

describe("live draft rooms", () => {
  it("creates rooms only from ready published seasons and starts with revisioned events", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const room = createRoom(repository);

    expect(room).toMatchObject({
      roomId: "room_sunday",
      leagueId: "league-214674",
      seasonId: "league-214674-season-2026",
      status: "setup",
      commissionerUserId: "user_commish",
      viewerPasswordHashRef: "viewer-password-hash",
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });
    expect(room.projection.teams).toHaveLength(ownerOrder.length);
    expect(room.events.map(event => event.type)).toEqual(["room_created"]);
    expect(repository.getRoomForActor({ roomId: "room_sunday", actor: member })).toBe(room);
    expect(() =>
      repository.getRoomForActor({ roomId: "room_sunday", actor: nonMember }),
    ).toThrow(new LiveDraftRoomError("access_denied", "Only league members can view this draft room."));

    const started = startRoom(repository);

    expect(started.status).toBe("live");
    expect(started.revision).toBe(2);
    expect(started.events.map(event => event.type)).toEqual(["room_created", "room_started"]);

    expect(() =>
      createRoom(repository, {
        season: buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "draft" }),
        roomId: "room_not_ready",
      }),
    ).toThrow(new LiveDraftRoomError(
      "season_not_ready",
      "League season must be published or locked before creating a live draft room.",
    ));

    expect(() => createRoom(repository)).toThrow(new LiveDraftRoomError(
      "room_already_exists",
      "Live draft room \"room_sunday\" already exists.",
    ));

    expect(() =>
      repository.startRoom({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 2,
        idempotencyKey: "start:room_sunday:already-live",
        now: new Date(now.getTime() + 2_000),
      }),
    ).toThrow(new LiveDraftRoomError("room_already_live", "Draft room has already started."));
  });

  it("requires revision and idempotency metadata for live mutations", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);

    expect(() =>
      repository.startRoom({
        roomId: "room_sunday",
        actor: commissioner,
        idempotencyKey: "start:missing-revision",
      }),
    ).toThrow(new LiveDraftRoomError(
      "expected_revision_required",
      "Draft room mutation requires the current revision.",
    ));

    expect(() =>
      repository.startRoom({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 1,
      }),
    ).toThrow(new LiveDraftRoomError(
      "idempotency_key_required",
      "Draft room mutation requires an idempotency key.",
    ));

    startRoom(repository);

    expect(() =>
      repository.logSaleCommand({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 2,
        sale: "cam puka 62",
      }),
    ).toThrow(new LiveDraftRoomError(
      "idempotency_key_required",
      "Draft room mutation requires an idempotency key.",
    ));
  });

  it("parses compact sale commands and updates budget, roster, revision, and events", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);
    startRoom(repository);

    const room = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:62",
      sale: "cam puka 62",
      now: new Date(now.getTime() + 2_000),
    });
    const cam = room.projection.teams.find(team => team.ownerDisplayName === "Cam");

    expect(room.revision).toBe(3);
    expect(room.events.map(event => event.type)).toEqual(["room_created", "room_started", "sale_logged"]);
    expect(room.projection.sales).toEqual([
      expect.objectContaining({
        ownerDisplayName: "Cam",
        teamDisplayName: "Cam",
        playerName: "Puka Nacua",
        position: "WR",
        price: 62,
      }),
    ]);
    expect(cam).toMatchObject({
      ownerDisplayName: "Cam",
      spent: 62,
      budgetRemaining: 138,
      rosterSlotsRemaining: 15,
      maxBid: 124,
    });
    expect(cam?.roster).toEqual([
      expect.objectContaining({ name: "Puka Nacua", position: "WR", price: 62 }),
    ]);
    expect(room.projection.board.map(player => player.name)).not.toContain("Puka Nacua");
  });

  it("replays idempotent live mutations instead of double-appending events", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);

    const started = repository.startRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 1,
      idempotencyKey: "start:room_sunday",
      now: new Date(now.getTime() + 1_000),
    });
    const retriedStart = repository.startRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 1,
      idempotencyKey: "start:room_sunday",
      now: new Date(now.getTime() + 2_000),
    });

    expect(retriedStart).toBe(started);
    expect(retriedStart.events.map(event => event.type)).toEqual(["room_created", "room_started"]);

    const sold = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:62",
      sale: "cam puka 62",
      now: new Date(now.getTime() + 3_000),
    });
    const retriedSale = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:62",
      sale: "cam puka 62",
      now: new Date(now.getTime() + 4_000),
    });

    expect(retriedSale).toBe(sold);
    expect(retriedSale.projection.sales).toHaveLength(1);
    expect(retriedSale.revision).toBe(3);

    expect(() =>
      repository.logSaleCommand({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 3,
        idempotencyKey: "sale:puka:62",
        sale: "cam puka 61",
        now: new Date(now.getTime() + 5_000),
      }),
    ).toThrow(new LiveDraftRoomError(
      "idempotency_conflict",
      "A draft room mutation already exists for this idempotency key with different input.",
    ));
  });

  it("accepts already-parsed sale objects", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);
    startRoom(repository);

    const room = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:amon-ra:50",
      sale: {
        ownerText: "Sam",
        playerName: "Amon-Ra St. Brown",
        price: 50,
      },
      now: new Date(now.getTime() + 2_000),
    });

    expect(room.projection.sales).toEqual([
      expect.objectContaining({
        ownerDisplayName: "Sam",
        playerName: "Amon-Ra St. Brown",
        price: 50,
      }),
    ]);
  });

  it("rejects structured sales when teamId and ownerId point to different teams", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const season = publishedSeason();
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    createRoom(repository, { season });
    startRoom(repository);

    expect(() =>
      repository.logSaleCommand({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 2,
        idempotencyKey: "sale:mismatched-team-owner",
        sale: {
          teamId: camTeam.id,
          ownerId: sethTeam.ownerId,
          playerName: "Puka Nacua",
          price: 1,
        },
        now: new Date(now.getTime() + 2_000),
      }),
    ).toThrow(new LiveDraftRoomError(
      "team_not_found",
      `Sale team does not match owner "${sethTeam.ownerId}".`,
    ));
  });

  it("rejects duplicate sold players", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);
    startRoom(repository);
    repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:62",
      sale: "cam puka 62",
      now: new Date(now.getTime() + 2_000),
    });

    expect(() =>
      repository.logSaleCommand({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 3,
        idempotencyKey: "sale:puka:63",
        sale: "sam puka 63",
        now: new Date(now.getTime() + 3_000),
      }),
    ).toThrow(new LiveDraftRoomError("duplicate_player", "Puka Nacua is already unavailable."));
  });

  it("rejects duplicate players in initial rosters", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const season = publishedSeason();
    const camTeam = teamByOwner(season, "Cam");
    const samTeam = teamByOwner(season, "Sam");

    expect(() =>
      createRoom(repository, {
        season,
        initialRosters: [
          { teamId: camTeam.id, playerName: "Puka Nacua", position: "WR", price: 10 },
          { teamId: samTeam.id, playerName: "Puka Nacua", position: "WR", price: 11 },
        ],
      }),
    ).toThrow(new LiveDraftRoomError("duplicate_player", "Puka Nacua is already unavailable."));
  });

  it("rejects initial roster players for unknown teams", () => {
    const repository = new InMemoryLiveDraftRoomRepository();

    expect(() =>
      createRoom(repository, {
        initialRosters: [
          { teamId: "team_missing", playerName: "Puka Nacua", position: "WR", price: 10 },
        ],
      }),
    ).toThrow(new LiveDraftRoomError("team_not_found", "Unknown team \"team_missing\"."));
  });

  it("rejects non-positive and non-whole-dollar initial roster prices", () => {
    const season = publishedSeason();
    const camTeam = teamByOwner(season, "Cam");
    const invalidPlayers = [
      { playerName: "Puka Nacua", price: 0 },
      { playerName: "Xavier Legette", price: 1.5 },
    ] as const;

    for (const player of invalidPlayers) {
      const repository = new InMemoryLiveDraftRoomRepository();
      expect(() =>
        createRoom(repository, {
          season,
          initialRosters: [
            { teamId: camTeam.id, playerName: player.playerName, position: "WR", price: player.price },
          ],
        }),
      ).toThrow(new LiveDraftRoomError(
        "invalid_sale_price",
        `Initial roster price must be a positive whole-dollar amount for ${player.playerName}.`,
      ));
    }
  });

  it("rejects initial rosters that exceed the roster size", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const season = publishedSeason();
    const camTeam = teamByOwner(season, "Cam");
    const playerPositions = [
      "QB", "QB", "QB",
      "RB", "RB", "RB", "RB", "RB", "RB",
      "WR", "WR", "WR", "WR",
      "TE", "TE",
      "K",
      "DST",
    ] as const;

    expect(() =>
      createRoom(repository, {
        season,
        initialRosters: playerPositions.map((position, index) => ({
          teamId: camTeam.id,
          playerName: `Initial Player ${index + 1}`,
          position,
          price: 1,
        })),
      }),
    ).toThrow(new LiveDraftRoomError("roster_full", "Cam has no open roster slots."));
  });

  it("rejects initial rosters that exceed a position maximum", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const season = publishedSeason();
    const camTeam = teamByOwner(season, "Cam");

    expect(() =>
      createRoom(repository, {
        season,
        initialRosters: [
          { teamId: camTeam.id, playerName: "WR One", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Two", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Three", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Four", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Five", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Six", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Seven", position: "WR", price: 1 },
        ],
      }),
    ).toThrow(new LiveDraftRoomError(
      "position_limit",
      "Cam cannot roster WR Seven: roster limit is 6 WRs.",
    ));
  });

  it("rejects initial roster players above the team's max bid", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const season = publishedSeason();
    const camTeam = teamByOwner(season, "Cam");

    expect(() =>
      createRoom(repository, {
        season,
        initialRosters: [
          { teamId: camTeam.id, playerName: "Puka Nacua", position: "WR", price: 190 },
        ],
      }),
    ).toThrow(new LiveDraftRoomError(
      "max_bid_exceeded",
      "Cam cannot roster Puka Nacua for $190: max bid is $185.",
    ));
  });

  it("rejects sales for players already on initial rosters", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const camTeam = teamByOwner(publishedSeason(), "Cam");
    createRoom(repository, {
      initialRosters: [
        { teamId: camTeam.id, playerName: "De'Von Achane", position: "RB", price: 50 },
      ],
    });
    startRoom(repository);

    expect(() =>
      repository.logSaleCommand({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 2,
        idempotencyKey: "sale:achane:51",
        sale: "sam achane 51",
        now: new Date(now.getTime() + 2_000),
      }),
    ).toThrow(new LiveDraftRoomError("duplicate_player", "De'Von Achane is already unavailable."));
  });

  it("rejects position maximum overages with user-facing copy", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const camTeam = teamByOwner(publishedSeason(), "Cam");
    createRoom(repository, {
      initialRosters: [
        { teamId: camTeam.id, playerName: "WR One", position: "WR", price: 1 },
        { teamId: camTeam.id, playerName: "WR Two", position: "WR", price: 1 },
        { teamId: camTeam.id, playerName: "WR Three", position: "WR", price: 1 },
        { teamId: camTeam.id, playerName: "WR Four", position: "WR", price: 1 },
        { teamId: camTeam.id, playerName: "WR Five", position: "WR", price: 1 },
        { teamId: camTeam.id, playerName: "WR Six", position: "WR", price: 1 },
      ],
    });
    startRoom(repository);

    expect(() =>
      repository.logSaleCommand({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 2,
        idempotencyKey: "sale:legette:2",
        sale: "cam legette 2",
        now: new Date(now.getTime() + 2_000),
      }),
    ).toThrow(new LiveDraftRoomError(
      "position_limit",
      "Cam cannot buy Xavier Legette: roster limit is 6 WRs.",
    ));
  });

  it("rejects sales above the owner's max bid", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);
    startRoom(repository);

    expect(() =>
      repository.logSaleCommand({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 2,
        idempotencyKey: "sale:puka:190",
        sale: "cam puka 190",
        now: new Date(now.getTime() + 2_000),
      }),
    ).toThrow(new LiveDraftRoomError(
      "max_bid_exceeded",
      "Cam cannot buy Puka Nacua for $190: max bid is $185.",
    ));
  });

  it("denies member mutations and stale revisions", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);

    expect(() =>
      repository.startRoom({
        roomId: "room_sunday",
        actor: member,
        expectedRevision: 1,
        now: new Date(now.getTime() + 1_000),
      }),
    ).toThrow(new LiveDraftRoomError("mutation_denied", "Only the commissioner or league admins can change this draft room."));

    expect(() =>
      repository.startRoom({
        roomId: "room_sunday",
        actor: nonMember,
        expectedRevision: 1,
        now: new Date(now.getTime() + 1_000),
      }),
    ).toThrow(new LiveDraftRoomError("mutation_denied", "Only the commissioner or league admins can change this draft room."));

    expect(() =>
      repository.startRoom({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 0,
        idempotencyKey: "start:room_sunday:stale",
        now: new Date(now.getTime() + 1_000),
      }),
    ).toThrow(new LiveDraftRoomError(
      "stale_revision",
      "Draft room changed since this action was prepared. Refresh and try again.",
    ));
  });

  it("undoes the last sale and ends the room", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);
    startRoom(repository);
    repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:62",
      sale: "cam puka 62",
      now: new Date(now.getTime() + 2_000),
    });

    const undone = repository.undoLastSale({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 3,
      idempotencyKey: "undo:puka:62",
      now: new Date(now.getTime() + 3_000),
    });

    expect(undone.revision).toBe(4);
    expect(undone.projection.sales).toEqual([]);
    expect(undone.projection.teams.find(team => team.ownerDisplayName === "Cam")).toMatchObject({
      spent: 0,
      budgetRemaining: 200,
      maxBid: 185,
    });
    expect(undone.projection.board.map(player => player.name)).toContain("Puka Nacua");
    expect(undone.events.map(event => event.type)).toEqual([
      "room_created",
      "room_started",
      "sale_logged",
      "sale_undone",
    ]);

    const ended = repository.endRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 4,
      idempotencyKey: "end:room_sunday",
      now: new Date(now.getTime() + 4_000),
    });

    expect(ended.status).toBe("ended");
    expect(ended.revision).toBe(5);
    expect(ended.events.at(-1)).toMatchObject({ type: "room_ended", revision: 5 });
  });
});
