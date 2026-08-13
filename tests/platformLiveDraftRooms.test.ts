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

const multiwordTeamSeason = (): LeagueSeason => {
  const season = publishedSeason();

  return {
    ...season,
    teams: season.teams.map(team => {
      if (team.ownerDisplayName === "Cam") {
        return { ...team, ownerDisplayName: "Cam Audit", displayName: "Audit Aces" };
      }
      if (team.ownerDisplayName === "Sam") {
        return { ...team, ownerDisplayName: "Sam Audit", displayName: "Audit Angels" };
      }

      return team;
    }),
  };
};

const publishedSnakeSeason = (): LeagueSeason => {
  const season = publishedSeason();

  return {
    ...season,
    settings: {
      expectedTeamCount: season.settings.expectedTeamCount,
      draftFormat: "snake",
      scoring: season.settings.scoring,
      snake: {
        rounds: season.settings.roster.rosterSize,
        order: season.teams.map(team => team.id),
        reversal: "standard",
      },
      roster: season.settings.roster,
      keeperPolicy: season.settings.keeperPolicy,
    },
  };
};

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
  it("rejects snake hosted rooms before storing a room or creation event", () => {
    const repository = new InMemoryLiveDraftRoomRepository();

    expect(() => createRoom(repository, {
      season: publishedSnakeSeason(),
      roomId: "room_snake",
    })).toThrow(new LiveDraftRoomError(
      "snake_live_room_unavailable",
      "Hosted live rooms currently support auction drafts. Use Mock Draft for this snake league.",
    ));
    expect(repository.rooms()).toEqual([]);
  });

  it("cancels only setup rooms and unlocks their season for replacement", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const room = createRoom(repository);
    const cancellation = {
      roomId: room.roomId,
      actor: commissioner,
      expectedRevision: room.revision,
      idempotencyKey: "cancel:room_sunday",
      now: new Date(now.getTime() + 1_000),
    } as const;

    expect(repository.hasRoomForSeason(room.seasonId)).toBe(true);
    expect(repository.cancelRoom(cancellation)).toBeUndefined();
    expect(repository.hasRoomForSeason(room.seasonId)).toBe(false);
    expect(repository.rooms()).toEqual([]);
    expect(() => repository.getRoom(room.roomId)).toThrow(new LiveDraftRoomError(
      "room_not_found",
      'Live draft room "room_sunday" was not found.',
    ));

    expect(repository.cancelRoom(cancellation)).toBeUndefined();
    expect(createRoom(repository)).toMatchObject({ roomId: room.roomId, seasonId: room.seasonId });
  });

  it("authorizes setup-room cancellation and preserves revision checks", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const room = createRoom(repository);

    expect(() => repository.cancelRoom({
      roomId: room.roomId,
      actor: member,
      expectedRevision: room.revision,
      idempotencyKey: "cancel:member",
    })).toThrow(new LiveDraftRoomError(
      "mutation_denied",
      "Only the commissioner or league admins can change this draft room.",
    ));
    expect(() => repository.cancelRoom({
      roomId: room.roomId,
      actor: commissioner,
      expectedRevision: room.revision - 1,
      idempotencyKey: "cancel:stale",
    })).toThrow(new LiveDraftRoomError(
      "stale_revision",
      "Draft room changed since this action was prepared. Refresh and try again.",
    ));
    expect(repository.cancelRoom({
      roomId: room.roomId,
      actor: { ...commissioner, role: "member" },
      expectedRevision: room.revision,
      idempotencyKey: "cancel:commissioner",
    })).toBeUndefined();
    expect(repository.hasRoomForSeason(room.seasonId)).toBe(false);
  });

  it("allows cancellation during countdown but rejects it after a start event", () => {
    const countdownRepository = new InMemoryLiveDraftRoomRepository();
    const countdownRoom = createRoom(countdownRepository, {
      startsAt: new Date(now.getTime() + 60_000),
    });

    expect(countdownRepository.cancelRoom({
      roomId: countdownRoom.roomId,
      actor: commissioner,
      expectedRevision: countdownRoom.revision,
      idempotencyKey: "cancel:countdown",
    })).toBeUndefined();
    expect(countdownRepository.hasRoomForSeason(countdownRoom.seasonId)).toBe(false);

    const liveRepository = new InMemoryLiveDraftRoomRepository();
    createRoom(liveRepository);
    const started = startRoom(liveRepository);

    expect(() => liveRepository.cancelRoom({
      roomId: started.roomId,
      actor: commissioner,
      expectedRevision: started.revision,
      idempotencyKey: "cancel:started",
    })).toThrow(new LiveDraftRoomError(
      "room_not_cancellable",
      "Only a draft room that has never started can be cancelled.",
    ));
    expect(liveRepository.hasRoomForSeason(started.seasonId)).toBe(true);
  });

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
    expect(() => createRoom(repository, { roomId: "room_same_season" })).toThrow(
      new LiveDraftRoomError(
        "room_already_exists",
        'A live draft room already exists for season "league-214674-season-2026".',
      ),
    );

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

  it("atomically synchronizes keeper rosters and recalibrated player values into an unopened room", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const season = publishedSeason();
    const camTeam = teamByOwner(season, "Cam");
    const room = createRoom(repository, { season });
    const recalibratedCatalog = playerCatalog.map(player => ({
      ...player,
      expectedPrice: player.name === "Jahmyr Gibbs" ? 88 : player.expectedPrice,
    }));
    const initialRosters = [{
      teamId: camTeam.id,
      playerId: "devon achane",
      playerName: "De'Von Achane",
      position: "RB" as const,
      price: 50,
      expectedPrice: 50,
      source: "keeper" as const,
    }];

    const synchronized = repository.synchronizeInitialRostersForSeason({
      seasonId: season.id,
      actor: commissioner,
      initialRosters,
      playerCatalog: recalibratedCatalog,
      idempotencyKey: "keepers:version-1",
      now: new Date(now.getTime() + 1_000),
    });
    const retried = repository.synchronizeInitialRostersForSeason({
      seasonId: season.id,
      actor: commissioner,
      initialRosters,
      playerCatalog: recalibratedCatalog,
      idempotencyKey: "keepers:version-1",
      now: new Date(now.getTime() + 2_000),
    });

    expect(synchronized).toMatchObject({
      revision: room.revision + 1,
      initialRosters,
      playerCatalog: expect.arrayContaining([
        expect.objectContaining({ name: "Jahmyr Gibbs", expectedPrice: 88 }),
      ]),
      events: [
        { type: "room_created" },
        {
          type: "initial_rosters_synchronized",
          initialRosters,
          playerCatalog: expect.arrayContaining([
            expect.objectContaining({ name: "Jahmyr Gibbs", expectedPrice: 88 }),
          ]),
        },
      ],
    });
    expect(retried).toEqual(synchronized);
    expect(retried?.projection.teams.find(team => team.teamId === camTeam.id)).toMatchObject({
      spent: 50,
      budgetRemaining: 150,
      rosterSlotsRemaining: 15,
      roster: [{ name: "De'Von Achane", price: 50, source: "keeper" }],
    });
    expect(retried?.projection.board.map(player => player.name)).not.toContain("De'Von Achane");
    expect(retried?.projection.board).toContainEqual(expect.objectContaining({
      name: "Jahmyr Gibbs",
      expectedPrice: 88,
    }));

    expect(() => repository.synchronizeInitialRostersForSeason({
      seasonId: season.id,
      actor: commissioner,
      initialRosters,
      playerCatalog,
      idempotencyKey: "keepers:version-1",
      now: new Date(now.getTime() + 3_000),
    })).toThrow(new LiveDraftRoomError(
      "idempotency_conflict",
      "A draft room mutation already exists for this idempotency key with different input.",
    ));

    expect(() => repository.synchronizeInitialRostersForSeason({
      seasonId: season.id,
      actor: commissioner,
      initialRosters: [],
      playerCatalog: [],
      idempotencyKey: "keepers:invalid-catalog",
      now: new Date(now.getTime() + 4_000),
    })).toThrow(new LiveDraftRoomError(
      "player_not_found",
      "Player catalog must contain at least one player.",
    ));
    expect(repository.getRoom(room.roomId)).toEqual(synchronized);
  });

  it("locks keeper roster synchronization after the live draft starts", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const season = publishedSeason();
    createRoom(repository, { season });
    startRoom(repository);

    expect(() => repository.synchronizeInitialRostersForSeason({
      seasonId: season.id,
      actor: commissioner,
      initialRosters: [],
      playerCatalog,
      idempotencyKey: "keepers:too-late",
      now: new Date(now.getTime() + 2_000),
    })).toThrow(new LiveDraftRoomError(
      "room_already_live",
      "Keepers are locked after the live draft starts.",
    ));
  });

  it("rejects empty player catalogs", () => {
    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), { playerCatalog: [] })).toThrow(
      new LiveDraftRoomError("player_not_found", "Player catalog must contain at least one player."),
    );
  });

  it("rejects blank player names", () => {
    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      playerCatalog: [{ name: " \u00a0 ", position: "WR", expectedPrice: 10 }],
    })).toThrow(new LiveDraftRoomError(
      "player_not_found",
      "Player catalog entry 1 must include a non-blank player name.",
    ));
  });

  it("rejects duplicate normalized player names", () => {
    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      playerCatalog: [
        { name: "De'Von Achane", position: "RB", expectedPrice: 50 },
        { name: "Devon Achane", position: "RB", expectedPrice: 49 },
      ],
    })).toThrow(new LiveDraftRoomError(
      "duplicate_player",
      'Player catalog contains duplicate player "De\'Von Achane".',
    ));
  });

  it("rejects duplicate player identities that differ only by a generational suffix", () => {
    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      playerCatalog: [
        { name: "James Cook", position: "RB", expectedPrice: 42 },
        { name: "James Cook III", position: "RB", expectedPrice: 41 },
      ],
    })).toThrow(new LiveDraftRoomError(
      "duplicate_player",
      'Player catalog contains duplicate player "James Cook".',
    ));
  });

  it("rejects unsupported player positions", () => {
    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      playerCatalog: [{
        name: "Taysom Hill",
        // @ts-expect-error Exercises validation of malformed HTTP input.
        position: "FB",
        expectedPrice: 1,
      }],
    })).toThrow(new LiveDraftRoomError(
      "position_limit",
      'Player catalog entry "Taysom Hill" has unsupported position "FB".',
    ));
  });

  it.each([
    { expectedPrice: Number.NaN, label: "NaN" },
    { expectedPrice: Number.POSITIVE_INFINITY, label: "Infinity" },
    { expectedPrice: 1.5, label: "a fractional value" },
    { expectedPrice: 0, label: "$0" },
  ])("rejects $label expected prices", ({ expectedPrice }) => {
    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      playerCatalog: [{ name: "Puka Nacua", position: "WR", expectedPrice }],
    })).toThrow(new LiveDraftRoomError(
      "invalid_sale_price",
      'Player catalog entry "Puka Nacua" must have an expected price of at least $1 in whole dollars.',
    ));
  });

  it.each(["", "lar", "TOOLONG"])(
    "rejects malformed team abbreviation %j",
    teamAbbreviation => {
      expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
        playerCatalog: [{
          name: "Puka Nacua",
          position: "WR",
          expectedPrice: 73,
          teamAbbreviation,
        }],
      })).toThrow(new LiveDraftRoomError(
        "player_not_found",
        'Player catalog entry "Puka Nacua" must use a 2-3 letter uppercase team abbreviation.',
      ));
    },
  );

  it.each([Number.NaN, 0, 1.5, 19])("rejects malformed bye week %s", byeWeek => {
    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      playerCatalog: [{ name: "Puka Nacua", position: "WR", expectedPrice: 73, byeWeek }],
    })).toThrow(new LiveDraftRoomError(
      "player_not_found",
      'Player catalog entry "Puka Nacua" must use a whole-number bye week from 1 through 18.',
    ));
  });

  it("requires revision and idempotency metadata for live mutations", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);

    expect(() => repository.cancelRoom({
      roomId: "room_sunday",
      actor: commissioner,
      idempotencyKey: "cancel:missing-revision",
    })).toThrow(new LiveDraftRoomError(
      "expected_revision_required",
      "Draft room mutation requires the current revision.",
    ));

    expect(() => repository.cancelRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 1,
    })).toThrow(new LiveDraftRoomError(
      "idempotency_key_required",
      "Draft room mutation requires an idempotency key.",
    ));

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
      "TE",
      "K",
      "DST",
      "WR",
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

  it("uses hybrid slot eligibility and excludes IR from live draft capacity", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const baseSeason = publishedSeason();
    const hybridSeason: LeagueSeason = {
      ...baseSeason,
      settings: {
        ...baseSeason.settings,
        roster: {
          rosterSize: 7,
          lineup: { QB: 1, OP: 1, RB_WR: 1, WR_TE: 1, FLEX: 1, IR: 2 },
          lineupSlotCount: 7,
          rosterMaximums: { QB: 7, RB: 7, WR: 7, TE: 7, K: 7, DST: 7 },
        },
      },
    };
    const camTeam = teamByOwner(hybridSeason, "Cam");
    const hybridCatalog = [
      { name: "QB One", position: "QB", expectedPrice: 10 },
      { name: "QB Two", position: "QB", expectedPrice: 9 },
      { name: "QB Three", position: "QB", expectedPrice: 8 },
      { name: "RB One", position: "RB", expectedPrice: 7 },
      { name: "WR One", position: "WR", expectedPrice: 6 },
      { name: "TE One", position: "TE", expectedPrice: 5 },
    ] as const satisfies readonly LiveDraftRoomPlayerCatalogEntry[];
    const room = createRoom(repository, {
      season: hybridSeason,
      playerCatalog: hybridCatalog,
      initialRosters: [
        { teamId: camTeam.id, playerName: "QB One", position: "QB", price: 1 },
        { teamId: camTeam.id, playerName: "QB Two", position: "QB", price: 1 },
        { teamId: camTeam.id, playerName: "RB One", position: "RB", price: 1 },
        { teamId: camTeam.id, playerName: "WR One", position: "WR", price: 1 },
        { teamId: camTeam.id, playerName: "TE One", position: "TE", price: 1 },
      ],
    });
    const cam = room.projection.teams.find(team => team.teamId === camTeam.id);

    expect(cam?.rosterSlotsRemaining).toBe(0);
    expect(cam?.slots.map(slot => slot.slot)).toEqual(["QB", "OP", "RB_WR", "WR_TE", "FLEX"]);
    expect(cam?.slots.every(slot => slot.player !== undefined)).toBe(true);

    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      roomId: "room_too_many_qbs",
      season: hybridSeason,
      playerCatalog: hybridCatalog,
      initialRosters: [
        { teamId: camTeam.id, playerName: "QB One", position: "QB", price: 1 },
        { teamId: camTeam.id, playerName: "QB Two", position: "QB", price: 1 },
        { teamId: camTeam.id, playerName: "QB Three", position: "QB", price: 1 },
      ],
    })).toThrow(new LiveDraftRoomError(
      "position_limit",
      "Cam cannot roster QB Three: roster limit is 2 QBs.",
    ));
  });

  it("rejects a roster when two positions compete for the same hybrid slot", () => {
    const baseSeason = publishedSeason();
    const constrainedSeason: LeagueSeason = {
      ...baseSeason,
      settings: {
        ...baseSeason.settings,
        roster: {
          rosterSize: 2,
          lineup: { OP: 1, RB_WR: 1 },
          lineupSlotCount: 2,
          rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 2, DST: 2 },
        },
      },
    };
    const camTeam = teamByOwner(constrainedSeason, "Cam");

    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      season: constrainedSeason,
      playerCatalog: [
        { name: "QB One", position: "QB", expectedPrice: 10 },
        { name: "TE One", position: "TE", expectedPrice: 9 },
      ],
      initialRosters: [
        { teamId: camTeam.id, playerName: "QB One", position: "QB", price: 1 },
        { teamId: camTeam.id, playerName: "TE One", position: "TE", price: 1 },
      ],
    })).toThrow(new LiveDraftRoomError(
      "position_limit",
      "Cam cannot roster TE One: no open roster slot accepts TE.",
    ));
  });

  it("blocks live rooms for seasons with unknown roster slots", () => {
    const baseSeason = publishedSeason();
    const unsupportedSeason: LeagueSeason = {
      ...baseSeason,
      settings: {
        ...baseSeason.settings,
        roster: {
          ...baseSeason.settings.roster,
          lineup: { QB: 1, MYSTERY: 1 },
        },
      },
    };

    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      season: unsupportedSeason,
    })).toThrow(new LiveDraftRoomError(
      "season_not_ready",
      "Roster slot MYSTERY is unsupported. Review the league roster settings before creating a live draft room.",
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

  it("pauses and resumes a live room while freezing sale mutations", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);
    startRoom(repository);

    const pauseInput = {
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "pause:room_sunday",
      now: new Date(now.getTime() + 2_000),
    } as const;
    const paused = repository.pauseRoom(pauseInput);

    expect(paused).toMatchObject({ status: "paused", revision: 3 });
    expect(paused.events.at(-1)).toMatchObject({ type: "room_paused", revision: 3 });
    expect(repository.pauseRoom(pauseInput)).toBe(paused);
    expect(() =>
      repository.logSaleCommand({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 3,
        idempotencyKey: "sale:while-paused",
        sale: "cam puka 62",
      }),
    ).toThrow(new LiveDraftRoomError(
      "room_paused",
      "Resume the draft room before changing sales.",
    ));

    const resumed = repository.resumeRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 3,
      idempotencyKey: "resume:room_sunday",
      now: new Date(now.getTime() + 3_000),
    });

    expect(resumed).toMatchObject({ status: "live", revision: 4 });
    expect(resumed.events.at(-1)).toMatchObject({ type: "room_resumed", revision: 4 });
    expect(repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 4,
      idempotencyKey: "sale:after-resume",
      sale: "cam puka 62",
    }).projection.sales).toHaveLength(1);
  });

  it("corrects an active sale append-only and restores the original when the correction is undone", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);
    startRoom(repository);
    const sold = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:62",
      sale: "cam puka 62",
      now: new Date(now.getTime() + 2_000),
    });
    const originalSale = sold.projection.sales[0];
    if (originalSale === undefined) throw new Error("Expected original sale fixture.");

    const correctionInput = {
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 3,
      idempotencyKey: "correct:puka:seth:41",
      saleEventId: originalSale.saleEventId,
      replacementSale: { ownerText: "Seth", playerName: "Puka Nacua", price: 41 },
      now: new Date(now.getTime() + 3_000),
    } as const;
    const corrected = repository.correctSale(correctionInput);

    expect(corrected).toMatchObject({ status: "live", revision: 4 });
    expect(corrected.events.at(-1)).toMatchObject({
      type: "sale_corrected",
      correctedSaleEventId: originalSale.saleEventId,
      previousSale: expect.objectContaining({ ownerDisplayName: "Cam", price: 62 }),
      replacementSale: expect.objectContaining({ ownerDisplayName: "Seth", price: 41 }),
    });
    expect(corrected.projection.sales).toEqual([
      expect.objectContaining({
        saleEventId: "room_sunday-rev-4-sale_corrected",
        ownerDisplayName: "Seth",
        playerName: "Puka Nacua",
        price: 41,
      }),
    ]);
    expect(corrected.projection.teams.find(team => team.ownerDisplayName === "Cam")?.spent).toBe(0);
    expect(corrected.projection.teams.find(team => team.ownerDisplayName === "Seth")?.spent).toBe(41);
    expect(repository.correctSale(correctionInput)).toBe(corrected);
    expect(() =>
      repository.correctSale({
        ...correctionInput,
        expectedRevision: corrected.revision,
        idempotencyKey: "correct:inactive-original",
      }),
    ).toThrow(new LiveDraftRoomError(
      "sale_not_active",
      "Only an active sale can be corrected.",
    ));

    const restored = repository.undoLastSale({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 4,
      idempotencyKey: "undo:puka:correction",
      now: new Date(now.getTime() + 4_000),
    });

    expect(restored.projection.sales).toEqual([
      expect.objectContaining({
        saleEventId: originalSale.saleEventId,
        ownerDisplayName: "Cam",
        price: 62,
      }),
    ]);
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

    expect(() => repository.endRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 4,
      idempotencyKey: "end:room_sunday:without-override",
      now: new Date(now.getTime() + 4_000),
    })).toThrowError(expect.objectContaining({
      code: "draft_incomplete",
      message: expect.stringMatching(
        /Draft is incomplete: 14 teams have open roster slots: Beaton \(16\).+Cam \(16\)/,
      ),
    }));

    const ended = repository.endRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 4,
      idempotencyKey: "end:room_sunday",
      allowIncomplete: true,
      now: new Date(now.getTime() + 4_000),
    });

    expect(ended.status).toBe("ended");
    expect(ended.revision).toBe(5);
    expect(ended.events.at(-1)).toMatchObject({
      type: "room_ended",
      revision: 5,
      incomplete: true,
      incompleteTeams: expect.arrayContaining([
        expect.objectContaining({
          ownerDisplayName: "Cam",
          openRosterSlots: 16,
        }),
      ]),
    });

    expect(() => repository.reopenRoom({
      roomId: "room_sunday",
      actor: member,
      expectedRevision: 5,
      idempotencyKey: "reopen:member",
    })).toThrow(new LiveDraftRoomError(
      "mutation_denied",
      "Only the commissioner or league admins can change this draft room.",
    ));

    const reopened = repository.reopenRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 5,
      idempotencyKey: "reopen:room_sunday",
      now: new Date(now.getTime() + 5_000),
    });

    expect(reopened).toMatchObject({ status: "paused", revision: 6 });
    expect(reopened.endedAt).toBeUndefined();
    expect(reopened.events.at(-1)).toMatchObject({ type: "room_reopened", revision: 6 });

    const resumed = repository.resumeRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 6,
      idempotencyKey: "resume:reopened-room",
      now: new Date(now.getTime() + 6_000),
    });
    expect(resumed.status).toBe("live");
  });

  it("logs natural-language sales for multiword owner names, team names, and unique aliases", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository, { season: multiwordTeamSeason() });
    startRoom(repository);

    const ownerSale = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:multiword-owner",
      sale: "Cam Audit drafted Puka Nacua for 62",
    });
    const teamSale = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 3,
      idempotencyKey: "sale:multiword-team",
      sale: "Audit Angels drafted Xavier Legette for 2",
    });
    const aliasSale = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 4,
      idempotencyKey: "sale:unique-alias",
      sale: "Cam Aud drafted Amon-Ra St. Brown for 50",
    });

    expect(ownerSale.projection.sales.at(-1)).toMatchObject({
      ownerDisplayName: "Cam Audit",
      teamDisplayName: "Audit Aces",
      playerName: "Puka Nacua",
    });
    expect(teamSale.projection.sales.at(-1)).toMatchObject({
      ownerDisplayName: "Sam Audit",
      teamDisplayName: "Audit Angels",
      playerName: "Xavier Legette",
    });
    expect(aliasSale.projection.sales.at(-1)).toMatchObject({
      ownerDisplayName: "Cam Audit",
      teamDisplayName: "Audit Aces",
      playerName: "Amon-Ra St. Brown",
    });
  });

  it("returns matching teams when a live sale owner or team alias is ambiguous", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository, { season: multiwordTeamSeason() });
    startRoom(repository);

    expect(() => repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:ambiguous-team",
      sale: "Audit drafted Puka Nacua for 62",
    })).toThrow(new LiveDraftRoomError(
      "owner_not_found",
      'Owner or team "Audit" matches multiple teams: Cam Audit - Audit Aces, Sam Audit - Audit Angels.',
    ));
  });
});
