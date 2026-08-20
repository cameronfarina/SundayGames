import { describe, expect, it, vi } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../src/platform/leagueSeason.js";
import {
  InMemoryLiveDraftRoomRepository,
  type LiveDraftRoom,
  type LiveDraftRoomPlayerCatalogEntry,
} from "../src/platform/liveDraftRooms.js";
import {
  buildLiveDraftRoomReadModel,
  buildLiveDraftRoomSseEvent,
  buildLiveDraftRoomSnapshotEvent,
  formatLiveDraftRoomSsePayloads,
  liveDraftRoomEventsAfterRevision,
  type LiveDraftRoomStreamActor,
} from "../src/platform/liveDraftRoomStream.js";
import { createLiveDraftRoomEventStream } from "../src/platform/liveDraftRoomEventStream.js";

const now = new Date("2026-08-09T12:00:00.000Z");
const commissioner = { userId: "user_commish", leagueId: "league-100001", role: "admin" } as const;
const member = { userId: "user_seth", leagueId: "league-100001", role: "member" } as const;
const observer = { userId: "user_observer", leagueId: "league-100001", role: "observer" } as const;

const playerCatalog = [
  { name: "Puka Nacua", position: "WR", expectedPrice: 73, teamAbbreviation: "LAR", byeWeek: 8 },
  { name: "Amon-Ra St. Brown", position: "WR", expectedPrice: 67, teamAbbreviation: "DET", byeWeek: 8 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72, teamAbbreviation: "DET", byeWeek: 8 },
  { name: "Trevor Lawrence", position: "QB", expectedPrice: 9, teamAbbreviation: "JAC", byeWeek: 8 },
] as const satisfies readonly LiveDraftRoomPlayerCatalogEntry[];

const publishedSeason = (): LeagueSeason =>
  buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    setupStatus: "published",
    leagueName: "Sunday league",
  });

const createRoom = (repository = new InMemoryLiveDraftRoomRepository()): LiveDraftRoom => {
  const season = publishedSeason();
  const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
  if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");

  return repository.createRoom({
    season,
    roomId: "room_sunday",
    commissionerUserId: commissioner.userId,
    viewerPasswordHashRef: "viewer-password-hash",
    playerCatalog,
    initialRosters: [
      {
        teamId: camTeam.id,
        playerName: "De'Von Achane",
        position: "RB",
        price: 50,
        expectedPrice: 50,
      },
    ],
    createdAt: now,
  });
};

const buildLiveRoom = (): LiveDraftRoom => {
  const repository = new InMemoryLiveDraftRoomRepository();
  createRoom(repository);
  repository.startRoom({
    roomId: "room_sunday",
    actor: commissioner,
    expectedRevision: 1,
    idempotencyKey: "start:room_sunday",
    now: new Date(now.getTime() + 1_000),
  });
  repository.logSaleCommand({
    roomId: "room_sunday",
    actor: commissioner,
    expectedRevision: 2,
    idempotencyKey: "sale:puka:62",
    sale: "owner11 puka 62",
    now: new Date(now.getTime() + 2_000),
  });

  return repository.endRoom({
    roomId: "room_sunday",
    actor: commissioner,
    expectedRevision: 3,
    idempotencyKey: "end:room_sunday",
    allowIncomplete: true,
    now: new Date(now.getTime() + 3_000),
  });
};

const actorWithTeam = (
  actor: typeof commissioner | typeof member | typeof observer,
  teamId: string | undefined,
): LiveDraftRoomStreamActor => ({
  ...actor,
  ...(teamId === undefined ? {} : { teamId }),
});

describe("live draft room stream contract", () => {
  it("keeps one stream open for snapshots, heartbeats, ordered updates, and abort cleanup", async () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    let room = createRoom(repository);
    const controller = new AbortController();
    const waitForRevision = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const close = vi.fn();
    const stream = createLiveDraftRoomEventStream({
      initialRoom: buildLiveDraftRoomReadModel({ room, actor: commissioner }),
      loadUpdate: async afterRevision => ({
        events: liveDraftRoomEventsAfterRevision({ room, actor: commissioner, afterRevision }),
        room: buildLiveDraftRoomReadModel({ room, actor: commissioner }),
      }),
      subscription: { close, waitForRevision },
      signal: controller.signal,
      heartbeatMilliseconds: 10,
    });
    const iterator = stream[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toMatchObject({
      done: false,
      value: expect.stringContaining("event: room.snapshot\n"),
    });
    await expect(iterator.next()).resolves.toEqual({ done: false, value: ": keep-alive\n\n" });

    room = repository.startRoom({
      roomId: room.roomId,
      actor: commissioner,
      expectedRevision: room.revision,
      idempotencyKey: "start:persistent-stream",
      now: new Date(now.getTime() + 1_000),
    });
    const update = await iterator.next();
    expect(update).toMatchObject({
      done: false,
      value: expect.stringContaining("event: room.started\n"),
    });
    expect(update.value).toContain('"revision":2');
    expect(update.value).toContain('"board"');

    controller.abort();
    await expect(iterator.next()).resolves.toEqual({ done: true, value: undefined });
    expect(waitForRevision).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledOnce();
  });

  it("discovers a newer room revision after the local notifier times out", async () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    let room = createRoom(repository);
    const controller = new AbortController();
    const close = vi.fn();
    const stream = createLiveDraftRoomEventStream({
      initialRoom: buildLiveDraftRoomReadModel({ room, actor: commissioner }),
      loadUpdate: async afterRevision => ({
        events: liveDraftRoomEventsAfterRevision({ room, actor: commissioner, afterRevision }),
        room: buildLiveDraftRoomReadModel({ room, actor: commissioner }),
      }),
      subscription: { close, waitForRevision: vi.fn().mockResolvedValue(false) },
      signal: controller.signal,
      heartbeatMilliseconds: 10,
    });
    const iterator = stream[Symbol.asyncIterator]();

    await iterator.next();
    room = repository.startRoom({
      roomId: room.roomId,
      actor: commissioner,
      expectedRevision: room.revision,
      idempotencyKey: "start:other-process",
      now: new Date(now.getTime() + 1_000),
    });

    const update = await iterator.next();
    expect(update).toMatchObject({
      done: false,
      value: expect.stringContaining("event: room.started\n"),
    });
    expect(update.value).toContain('"revision":2');

    controller.abort();
    await expect(iterator.next()).resolves.toEqual({ done: true, value: undefined });
    expect(close).toHaveBeenCalledOnce();
  });

  it("builds role-aware snapshots with selected/viewed teams, shared room state, and export readiness", () => {
    const room = buildLiveRoom();
    const camTeam = room.projection.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = room.projection.teams.find(team => team.ownerDisplayName === "Owner04");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    const commissionerModel = buildLiveDraftRoomReadModel({
      room,
      actor: actorWithTeam(commissioner, camTeam.teamId),
      selectedTeamId: sethTeam.teamId,
    });
    const memberModel = buildLiveDraftRoomReadModel({
      room,
      actor: actorWithTeam(member, sethTeam.teamId),
      selectedTeamId: camTeam.teamId,
      viewedTeamId: camTeam.teamId,
    });
    const observerModel = buildLiveDraftRoomReadModel({
      room,
      actor: observer,
      viewedTeamId: camTeam.teamId,
    });

    expect(commissionerModel.role).toBe("commissioner");
    expect(commissionerModel.canMutateRoom).toBe(true);
    expect(commissionerModel.canExportDraft).toBe(true);
    expect(commissionerModel.selectedTeam?.teamId).toBe(sethTeam.teamId);
    expect(commissionerModel.viewedTeam?.teamId).toBe(sethTeam.teamId);
    expect(memberModel.role).toBe("member");
    expect(memberModel.canMutateRoom).toBe(false);
    expect(memberModel.selectedTeam?.teamId).toBe(sethTeam.teamId);
    expect(memberModel.viewedTeam?.teamId).toBe(camTeam.teamId);
    expect(memberModel.connection).toEqual({
      state: "synchronized",
      transport: "sse",
      cursor: "room_sunday:4",
      revision: 4,
      retryMilliseconds: 5_000,
      pollingFallback: true,
    });
    expect(observerModel.role).toBe("observer");
    expect(observerModel.selectedTeam).toBeUndefined();
    expect(observerModel.viewedTeam?.teamId).toBe(camTeam.teamId);

    expect(memberModel).toMatchObject({
      roomId: "room_sunday",
      leagueId: "league-100001",
      seasonId: "league-100001-season-2026",
      status: "ended",
      revision: 4,
      board: expect.arrayContaining([
        expect.objectContaining({ name: "Amon-Ra St. Brown", expectedPrice: 67 }),
      ]),
      salesLog: [
        expect.objectContaining({
          revision: 3,
          playerName: "Puka Nacua",
          ownerDisplayName: "Owner11",
          price: 62,
        }),
      ],
      exportReadiness: {
        status: "blocked",
        blockers: expect.arrayContaining([
          "Owner01 has 16 open roster slots.",
          "Owner11 has 14 open roster slots.",
        ]),
      },
    });
    expect(memberModel.teamSummaries.find(team => team.ownerDisplayName === "Owner11")).toMatchObject({
      spent: 112,
      budgetRemaining: 88,
      rosterSlotsRemaining: 14,
      maxBid: 75,
    });
    expect(memberModel.board.map(player => player.name)).not.toContain("Puka Nacua");
  });

  it("does not expose private strategy or prep fields in snapshots", () => {
    const room = {
      ...buildLiveRoom(),
      privatePrepArtifacts: [{ strategy: "stars", maxBidOverlay: 99 }],
      strategy: { hardLocks: ["Puka Nacua"] },
      notes: "draft night note",
      shortlist: ["Amon-Ra St. Brown"],
    } as LiveDraftRoom & Record<string, unknown>;

    const snapshot = buildLiveDraftRoomSnapshotEvent({
      room,
      actor: actorWithTeam(member, "league-100001-team-02"),
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.event).toBe("room.snapshot");
    expect(serialized).not.toContain("privatePrepArtifacts");
    expect(serialized).not.toContain("strategy");
    expect(serialized).not.toContain("maxBidOverlay");
    expect(serialized).not.toContain("shortlist");
    expect(serialized).not.toContain("draft night note");
    expect(serialized).not.toContain("viewerPasswordHashRef");
  });

  it("generates revisioned SSE payloads for sale, start, end, and snapshot events", () => {
    const room = buildLiveRoom();
    const events = room.events.map(event => buildLiveDraftRoomSseEvent({ room, event, actor: commissioner }));

    expect(buildLiveDraftRoomSnapshotEvent({ room, actor: commissioner })).toMatchObject({
      id: "room_sunday:4:snapshot",
      event: "room.snapshot",
      revision: 4,
      retry: 5_000,
      data: expect.objectContaining({ revision: 4, status: "ended" }),
    });
    expect(events.map(event => event.event)).toEqual([
      "room.snapshot",
      "room.started",
      "room.sale",
      "room.ended",
    ]);
    expect(events[1]).toMatchObject({
      id: "room_sunday:2",
      revision: 2,
      data: expect.objectContaining({ status: "live" }),
    });
    expect(events[2]).toMatchObject({
      id: "room_sunday:3",
      revision: 3,
      data: expect.objectContaining({
        sale: expect.objectContaining({
          playerName: "Puka Nacua",
          price: 62,
        }),
      }),
    });
    expect(events[3]).toMatchObject({
      id: "room_sunday:4",
      revision: 4,
      data: expect.objectContaining({ status: "ended" }),
    });
  });

  it("streams keeper synchronization as a fresh room snapshot", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const created = createRoom(repository);
    const camTeam = created.season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");
    const synchronized = repository.synchronizeInitialRostersForSeason({
      seasonId: created.seasonId,
      actor: commissioner,
      initialRosters: [{
        teamId: camTeam.id,
        playerName: "Puka Nacua",
        position: "WR",
        price: 40,
        source: "keeper",
      }],
      playerCatalog: playerCatalog.map(player => ({
        ...player,
        expectedPrice: player.name === "Jahmyr Gibbs" ? 84 : player.expectedPrice,
      })),
      idempotencyKey: "keepers:stream-version-1",
      now: new Date(now.getTime() + 1_000),
    });
    const event = synchronized?.events.at(-1);
    if (synchronized === null || event === undefined) throw new Error("Expected synchronized room fixture.");

    const snapshotEvent = buildLiveDraftRoomSseEvent({ room: synchronized, event, actor: commissioner });
    expect(snapshotEvent).toMatchObject({
      event: "room.snapshot",
      revision: 2,
      data: {
        revision: 2,
        board: expect.arrayContaining([
          expect.objectContaining({ name: "Jahmyr Gibbs", expectedPrice: 84 }),
        ]),
        teamSummaries: expect.arrayContaining([
          expect.objectContaining({
            teamId: camTeam.id,
            spent: 40,
            budgetRemaining: 160,
            rosterSlotsRemaining: 15,
            roster: [expect.objectContaining({ name: "Puka Nacua", source: "keeper" })],
          }),
        ]),
      },
    });
    if (snapshotEvent.event !== "room.snapshot") throw new Error("Expected room snapshot event.");
    expect(snapshotEvent.data.board.map(player => player.name)).not.toContain("Puka Nacua");
    expect(liveDraftRoomEventsAfterRevision({
      room: synchronized,
      actor: commissioner,
      afterRevision: 1,
    })).toMatchObject({
      currentRevision: 2,
      requiresSnapshot: true,
      events: [expect.objectContaining({ event: "room.snapshot", revision: 2 })],
    });
  });

  it("streams correction snapshots and pause/resume status events with the active replacement sale", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);
    repository.startRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 1,
      idempotencyKey: "start:correction-room",
      now: new Date(now.getTime() + 1_000),
    });
    const sold = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:correction-room",
      sale: "owner11 puka 62",
      now: new Date(now.getTime() + 2_000),
    });
    const originalSale = sold.projection.sales[0];
    if (originalSale === undefined) throw new Error("Expected original sale fixture.");
    const corrected = repository.correctSale({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 3,
      idempotencyKey: "correct:correction-room",
      saleEventId: originalSale.saleEventId,
      replacementSale: "owner04 puka 41",
      now: new Date(now.getTime() + 3_000),
    });
    const paused = repository.pauseRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 4,
      idempotencyKey: "pause:correction-room",
      now: new Date(now.getTime() + 4_000),
    });
    const resumed = repository.resumeRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 5,
      idempotencyKey: "resume:correction-room",
      now: new Date(now.getTime() + 5_000),
    });

    expect(buildLiveDraftRoomReadModel({ room: corrected, actor: commissioner }).salesLog).toEqual([
      expect.objectContaining({
        revision: 4,
        ownerDisplayName: "Owner04",
        playerName: "Puka Nacua",
        price: 41,
      }),
    ]);
    expect([
      corrected.events.at(-1),
      paused.events.at(-1),
      resumed.events.at(-1),
    ].map(event => {
      if (event === undefined) throw new Error("Expected lifecycle event fixture.");
      return buildLiveDraftRoomSseEvent({ room: resumed, event, actor: commissioner });
    })).toMatchObject([
      { event: "room.snapshot", revision: 4 },
      { event: "room.paused", revision: 5, data: { status: "paused" } },
      { event: "room.resumed", revision: 6, data: { status: "live" } },
    ]);
  });

  it("returns next events after a stale client revision for polling fallback", () => {
    const room = buildLiveRoom();

    const nextEvents = liveDraftRoomEventsAfterRevision({
      room,
      actor: commissioner,
      afterRevision: 1,
    });

    expect(nextEvents.isStale).toBe(true);
    expect(nextEvents.currentRevision).toBe(4);
    expect(nextEvents.events.map(event => event.event)).toEqual([
      "room.started",
      "room.sale",
      "room.ended",
    ]);
    expect(nextEvents.events.map(event => event.revision)).toEqual([2, 3, 4]);
  });

  it("replays retained events in revision order when storage returns them out of order", () => {
    const room = buildLiveRoom();
    const roomWithUnorderedEvents: LiveDraftRoom = {
      ...room,
      events: [...room.events].reverse(),
    };

    const nextEvents = liveDraftRoomEventsAfterRevision({
      room: roomWithUnorderedEvents,
      actor: commissioner,
      afterRevision: 1,
    });

    expect(nextEvents.requiresSnapshot).toBe(false);
    expect(nextEvents.events.map(event => event.event)).toEqual([
      "room.started",
      "room.sale",
      "room.ended",
    ]);
    expect(nextEvents.events.map(event => event.revision)).toEqual([2, 3, 4]);
  });

  it("formats revisioned events as EventSource-compatible SSE text", () => {
    const room = buildLiveRoom();
    const nextEvents = liveDraftRoomEventsAfterRevision({
      room,
      actor: commissioner,
      afterRevision: 2,
    });

    const sseText = formatLiveDraftRoomSsePayloads(nextEvents.events);

    expect(sseText).toContain("id: room_sunday:3\nevent: room.sale\n");
    expect(sseText).toContain("id: room_sunday:4\nevent: room.ended\n");
    expect(sseText).toContain("data: {\"roomId\":\"room_sunday\"");
    expect(sseText).toContain("\"playerName\":\"Puka Nacua\"");
    expect(sseText.endsWith("\n\n")).toBe(true);
    expect(formatLiveDraftRoomSsePayloads([])).toBe(": keep-alive\n\n");
  });

  it("returns the current snapshot when a polling client has no revision", () => {
    const room = buildLiveRoom();

    const nextEvents = liveDraftRoomEventsAfterRevision({
      room,
      actor: commissioner,
      afterRevision: 0,
    });

    expect(nextEvents).toMatchObject({
      isStale: true,
      requiresSnapshot: true,
      currentRevision: 4,
      events: [
        expect.objectContaining({
          event: "room.snapshot",
          revision: 4,
          data: expect.objectContaining({ revision: 4, status: "ended" }),
        }),
      ],
    });
  });

  it("returns a snapshot reset event when the client revision is older than retained room events", () => {
    const room = buildLiveRoom();
    const compactedRoom = {
      ...room,
      events: room.events.filter(event => event.revision >= 3),
    };

    const nextEvents = liveDraftRoomEventsAfterRevision({
      room: compactedRoom,
      actor: commissioner,
      afterRevision: 1,
    });

    expect(nextEvents.isStale).toBe(true);
    expect(nextEvents.requiresSnapshot).toBe(true);
    expect(nextEvents.events).toEqual([
      expect.objectContaining({
        event: "room.snapshot",
        revision: 4,
        data: expect.objectContaining({ revision: 4 }),
      }),
    ]);
  });

  it("returns a snapshot reset event when retained room events do not reach the current revision", () => {
    const room = buildLiveRoom();
    const compactedRoom = {
      ...room,
      events: room.events.filter(event => event.revision === 2),
    };

    const nextEvents = liveDraftRoomEventsAfterRevision({
      room: compactedRoom,
      actor: commissioner,
      afterRevision: 1,
    });

    expect(nextEvents.isStale).toBe(true);
    expect(nextEvents.requiresSnapshot).toBe(true);
    expect(nextEvents.events).toEqual([
      expect.objectContaining({
        event: "room.snapshot",
        revision: 4,
        data: expect.objectContaining({ revision: 4 }),
      }),
    ]);
  });

  it("returns a current snapshot when missed events include an undo reset", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);
    repository.startRoom({
    roomId: "room_sunday",
    actor: commissioner,
    expectedRevision: 1,
    idempotencyKey: "start:room_sunday",
    now: new Date(now.getTime() + 1_000),
  });
  repository.logSaleCommand({
    roomId: "room_sunday",
    actor: commissioner,
    expectedRevision: 2,
    idempotencyKey: "sale:puka:62",
    sale: "owner11 puka 62",
    now: new Date(now.getTime() + 2_000),
  });
    const room = repository.undoLastSale({
    roomId: "room_sunday",
    actor: commissioner,
    expectedRevision: 3,
    idempotencyKey: "undo:puka:62",
    now: new Date(now.getTime() + 3_000),
  });

    const nextEvents = liveDraftRoomEventsAfterRevision({
      room,
      actor: commissioner,
      afterRevision: 3,
    });

    expect(nextEvents.requiresSnapshot).toBe(true);
    expect(nextEvents.events).toEqual([
      expect.objectContaining({
        event: "room.snapshot",
        revision: 4,
        data: expect.objectContaining({
          revision: 4,
          board: expect.arrayContaining([
            expect.objectContaining({ name: "Puka Nacua" }),
          ]),
          salesLog: [],
        }),
      }),
    ]);
  });

  it("returns no events for current revisions and an error payload for future revisions", () => {
    const room = buildLiveRoom();

    expect(liveDraftRoomEventsAfterRevision({
      room,
      actor: commissioner,
      afterRevision: room.revision,
    })).toMatchObject({
      isStale: false,
      requiresSnapshot: false,
      currentRevision: room.revision,
      events: [],
    });

    expect(liveDraftRoomEventsAfterRevision({
      room,
      actor: commissioner,
      afterRevision: room.revision + 1,
    })).toMatchObject({
      isStale: true,
      requiresSnapshot: true,
      currentRevision: room.revision,
      events: [
        expect.objectContaining({
          event: "room.error",
          revision: room.revision,
          data: expect.objectContaining({
            code: "future_revision",
            currentRevision: room.revision,
          }),
        }),
      ],
    });
  });
});
