import { describe, expect, it } from "vitest";
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

const now = new Date("2026-08-09T12:00:00.000Z");
const commissioner = { userId: "user_commish", leagueId: "league-214674", role: "admin" } as const;
const member = { userId: "user_seth", leagueId: "league-214674", role: "member" } as const;
const observer = { userId: "user_observer", leagueId: "league-214674", role: "observer" } as const;

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
  const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
  if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

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
    sale: "cam puka 62",
    now: new Date(now.getTime() + 2_000),
  });

  return repository.endRoom({
    roomId: "room_sunday",
    actor: commissioner,
    expectedRevision: 3,
    idempotencyKey: "end:room_sunday",
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
  it("builds role-aware snapshots with selected/viewed teams, shared room state, and export readiness", () => {
    const room = buildLiveRoom();
    const camTeam = room.projection.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = room.projection.teams.find(team => team.ownerDisplayName === "Seth");
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
      leagueId: "league-214674",
      seasonId: "league-214674-season-2026",
      status: "ended",
      revision: 4,
      board: expect.arrayContaining([
        expect.objectContaining({ name: "Amon-Ra St. Brown", expectedPrice: 67 }),
      ]),
      salesLog: [
        expect.objectContaining({
          revision: 3,
          playerName: "Puka Nacua",
          ownerDisplayName: "Cam",
          price: 62,
        }),
      ],
      exportReadiness: {
        status: "ready",
        completedRevision: 4,
        blockers: [],
      },
    });
    expect(memberModel.teamSummaries.find(team => team.ownerDisplayName === "Cam")).toMatchObject({
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
      actor: actorWithTeam(member, "league-214674-team-02"),
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
      sale: "cam puka 62",
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
      replacementSale: "seth puka 41",
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
        ownerDisplayName: "Seth",
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
    sale: "cam puka 62",
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
