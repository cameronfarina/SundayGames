import type {
  LiveDraftRoom,
  LiveDraftRoomActor,
  LiveDraftRoomBoardPlayer,
  LiveDraftRoomEvent,
  LiveDraftRoomRosterPlayer,
  LiveDraftRoomRosterSlot,
  LiveDraftRoomSale,
  LiveDraftRoomStatus,
  LiveDraftRoomTeamState,
} from "./liveDraftRooms.js";

export type LiveDraftRoomViewerRole = "commissioner" | "member" | "observer";
export type LiveDraftRoomExportReadinessStatus = "pending" | "ready" | "blocked";
export type LiveDraftRoomSseEventName =
  | "room.snapshot"
  | "room.sale"
  | "room.started"
  | "room.paused"
  | "room.resumed"
  | "room.ended"
  | "room.error";

export interface LiveDraftRoomStreamActor extends LiveDraftRoomActor {
  teamId?: string | undefined;
  ownerId?: string | undefined;
}

export interface BuildLiveDraftRoomReadModelInput {
  room: LiveDraftRoom;
  actor: LiveDraftRoomStreamActor;
  selectedTeamId?: string | undefined;
  viewedTeamId?: string | undefined;
}

export interface LiveDraftRoomTeamSummary {
  teamId: string;
  ownerId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  draftOrderPosition: number;
  budgetDollars: number;
  spent: number;
  budgetRemaining: number;
  rosterSlotsRemaining: number;
  maxBid: number;
  positionCounts: LiveDraftRoomTeamState["positionCounts"];
  roster: readonly LiveDraftRoomRosterPlayer[];
  slots: readonly LiveDraftRoomRosterSlot[];
}

export interface LiveDraftRoomSaleLogEntry {
  saleEventId: string;
  revision: number;
  occurredAt: string;
  teamId: string;
  ownerId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  playerName: string;
  position: LiveDraftRoomSale["position"];
  price: number;
  expectedPrice: number;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
}

export interface LiveDraftRoomExportReadiness {
  status: LiveDraftRoomExportReadinessStatus;
  completedRevision?: number | undefined;
  blockers: readonly string[];
}

export interface LiveDraftRoomConnectionState {
  state: "synchronized";
  transport: "sse";
  cursor: string;
  revision: number;
  retryMilliseconds: number;
  pollingFallback: true;
}

export interface LiveDraftRoomReadModel {
  roomId: string;
  leagueId: string;
  seasonId: string;
  status: LiveDraftRoomStatus;
  revision: number;
  updatedAt: string;
  role: LiveDraftRoomViewerRole;
  canMutateRoom: boolean;
  canExportDraft: boolean;
  board: readonly LiveDraftRoomBoardPlayer[];
  selectedTeam?: LiveDraftRoomTeamSummary | undefined;
  viewedTeam?: LiveDraftRoomTeamSummary | undefined;
  teamSummaries: readonly LiveDraftRoomTeamSummary[];
  salesLog: readonly LiveDraftRoomSaleLogEntry[];
  connection: LiveDraftRoomConnectionState;
  exportReadiness: LiveDraftRoomExportReadiness;
}

export type LiveDraftRoomSsePayload =
  | {
    id: string;
    event: "room.snapshot";
    revision: number;
    retry: number;
    data: LiveDraftRoomReadModel;
  }
  | {
    id: string;
    event: "room.sale";
    revision: number;
    data: {
      roomId: string;
      leagueId: string;
      seasonId: string;
      status: "live";
      revision: number;
      occurredAt: string;
      actorUserId: string;
      sale: LiveDraftRoomSaleLogEntry;
    };
  }
  | {
    id: string;
    event: "room.started" | "room.paused" | "room.resumed" | "room.ended";
    revision: number;
    data: {
      roomId: string;
      leagueId: string;
      seasonId: string;
      status: "live" | "paused" | "ended";
      revision: number;
      occurredAt: string;
      actorUserId: string;
    };
  }
  | {
    id: string;
    event: "room.error";
    revision: number;
    data: {
      roomId: string;
      leagueId: string;
      seasonId: string;
      code: "future_revision";
      message: string;
      currentRevision: number;
      requestedRevision: number;
    };
  };

export interface BuildLiveDraftRoomSseEventInput {
  room: LiveDraftRoom;
  event: LiveDraftRoomEvent;
  actor: LiveDraftRoomStreamActor;
}

export interface LiveDraftRoomEventsAfterRevisionInput {
  room: LiveDraftRoom;
  actor: LiveDraftRoomStreamActor;
  afterRevision: number;
}

export interface LiveDraftRoomEventsAfterRevisionResult {
  currentRevision: number;
  isStale: boolean;
  requiresSnapshot: boolean;
  events: readonly LiveDraftRoomSsePayload[];
}

const sseRetryMilliseconds = 5_000;
const writerRoles = new Set<LiveDraftRoomActor["role"]>(["owner", "admin"]);

const isoStringFor = (date: Date): string => date.toISOString();

const eventStreamIdFor = (roomId: string, revision: number): string => `${roomId}:${revision}`;

const snapshotStreamIdFor = (room: LiveDraftRoom): string =>
  `${eventStreamIdFor(room.roomId, room.revision)}:snapshot`;

const roleFor = (room: LiveDraftRoom, actor: LiveDraftRoomStreamActor): LiveDraftRoomViewerRole => {
  if (actor.role === "observer") return "observer";
  if (actor.userId === room.commissionerUserId || writerRoles.has(actor.role)) return "commissioner";

  return "member";
};

const canMutateRoomFor = (role: LiveDraftRoomViewerRole): boolean => role === "commissioner";

const teamSummaryFor = (team: LiveDraftRoomTeamState): LiveDraftRoomTeamSummary => ({
  teamId: team.teamId,
  ownerId: team.ownerId,
  ownerDisplayName: team.ownerDisplayName,
  teamDisplayName: team.teamDisplayName,
  draftOrderPosition: team.draftOrderPosition,
  budgetDollars: team.budgetDollars,
  spent: team.spent,
  budgetRemaining: team.budgetRemaining,
  rosterSlotsRemaining: team.rosterSlotsRemaining,
  maxBid: team.maxBid,
  positionCounts: { ...team.positionCounts },
  roster: team.roster.map(player => ({ ...player })),
  slots: team.slots.map(slot => (
    slot.player === undefined
      ? { slot: slot.slot }
      : { slot: slot.slot, player: { ...slot.player } }
  )),
});

const saleLogEntryFor = (
  sale: LiveDraftRoomSale,
  revision: number,
  occurredAt: Date,
): LiveDraftRoomSaleLogEntry => ({
  saleEventId: sale.saleEventId,
  revision,
  occurredAt: isoStringFor(occurredAt),
  teamId: sale.teamId,
  ownerId: sale.ownerId,
  ownerDisplayName: sale.ownerDisplayName,
  teamDisplayName: sale.teamDisplayName,
  playerName: sale.playerName,
  position: sale.position,
  price: sale.price,
  expectedPrice: sale.expectedPrice,
  ...(sale.teamAbbreviation === undefined ? {} : { teamAbbreviation: sale.teamAbbreviation }),
  ...(sale.byeWeek === undefined ? {} : { byeWeek: sale.byeWeek }),
});

const selectedTeamFor = (
  input: BuildLiveDraftRoomReadModelInput,
  role: LiveDraftRoomViewerRole,
  teamSummaries: readonly LiveDraftRoomTeamSummary[],
): LiveDraftRoomTeamSummary | undefined => {
  if (role === "commissioner" && input.selectedTeamId !== undefined) {
    return teamSummaries.find(team => team.teamId === input.selectedTeamId);
  }

  if (role === "observer") return undefined;
  if (input.actor.teamId !== undefined) {
    return teamSummaries.find(team => team.teamId === input.actor.teamId);
  }
  if (input.actor.ownerId !== undefined) {
    return teamSummaries.find(team => team.ownerId === input.actor.ownerId);
  }

  return undefined;
};

const viewedTeamIdFor = (
  input: BuildLiveDraftRoomReadModelInput,
  selectedTeam: LiveDraftRoomTeamSummary | undefined,
): string | undefined => input.viewedTeamId ?? selectedTeam?.teamId;

const exportBlockersFor = (teams: readonly LiveDraftRoomTeamSummary[]): readonly string[] =>
  teams.flatMap(team =>
    team.budgetRemaining < 0
      ? [`${team.ownerDisplayName} has a negative budget.`]
      : []
  );

const exportReadinessFor = (
  room: LiveDraftRoom,
  teams: readonly LiveDraftRoomTeamSummary[],
): LiveDraftRoomExportReadiness => {
  const blockers = exportBlockersFor(teams);
  if (blockers.length > 0) return { status: "blocked", blockers };
  if (room.status === "ended") return { status: "ready", completedRevision: room.revision, blockers: [] };

  return { status: "pending", blockers: ["Draft room must be ended before final export."] };
};

const roomCreatedSnapshotRoom = (room: LiveDraftRoom, event: LiveDraftRoomEvent): LiveDraftRoom => ({
  ...room,
  status: event.type === "room_created" ? "setup" : room.status,
  revision: event.revision,
  updatedAt: event.occurredAt,
});

const eventNameFor = (event: LiveDraftRoomEvent): LiveDraftRoomSseEventName => {
  switch (event.type) {
    case "room_created":
    case "sale_corrected":
    case "sale_undone":
      return "room.snapshot";
    case "room_started":
      return "room.started";
    case "sale_logged":
      return "room.sale";
    case "room_paused":
      return "room.paused";
    case "room_resumed":
      return "room.resumed";
    case "room_ended":
      return "room.ended";
  }
};

const minimumRetainedRevisionFor = (events: readonly LiveDraftRoomEvent[]): number | undefined =>
  events.reduce<number | undefined>(
    (minimum, event) => minimum === undefined ? event.revision : Math.min(minimum, event.revision),
    undefined,
  );

const hasContiguousEventsAfterRevision = (
  events: readonly LiveDraftRoomEvent[],
  afterRevision: number,
  currentRevision: number,
): boolean => {
  const nextEvents = events
    .filter(event => event.revision > afterRevision)
    .sort((left, right) => left.revision - right.revision);

  return nextEvents.length > 0 &&
    nextEvents.at(-1)?.revision === currentRevision &&
    nextEvents.every((event, index) => event.revision === afterRevision + index + 1);
};

export const buildLiveDraftRoomReadModel = (
  input: BuildLiveDraftRoomReadModelInput,
): LiveDraftRoomReadModel => {
  const role = roleFor(input.room, input.actor);
  const canMutateRoom = canMutateRoomFor(role);
  const teamSummaries = input.room.projection.teams.map(teamSummaryFor);
  const selectedTeam = selectedTeamFor(input, role, teamSummaries);
  const viewedTeamId = viewedTeamIdFor(input, selectedTeam);
  const viewedTeam = viewedTeamId === undefined
    ? undefined
    : teamSummaries.find(team => team.teamId === viewedTeamId);
  const salesLog = input.room.projection.sales.flatMap(sale => {
    const sourceEvent = input.room.events.find(event => event.id === sale.saleEventId);
    if (sourceEvent === undefined) return [];

    return [saleLogEntryFor(sale, sourceEvent.revision, sourceEvent.occurredAt)];
  });

  return {
    roomId: input.room.roomId,
    leagueId: input.room.leagueId,
    seasonId: input.room.seasonId,
    status: input.room.status,
    revision: input.room.revision,
    updatedAt: isoStringFor(input.room.updatedAt),
    role,
    canMutateRoom,
    canExportDraft: canMutateRoom,
    board: input.room.projection.board.map(player => ({ ...player })),
    ...(selectedTeam === undefined ? {} : { selectedTeam }),
    ...(viewedTeam === undefined ? {} : { viewedTeam }),
    teamSummaries,
    salesLog,
    connection: {
      state: "synchronized",
      transport: "sse",
      cursor: eventStreamIdFor(input.room.roomId, input.room.revision),
      revision: input.room.revision,
      retryMilliseconds: sseRetryMilliseconds,
      pollingFallback: true,
    },
    exportReadiness: exportReadinessFor(input.room, teamSummaries),
  };
};

export const buildLiveDraftRoomSnapshotEvent = (
  input: BuildLiveDraftRoomReadModelInput,
): LiveDraftRoomSsePayload => ({
  id: snapshotStreamIdFor(input.room),
  event: "room.snapshot",
  revision: input.room.revision,
  retry: sseRetryMilliseconds,
  data: buildLiveDraftRoomReadModel(input),
});

export const buildLiveDraftRoomSseEvent = (
  input: BuildLiveDraftRoomSseEventInput,
): LiveDraftRoomSsePayload => {
  const eventName = eventNameFor(input.event);
  if (eventName === "room.snapshot") {
    return buildLiveDraftRoomSnapshotEvent({
      room: roomCreatedSnapshotRoom(input.room, input.event),
      actor: input.actor,
    });
  }

  if (input.event.type === "sale_logged") {
    return {
      id: eventStreamIdFor(input.event.roomId, input.event.revision),
      event: "room.sale",
      revision: input.event.revision,
      data: {
        roomId: input.event.roomId,
        leagueId: input.event.leagueId,
        seasonId: input.event.seasonId,
        status: "live",
        revision: input.event.revision,
        occurredAt: isoStringFor(input.event.occurredAt),
        actorUserId: input.event.actorUserId,
        sale: saleLogEntryFor(input.event.sale, input.event.revision, input.event.occurredAt),
      },
    };
  }

  if (
    input.event.type === "room_started" ||
    input.event.type === "room_paused" ||
    input.event.type === "room_resumed"
  ) {
    const status = input.event.type === "room_paused" ? "paused" : "live";
    const lifecycleEventName = input.event.type === "room_started"
      ? "room.started"
      : input.event.type === "room_paused"
        ? "room.paused"
        : "room.resumed";
    return {
      id: eventStreamIdFor(input.event.roomId, input.event.revision),
      event: lifecycleEventName,
      revision: input.event.revision,
      data: {
        roomId: input.event.roomId,
        leagueId: input.event.leagueId,
        seasonId: input.event.seasonId,
        status,
        revision: input.event.revision,
        occurredAt: isoStringFor(input.event.occurredAt),
        actorUserId: input.event.actorUserId,
      },
    };
  }

  return {
    id: eventStreamIdFor(input.event.roomId, input.event.revision),
    event: "room.ended",
    revision: input.event.revision,
    data: {
      roomId: input.event.roomId,
      leagueId: input.event.leagueId,
      seasonId: input.event.seasonId,
      status: "ended",
      revision: input.event.revision,
      occurredAt: isoStringFor(input.event.occurredAt),
      actorUserId: input.event.actorUserId,
    },
  };
};

export const buildLiveDraftRoomErrorEvent = (
  input: LiveDraftRoomEventsAfterRevisionInput,
): LiveDraftRoomSsePayload => ({
  id: `${eventStreamIdFor(input.room.roomId, input.room.revision)}:error`,
  event: "room.error",
  revision: input.room.revision,
  data: {
    roomId: input.room.roomId,
    leagueId: input.room.leagueId,
    seasonId: input.room.seasonId,
    code: "future_revision",
    message: "Client revision is ahead of the current draft room revision. Refresh from the latest snapshot.",
    currentRevision: input.room.revision,
    requestedRevision: input.afterRevision,
  },
});

export const formatLiveDraftRoomSsePayloads = (
  events: readonly LiveDraftRoomSsePayload[],
): string => {
  if (events.length === 0) return ": keep-alive\n\n";

  return events.map(event => {
    const lines = [
      `id: ${event.id}`,
      `event: ${event.event}`,
      ...("retry" in event ? [`retry: ${event.retry}`] : []),
      `data: ${JSON.stringify(event.data)}`,
    ];

    return `${lines.join("\n")}\n\n`;
  }).join("");
};

export const liveDraftRoomEventsAfterRevision = (
  input: LiveDraftRoomEventsAfterRevisionInput,
): LiveDraftRoomEventsAfterRevisionResult => {
  if (input.afterRevision <= 0) {
    return {
      currentRevision: input.room.revision,
      isStale: input.room.revision > 0,
      requiresSnapshot: true,
      events: [buildLiveDraftRoomSnapshotEvent(input)],
    };
  }

  if (input.afterRevision === input.room.revision) {
    return {
      currentRevision: input.room.revision,
      isStale: false,
      requiresSnapshot: false,
      events: [],
    };
  }

  if (input.afterRevision > input.room.revision) {
    return {
      currentRevision: input.room.revision,
      isStale: true,
      requiresSnapshot: true,
      events: [buildLiveDraftRoomErrorEvent(input)],
    };
  }

  const minimumRetainedRevision = minimumRetainedRevisionFor(input.room.events);
  const isMissingRequestedRevision = minimumRetainedRevision !== undefined &&
    input.afterRevision + 1 < minimumRetainedRevision;

  if (
    isMissingRequestedRevision ||
    !hasContiguousEventsAfterRevision(input.room.events, input.afterRevision, input.room.revision)
  ) {
    return {
      currentRevision: input.room.revision,
      isStale: true,
      requiresSnapshot: true,
      events: [buildLiveDraftRoomSnapshotEvent(input)],
    };
  }

  const nextEvents = input.room.events
    .filter(event => event.revision > input.afterRevision)
    .sort((left, right) => left.revision - right.revision);
  const requiresSnapshotReset = nextEvents.some(event => eventNameFor(event) === "room.snapshot");

  if (requiresSnapshotReset) {
    return {
      currentRevision: input.room.revision,
      isStale: true,
      requiresSnapshot: true,
      events: [buildLiveDraftRoomSnapshotEvent(input)],
    };
  }

  return {
    currentRevision: input.room.revision,
    isStale: true,
    requiresSnapshot: false,
    events: nextEvents.map(event => buildLiveDraftRoomSseEvent({ room: input.room, event, actor: input.actor })),
  };
};
