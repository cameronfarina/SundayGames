import type { Position } from "../../config/league.js";
import { cleanPlayerName, normalizePlayerName } from "../data/normalizePlayerName.js";
import { parseLiveDraftSaleCommand } from "../modeling/liveDraft.js";
import {
  assessLeagueSeasonReadiness,
  type FantasyTeam,
  type LeagueSeason,
} from "./leagueSeason.js";
import type { WorkspaceRole } from "./workspacePrivacy.js";

export type LiveDraftRoomStatus = "setup" | "countdown" | "live" | "ended";

export type LiveDraftRoomErrorCode =
  | "access_denied"
  | "duplicate_player"
  | "idempotency_conflict"
  | "invalid_sale_price"
  | "max_bid_exceeded"
  | "mutation_denied"
  | "no_sale_to_undo"
  | "owner_not_found"
  | "player_not_found"
  | "position_limit"
  | "room_not_found"
  | "room_not_live"
  | "room_already_exists"
  | "room_already_ended"
  | "room_already_live"
  | "roster_full"
  | "season_not_ready"
  | "stale_revision"
  | "team_not_found";

export class LiveDraftRoomError extends Error {
  readonly code: LiveDraftRoomErrorCode;

  constructor(code: LiveDraftRoomErrorCode, message: string) {
    super(message);
    this.name = "LiveDraftRoomError";
    this.code = code;
  }
}

export interface LiveDraftRoomPlayerCatalogEntry {
  name: string;
  position: Position;
  expectedPrice: number;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
}

export interface LiveDraftRoomInitialRosterPlayer {
  teamId: string;
  playerName: string;
  position: Position;
  price: number;
  expectedPrice?: number | undefined;
  source?: "keeper" | "imported" | undefined;
}

export interface LiveDraftRoomActor {
  userId: string;
  leagueId: string;
  role?: WorkspaceRole | undefined;
}

export type LiveDraftRoomMutationAction = "read" | "start" | "log_sale" | "undo_sale" | "end";

export type LiveDraftRoomAuthorizer = (input: {
  actor: LiveDraftRoomActor;
  action: LiveDraftRoomMutationAction;
  room: LiveDraftRoom;
}) => boolean;

export interface ParsedLiveDraftRoomSaleInput {
  ownerText?: string | undefined;
  ownerId?: string | undefined;
  teamId?: string | undefined;
  teamName?: string | undefined;
  playerName: string;
  price: number;
}

export type LiveDraftRoomSaleCommandInput = string | ParsedLiveDraftRoomSaleInput;

export interface LiveDraftRoomSale {
  saleEventId: string;
  input: string;
  teamId: string;
  ownerId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  playerName: string;
  normalizedPlayerName: string;
  position: Position;
  price: number;
  expectedPrice: number;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
}

export interface LiveDraftRoomRosterPlayer {
  name: string;
  normalizedPlayerName: string;
  position: Position;
  price: number;
  expectedPrice: number;
  source: "keeper" | "imported" | "sale";
  saleEventId?: string | undefined;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
}

export interface LiveDraftRoomRosterSlot {
  slot: string;
  player?: LiveDraftRoomRosterPlayer | undefined;
}

export interface LiveDraftRoomTeamState {
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
  positionCounts: Record<Position, number>;
  roster: readonly LiveDraftRoomRosterPlayer[];
  slots: readonly LiveDraftRoomRosterSlot[];
}

export interface LiveDraftRoomBoardPlayer {
  name: string;
  normalizedPlayerName: string;
  position: Position;
  expectedPrice: number;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
}

export interface LiveDraftRoomProjection {
  roomId: string;
  leagueId: string;
  seasonId: string;
  status: LiveDraftRoomStatus;
  revision: number;
  updatedAt: Date;
  teams: readonly LiveDraftRoomTeamState[];
  board: readonly LiveDraftRoomBoardPlayer[];
  sales: readonly LiveDraftRoomSale[];
}

export type LiveDraftRoomEvent =
  | {
    id: string;
    roomId: string;
    leagueId: string;
    seasonId: string;
    revision: number;
    type: "room_created";
    actorUserId: string;
    occurredAt: Date;
    idempotencyKey?: string | undefined;
    mutationHash?: string | undefined;
  }
  | {
    id: string;
    roomId: string;
    leagueId: string;
    seasonId: string;
    revision: number;
    type: "room_started";
    actorUserId: string;
    occurredAt: Date;
    idempotencyKey?: string | undefined;
    mutationHash?: string | undefined;
  }
  | {
    id: string;
    roomId: string;
    leagueId: string;
    seasonId: string;
    revision: number;
    type: "sale_logged";
    actorUserId: string;
    occurredAt: Date;
    idempotencyKey?: string | undefined;
    mutationHash?: string | undefined;
    sale: LiveDraftRoomSale;
  }
  | {
    id: string;
    roomId: string;
    leagueId: string;
    seasonId: string;
    revision: number;
    type: "sale_undone";
    actorUserId: string;
    occurredAt: Date;
    idempotencyKey?: string | undefined;
    mutationHash?: string | undefined;
    undoneSaleEventId: string;
    undoneSale: LiveDraftRoomSale;
  }
  | {
    id: string;
    roomId: string;
    leagueId: string;
    seasonId: string;
    revision: number;
    type: "room_ended";
    actorUserId: string;
    occurredAt: Date;
    idempotencyKey?: string | undefined;
    mutationHash?: string | undefined;
  };

export interface LiveDraftRoom {
  roomId: string;
  leagueId: string;
  seasonId: string;
  status: LiveDraftRoomStatus;
  commissionerUserId: string;
  startsAt?: Date | undefined;
  viewerPasswordHashRef: string;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  endedAt?: Date | undefined;
  season: LeagueSeason;
  playerCatalog: readonly LiveDraftRoomBoardPlayer[];
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[];
  events: readonly LiveDraftRoomEvent[];
  projection: LiveDraftRoomProjection;
}

export interface CreateLiveDraftRoomInput {
  season: LeagueSeason;
  roomId: string;
  commissionerUserId: string;
  viewerPasswordHashRef: string;
  startsAt?: Date | undefined;
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
  initialRosters?: readonly LiveDraftRoomInitialRosterPlayer[] | undefined;
  createdAt?: Date | undefined;
}

export interface MutateLiveDraftRoomInput {
  roomId: string;
  actor: LiveDraftRoomActor;
  expectedRevision?: number | undefined;
  idempotencyKey?: string | undefined;
  now?: Date | undefined;
}

export interface LogLiveDraftRoomSaleInput extends MutateLiveDraftRoomInput {
  sale: LiveDraftRoomSaleCommandInput;
}

const positions = ["QB", "RB", "WR", "TE", "K", "DST"] as const satisfies readonly Position[];
const flexEligiblePositions = new Set<Position>(["RB", "WR", "TE"]);
const writerRoles = new Set<WorkspaceRole>(["owner", "admin"]);

const searchKeyFor = (value: string): string =>
  normalizePlayerName(cleanPlayerName(value))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const emptyPositionCounts = (): Record<Position, number> => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

const assertPositiveWholeDollar = (
  price: number,
  message: string,
): void => {
  if (!Number.isInteger(price) || price < 1) {
    throw new LiveDraftRoomError("invalid_sale_price", message);
  }
};

const assertSeasonReady = (season: LeagueSeason): void => {
  const readiness = assessLeagueSeasonReadiness(season);

  if (season.setupStatus === "draft" || readiness.blockers.length > 0) {
    throw new LiveDraftRoomError(
      "season_not_ready",
      "League season must be published or locked before creating a live draft room.",
    );
  }
};

const normalizeCatalog = (
  catalog: readonly LiveDraftRoomPlayerCatalogEntry[],
): readonly LiveDraftRoomBoardPlayer[] =>
  catalog.map(player => {
    const name = cleanPlayerName(player.name);

    return {
      name,
      normalizedPlayerName: normalizePlayerName(name),
      position: player.position,
      expectedPrice: player.expectedPrice,
      ...(player.teamAbbreviation === undefined ? {} : { teamAbbreviation: player.teamAbbreviation }),
      ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
    };
  });

const eventIdFor = (
  roomId: string,
  revision: number,
  type: LiveDraftRoomEvent["type"],
): string => `${roomId}-rev-${revision}-${type}`;

const maxBidFor = (
  budgetRemaining: number,
  rosterSlotsRemaining: number,
  minimumBid: number,
): number => {
  if (rosterSlotsRemaining <= 0) return 0;

  return Math.max(0, budgetRemaining - Math.max(0, rosterSlotsRemaining - 1) * minimumBid);
};

const countPositions = (
  players: readonly LiveDraftRoomRosterPlayer[],
): Record<Position, number> => {
  const counts = emptyPositionCounts();
  for (const player of players) counts[player.position] += 1;

  return counts;
};

const rosterSlotNamesFor = (season: LeagueSeason): string[] => {
  const slotNames: string[] = [];
  const lineup = season.settings.roster.lineup;

  for (const position of positions) {
    const count = lineup[position] ?? 0;
    for (let index = 1; index <= count; index += 1) {
      slotNames.push(count === 1 ? position : `${position}${index}`);
    }
  }

  const flexCount = lineup.FLEX ?? 0;
  for (let index = 1; index <= flexCount; index += 1) {
    slotNames.push(flexCount === 1 ? "FLEX" : `FLEX${index}`);
  }

  const benchCount = lineup.BENCH ?? 0;
  for (let index = 1; index <= benchCount; index += 1) {
    slotNames.push(`BENCH${index}`);
  }

  return slotNames;
};

const sortedRoster = (
  roster: readonly LiveDraftRoomRosterPlayer[],
): LiveDraftRoomRosterPlayer[] =>
  [...roster].sort(
    (left, right) =>
      right.price - left.price ||
      right.expectedPrice - left.expectedPrice ||
      left.name.localeCompare(right.name),
  );

const rosterSlotsFor = (
  season: LeagueSeason,
  roster: readonly LiveDraftRoomRosterPlayer[],
): readonly LiveDraftRoomRosterSlot[] => {
  const slots: LiveDraftRoomRosterSlot[] = rosterSlotNamesFor(season).map(slot => ({ slot }));
  const used = new Set<LiveDraftRoomRosterPlayer>();

  const place = (slotPrefix: string, player: LiveDraftRoomRosterPlayer | undefined): void => {
    if (player === undefined) return;
    const index = slots.findIndex(slot => slot.slot === slotPrefix && slot.player === undefined);
    if (index >= 0) {
      slots[index] = { slot: slotPrefix, player };
      used.add(player);
    }
  };

  for (const position of positions) {
    const positionPlayers = sortedRoster(roster.filter(player => player.position === position));
    const positionSlotNames = slots
      .filter(slot => slot.slot === position || new RegExp(`^${position}\\d+$`).test(slot.slot))
      .map(slot => slot.slot);

    for (let index = 0; index < positionSlotNames.length; index += 1) {
      place(positionSlotNames[index] ?? position, positionPlayers[index]);
    }
  }

  const flexPlayers = sortedRoster(
    roster.filter(player => flexEligiblePositions.has(player.position) && !used.has(player)),
  );
  const flexSlotNames = slots
    .filter(slot => slot.slot.startsWith("FLEX"))
    .map(slot => slot.slot);
  for (let index = 0; index < flexSlotNames.length; index += 1) {
    place(flexSlotNames[index] ?? "FLEX", flexPlayers[index]);
  }

  for (const player of sortedRoster(roster.filter(candidate => !used.has(candidate)))) {
    const benchIndex = slots.findIndex(slot => slot.slot.startsWith("BENCH") && slot.player === undefined);
    if (benchIndex < 0) break;
    slots[benchIndex] = { slot: slots[benchIndex]?.slot ?? "BENCH", player };
  }

  return slots;
};

const teamLabelFor = (team: FantasyTeam): string => `${team.ownerDisplayName} - ${team.displayName}`;

const teamKeyCandidates = (team: FantasyTeam): readonly string[] => [
  team.id,
  team.ownerId,
  team.ownerDisplayName,
  team.displayName,
  teamLabelFor(team),
];

const resolveTeam = (
  season: LeagueSeason,
  input: ParsedLiveDraftRoomSaleInput,
): FantasyTeam => {
  if (input.teamId !== undefined) {
    const team = season.teams.find(candidate => candidate.id === input.teamId);
    if (team === undefined) {
      throw new LiveDraftRoomError("team_not_found", `Unknown team "${input.teamId}".`);
    }

    return team;
  }

  if (input.ownerId !== undefined) {
    const team = season.teams.find(candidate => candidate.ownerId === input.ownerId);
    if (team === undefined) {
      throw new LiveDraftRoomError("owner_not_found", `Unknown owner "${input.ownerId}".`);
    }

    return team;
  }

  const ownerText = input.ownerText ?? input.teamName;
  if (ownerText === undefined || ownerText.trim().length === 0) {
    throw new LiveDraftRoomError("owner_not_found", "Sale command must include an owner or team.");
  }

  const ownerKey = searchKeyFor(ownerText);
  const exactMatches = season.teams.filter(team =>
    teamKeyCandidates(team).some(candidate => searchKeyFor(candidate) === ownerKey)
  );

  if (exactMatches.length === 1) {
    return exactMatches[0] as FantasyTeam;
  }

  if (exactMatches.length > 1) {
    throw new LiveDraftRoomError("owner_not_found", `Owner "${ownerText}" matches multiple teams.`);
  }

  const fuzzyMatches = season.teams.filter(team =>
    teamKeyCandidates(team).some(candidate => searchKeyFor(candidate).startsWith(ownerKey))
  );

  if (fuzzyMatches.length === 1) {
    return fuzzyMatches[0] as FantasyTeam;
  }

  throw new LiveDraftRoomError("owner_not_found", `Unknown owner or team "${ownerText}".`);
};

const playerMatchScore = (
  player: LiveDraftRoomBoardPlayer,
  playerText: string,
): number => {
  const query = searchKeyFor(playerText);
  const key = searchKeyFor(player.name);
  const tokens = key.split(" ");

  if (key === query) return 1_000;
  if (key.startsWith(`${query} `)) return 900;
  if (tokens.includes(query)) return 800;
  if (key.includes(query)) return 700;

  return 0;
};

const resolvePlayer = (
  playerCatalog: readonly LiveDraftRoomBoardPlayer[],
  playerText: string,
): LiveDraftRoomBoardPlayer => {
  const cleaned = cleanPlayerName(playerText);
  const matches = playerCatalog
    .map(player => ({ player, score: playerMatchScore(player, cleaned) }))
    .filter(match => match.score > 0)
    .sort((left, right) =>
      right.score - left.score ||
      right.player.expectedPrice - left.player.expectedPrice ||
      left.player.name.localeCompare(right.player.name)
    );

  const best = matches[0];
  if (best === undefined) {
    throw new LiveDraftRoomError("player_not_found", `Unknown player "${cleaned}".`);
  }

  const second = matches[1];
  if (second !== undefined && second.score === best.score) {
    throw new LiveDraftRoomError(
      "player_not_found",
      `Ambiguous player "${cleaned}". Matches: ${matches.slice(0, 6).map(match => match.player.name).join(", ")}.`,
    );
  }

  return best.player;
};

const parseSaleInput = (sale: LiveDraftRoomSaleCommandInput): ParsedLiveDraftRoomSaleInput => {
  if (typeof sale === "string") {
    try {
      const parsed = parseLiveDraftSaleCommand(sale);

      return {
        ownerText: parsed.ownerText,
        playerName: parsed.playerText,
        price: parsed.price,
      };
    } catch (error) {
      throw new LiveDraftRoomError(
        "player_not_found",
        error instanceof Error ? error.message : "Could not parse live draft sale command.",
      );
    }
  }

  const playerName = cleanPlayerName(sale.playerName);
  assertPositiveWholeDollar(sale.price, `Sale price must be a positive whole-dollar amount for ${playerName}.`);

  return {
    ...(sale.ownerText === undefined ? {} : { ownerText: sale.ownerText }),
    ...(sale.ownerId === undefined ? {} : { ownerId: sale.ownerId }),
    ...(sale.teamId === undefined ? {} : { teamId: sale.teamId }),
    ...(sale.teamName === undefined ? {} : { teamName: sale.teamName }),
    playerName,
    price: sale.price,
  };
};

const sourceInputLabelFor = (sale: LiveDraftRoomSaleCommandInput): string =>
  typeof sale === "string"
    ? sale
    : [
      sale.ownerText ?? sale.teamName ?? sale.teamId ?? sale.ownerId ?? "unknown",
      sale.playerName,
      String(sale.price),
    ].join(" ");

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(item => stableStringify(item)).join(",")}]`;

  const entries = Object.entries(value).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const serializedEntries = entries
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(([entryKey, entryValue]) => `${JSON.stringify(entryKey)}:${stableStringify(entryValue)}`);

  return `{${serializedEntries.join(",")}}`;
};

const mutationHashFor = (action: LiveDraftRoomMutationAction, payload: unknown): string =>
  stableStringify({ action, payload });

const mutationMetadataFor = (
  input: MutateLiveDraftRoomInput,
  mutationHash: string,
): { idempotencyKey: string; mutationHash: string } | Record<string, never> =>
  input.idempotencyKey === undefined
    ? {}
    : { idempotencyKey: input.idempotencyKey, mutationHash };

const actionForEventType = (
  eventType: LiveDraftRoomEvent["type"],
): LiveDraftRoomMutationAction | undefined => {
  switch (eventType) {
    case "room_started":
      return "start";
    case "sale_logged":
      return "log_sale";
    case "sale_undone":
      return "undo_sale";
    case "room_ended":
      return "end";
    case "room_created":
      return undefined;
  }
};

const replayIdempotentMutation = (
  room: LiveDraftRoom,
  action: LiveDraftRoomMutationAction,
  idempotencyKey: string | undefined,
  mutationHash: string,
): LiveDraftRoom | undefined => {
  if (idempotencyKey === undefined) return undefined;

  const existingEvent = room.events.find(event => event.idempotencyKey === idempotencyKey);
  if (existingEvent === undefined) return undefined;

  if (actionForEventType(existingEvent.type) !== action || existingEvent.mutationHash !== mutationHash) {
    throw new LiveDraftRoomError(
      "idempotency_conflict",
      "A draft room mutation already exists for this idempotency key with different input.",
    );
  }

  return room;
};

const activeSaleEventsFor = (
  events: readonly LiveDraftRoomEvent[],
): readonly Extract<LiveDraftRoomEvent, { type: "sale_logged" }>[] => {
  const undoneSaleEventIds = new Set(
    events
      .filter((event): event is Extract<LiveDraftRoomEvent, { type: "sale_undone" }> => event.type === "sale_undone")
      .map(event => event.undoneSaleEventId),
  );

  return events.filter(
    (event): event is Extract<LiveDraftRoomEvent, { type: "sale_logged" }> =>
      event.type === "sale_logged" && !undoneSaleEventIds.has(event.id),
  );
};

const rosterPlayerFromInitial = (
  player: LiveDraftRoomInitialRosterPlayer,
): LiveDraftRoomRosterPlayer => {
  const name = cleanPlayerName(player.playerName);

  return {
    name,
    normalizedPlayerName: normalizePlayerName(name),
    position: player.position,
    price: player.price,
    expectedPrice: player.expectedPrice ?? player.price,
    source: player.source ?? "keeper",
  };
};

const rosterPlayerFromSale = (
  sale: LiveDraftRoomSale,
): LiveDraftRoomRosterPlayer => ({
  name: sale.playerName,
  normalizedPlayerName: sale.normalizedPlayerName,
  position: sale.position,
  price: sale.price,
  expectedPrice: sale.expectedPrice,
  source: "sale",
  saleEventId: sale.saleEventId,
  ...(sale.teamAbbreviation === undefined ? {} : { teamAbbreviation: sale.teamAbbreviation }),
  ...(sale.byeWeek === undefined ? {} : { byeWeek: sale.byeWeek }),
});

const teamStateFor = (
  season: LeagueSeason,
  team: FantasyTeam,
  roster: readonly LiveDraftRoomRosterPlayer[],
): LiveDraftRoomTeamState => {
  const spent = roster.reduce((total, player) => total + player.price, 0);
  const rosterSlotsRemaining = Math.max(0, season.settings.roster.rosterSize - roster.length);
  const budgetRemaining = season.settings.auction.budgetDollars - spent;

  return {
    teamId: team.id,
    ownerId: team.ownerId,
    ownerDisplayName: team.ownerDisplayName,
    teamDisplayName: team.displayName,
    draftOrderPosition: team.draftOrderPosition,
    budgetDollars: season.settings.auction.budgetDollars,
    spent,
    budgetRemaining,
    rosterSlotsRemaining,
    maxBid: maxBidFor(
      budgetRemaining,
      rosterSlotsRemaining,
      season.settings.auction.minimumBidDollars,
    ),
    positionCounts: countPositions(roster),
    roster: [...roster],
    slots: rosterSlotsFor(season, roster),
  };
};

const projectRoom = (
  room: Omit<LiveDraftRoom, "projection">,
): LiveDraftRoomProjection => {
  const rostersByTeamId = new Map<string, LiveDraftRoomRosterPlayer[]>(
    room.season.teams.map(team => [team.id, []]),
  );

  for (const initialPlayer of room.initialRosters) {
    const roster = rostersByTeamId.get(initialPlayer.teamId);
    if (roster !== undefined) roster.push(rosterPlayerFromInitial(initialPlayer));
  }

  const activeSaleEvents = activeSaleEventsFor(room.events);
  for (const event of activeSaleEvents) {
    const roster = rostersByTeamId.get(event.sale.teamId);
    if (roster !== undefined) roster.push(rosterPlayerFromSale(event.sale));
  }

  const unavailableNames = new Set<string>();
  for (const initialPlayer of room.initialRosters) {
    unavailableNames.add(normalizePlayerName(cleanPlayerName(initialPlayer.playerName)));
  }
  for (const event of activeSaleEvents) {
    unavailableNames.add(event.sale.normalizedPlayerName);
  }

  return {
    roomId: room.roomId,
    leagueId: room.leagueId,
    seasonId: room.seasonId,
    status: room.status,
    revision: room.revision,
    updatedAt: room.updatedAt,
    teams: room.season.teams.map(team => teamStateFor(room.season, team, rostersByTeamId.get(team.id) ?? [])),
    board: room.playerCatalog.filter(player => !unavailableNames.has(player.normalizedPlayerName)),
    sales: activeSaleEvents.map(event => event.sale),
  };
};

const roomWithProjection = (
  room: Omit<LiveDraftRoom, "projection">,
): LiveDraftRoom => ({
  ...room,
  projection: projectRoom(room),
});

const assertWriter = (
  room: LiveDraftRoom,
  actor: LiveDraftRoomActor,
  action: LiveDraftRoomMutationAction,
  authorizer: LiveDraftRoomAuthorizer | undefined,
): void => {
  const isLeagueMember = actor.leagueId === room.leagueId;
  const allowedByDefault = isLeagueMember && (
    actor.userId === room.commissionerUserId ||
    (actor.role !== undefined && writerRoles.has(actor.role))
  );
  const allowed = authorizer === undefined
    ? allowedByDefault
    : authorizer({ actor, action, room });

  if (!allowed) {
    throw new LiveDraftRoomError(
      "mutation_denied",
      "Only the commissioner or league admins can change this draft room.",
    );
  }
};

const assertReader = (
  room: LiveDraftRoom,
  actor: LiveDraftRoomActor,
  authorizer: LiveDraftRoomAuthorizer | undefined,
): void => {
  const allowedByDefault = actor.leagueId === room.leagueId;
  const allowed = authorizer === undefined
    ? allowedByDefault
    : authorizer({ actor, action: "read", room });

  if (!allowed) {
    throw new LiveDraftRoomError("access_denied", "Only league members can view this draft room.");
  }
};

const assertExpectedRevision = (
  room: LiveDraftRoom,
  expectedRevision: number | undefined,
): void => {
  if (expectedRevision !== undefined && expectedRevision !== room.revision) {
    throw new LiveDraftRoomError(
      "stale_revision",
      "Draft room changed since this action was prepared. Refresh and try again.",
    );
  }
};

const assertRoomNotEnded = (room: LiveDraftRoom): void => {
  if (room.status === "ended") {
    throw new LiveDraftRoomError("room_already_ended", "Draft room has already ended.");
  }
};

const assertRoomCanStart = (room: LiveDraftRoom): void => {
  if (room.status === "live") {
    throw new LiveDraftRoomError("room_already_live", "Draft room has already started.");
  }
};

const assertRoomLive = (room: LiveDraftRoom): void => {
  if (room.status !== "live") {
    throw new LiveDraftRoomError("room_not_live", "Start the draft room before logging sales.");
  }
};

const pluralPosition = (position: Position): string => `${position}s`;

const validateSale = (
  room: LiveDraftRoom,
  sale: LiveDraftRoomSale,
): void => {
  const playerIsAlreadyRostered = room.projection.teams.some(team =>
    team.roster.some(player => player.normalizedPlayerName === sale.normalizedPlayerName),
  );

  if (playerIsAlreadyRostered) {
    throw new LiveDraftRoomError("duplicate_player", `${sale.playerName} is already unavailable.`);
  }

  const team = room.projection.teams.find(candidate => candidate.teamId === sale.teamId);
  if (team === undefined) {
    throw new LiveDraftRoomError("team_not_found", `Unknown team "${sale.teamId}".`);
  }

  if (team.rosterSlotsRemaining <= 0) {
    throw new LiveDraftRoomError("roster_full", `${team.ownerDisplayName} has no open roster slots.`);
  }

  if (sale.price > team.maxBid) {
    throw new LiveDraftRoomError(
      "max_bid_exceeded",
      `${team.ownerDisplayName} cannot buy ${sale.playerName} for $${sale.price}: max bid is $${team.maxBid}.`,
    );
  }

  const positionMaximum = room.season.settings.roster.rosterMaximums[sale.position];
  if (team.positionCounts[sale.position] >= positionMaximum) {
    throw new LiveDraftRoomError(
      "position_limit",
      `${team.ownerDisplayName} cannot buy ${sale.playerName}: roster limit is ${positionMaximum} ${pluralPosition(sale.position)}.`,
    );
  }
};

const buildSale = (
  room: LiveDraftRoom,
  input: LiveDraftRoomSaleCommandInput,
  saleEventId: string,
): LiveDraftRoomSale => {
  const parsed = parseSaleInput(input);
  const team = resolveTeam(room.season, parsed);
  const player = resolvePlayer(room.playerCatalog, parsed.playerName);
  assertPositiveWholeDollar(parsed.price, `Sale price must be a positive whole-dollar amount for ${player.name}.`);

  return {
    saleEventId,
    input: sourceInputLabelFor(input),
    teamId: team.id,
    ownerId: team.ownerId,
    ownerDisplayName: team.ownerDisplayName,
    teamDisplayName: team.displayName,
    playerName: player.name,
    normalizedPlayerName: player.normalizedPlayerName,
    position: player.position,
    price: parsed.price,
    expectedPrice: player.expectedPrice,
    ...(player.teamAbbreviation === undefined ? {} : { teamAbbreviation: player.teamAbbreviation }),
    ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
  };
};

const appendEvent = (
  room: LiveDraftRoom,
  event: LiveDraftRoomEvent,
  status: LiveDraftRoomStatus,
  updatedAt: Date,
  endedAt?: Date | undefined,
): LiveDraftRoom =>
  roomWithProjection({
    ...room,
    status,
    revision: event.revision,
    updatedAt,
    ...(endedAt === undefined ? {} : { endedAt }),
    events: [...room.events, event],
  });

export class InMemoryLiveDraftRoomRepository {
  readonly #roomsById = new Map<string, LiveDraftRoom>();

  constructor(
    readonly authorizer?: LiveDraftRoomAuthorizer | undefined,
  ) {}

  createRoom(input: CreateLiveDraftRoomInput): LiveDraftRoom {
    assertSeasonReady(input.season);

    if (this.#roomsById.has(input.roomId)) {
      throw new LiveDraftRoomError(
        "room_already_exists",
        `Live draft room "${input.roomId}" already exists.`,
      );
    }

    const createdAt = input.createdAt ?? new Date();
    const status: LiveDraftRoomStatus = input.startsAt !== undefined && input.startsAt.getTime() > createdAt.getTime()
      ? "countdown"
      : "setup";
    const revision = 1;
    const event: LiveDraftRoomEvent = {
      id: eventIdFor(input.roomId, revision, "room_created"),
      roomId: input.roomId,
      leagueId: input.season.leagueId,
      seasonId: input.season.id,
      revision,
      type: "room_created",
      actorUserId: input.commissionerUserId,
      occurredAt: createdAt,
    };
    const room = roomWithProjection({
      roomId: input.roomId,
      leagueId: input.season.leagueId,
      seasonId: input.season.id,
      status,
      commissionerUserId: input.commissionerUserId,
      ...(input.startsAt === undefined ? {} : { startsAt: input.startsAt }),
      viewerPasswordHashRef: input.viewerPasswordHashRef,
      revision,
      createdAt,
      updatedAt: createdAt,
      season: input.season,
      playerCatalog: normalizeCatalog(input.playerCatalog),
      initialRosters: [...(input.initialRosters ?? [])],
      events: [event],
    });

    this.#roomsById.set(room.roomId, room);

    return room;
  }

  getRoom(roomId: string): LiveDraftRoom {
    const room = this.#roomsById.get(roomId);
    if (room === undefined) {
      throw new LiveDraftRoomError("room_not_found", `Live draft room "${roomId}" was not found.`);
    }

    return room;
  }

  getRoomForActor(input: { roomId: string; actor: LiveDraftRoomActor }): LiveDraftRoom {
    const room = this.getRoom(input.roomId);
    assertReader(room, input.actor, this.authorizer);

    return room;
  }

  startRoom(input: MutateLiveDraftRoomInput): LiveDraftRoom {
    const room = this.getRoom(input.roomId);
    const mutationHash = mutationHashFor("start", {});
    assertWriter(room, input.actor, "start", this.authorizer);
    const replayedRoom = replayIdempotentMutation(room, "start", input.idempotencyKey, mutationHash);
    if (replayedRoom !== undefined) return replayedRoom;
    assertExpectedRevision(room, input.expectedRevision);
    assertRoomNotEnded(room);
    assertRoomCanStart(room);

    const now = input.now ?? new Date();
    const revision = room.revision + 1;
    const event: LiveDraftRoomEvent = {
      id: eventIdFor(room.roomId, revision, "room_started"),
      roomId: room.roomId,
      leagueId: room.leagueId,
      seasonId: room.seasonId,
      revision,
      type: "room_started",
      actorUserId: input.actor.userId,
      occurredAt: now,
      ...mutationMetadataFor(input, mutationHash),
    };
    const updatedRoom = appendEvent(room, event, "live", now);

    this.#roomsById.set(updatedRoom.roomId, updatedRoom);

    return updatedRoom;
  }

  logSaleCommand(input: LogLiveDraftRoomSaleInput): LiveDraftRoom {
    const room = this.getRoom(input.roomId);
    const mutationHash = mutationHashFor("log_sale", input.sale);
    assertWriter(room, input.actor, "log_sale", this.authorizer);
    const replayedRoom = replayIdempotentMutation(room, "log_sale", input.idempotencyKey, mutationHash);
    if (replayedRoom !== undefined) return replayedRoom;
    assertExpectedRevision(room, input.expectedRevision);
    assertRoomNotEnded(room);
    assertRoomLive(room);

    const now = input.now ?? new Date();
    const revision = room.revision + 1;
    const eventId = eventIdFor(room.roomId, revision, "sale_logged");
    const sale = buildSale(room, input.sale, eventId);
    validateSale(room, sale);

    const event: LiveDraftRoomEvent = {
      id: eventId,
      roomId: room.roomId,
      leagueId: room.leagueId,
      seasonId: room.seasonId,
      revision,
      type: "sale_logged",
      actorUserId: input.actor.userId,
      occurredAt: now,
      ...mutationMetadataFor(input, mutationHash),
      sale,
    };
    const updatedRoom = appendEvent(room, event, "live", now);

    this.#roomsById.set(updatedRoom.roomId, updatedRoom);

    return updatedRoom;
  }

  undoLastSale(input: MutateLiveDraftRoomInput): LiveDraftRoom {
    const room = this.getRoom(input.roomId);
    const mutationHash = mutationHashFor("undo_sale", {});
    assertWriter(room, input.actor, "undo_sale", this.authorizer);
    const replayedRoom = replayIdempotentMutation(room, "undo_sale", input.idempotencyKey, mutationHash);
    if (replayedRoom !== undefined) return replayedRoom;
    assertExpectedRevision(room, input.expectedRevision);
    assertRoomNotEnded(room);
    assertRoomLive(room);

    const lastSaleEvent = [...activeSaleEventsFor(room.events)].at(-1);
    if (lastSaleEvent === undefined) {
      throw new LiveDraftRoomError("no_sale_to_undo", "There is no sale to undo.");
    }

    const now = input.now ?? new Date();
    const revision = room.revision + 1;
    const event: LiveDraftRoomEvent = {
      id: eventIdFor(room.roomId, revision, "sale_undone"),
      roomId: room.roomId,
      leagueId: room.leagueId,
      seasonId: room.seasonId,
      revision,
      type: "sale_undone",
      actorUserId: input.actor.userId,
      occurredAt: now,
      ...mutationMetadataFor(input, mutationHash),
      undoneSaleEventId: lastSaleEvent.id,
      undoneSale: lastSaleEvent.sale,
    };
    const updatedRoom = appendEvent(room, event, "live", now);

    this.#roomsById.set(updatedRoom.roomId, updatedRoom);

    return updatedRoom;
  }

  endRoom(input: MutateLiveDraftRoomInput): LiveDraftRoom {
    const room = this.getRoom(input.roomId);
    const mutationHash = mutationHashFor("end", {});
    assertWriter(room, input.actor, "end", this.authorizer);
    const replayedRoom = replayIdempotentMutation(room, "end", input.idempotencyKey, mutationHash);
    if (replayedRoom !== undefined) return replayedRoom;
    assertExpectedRevision(room, input.expectedRevision);
    assertRoomNotEnded(room);

    const now = input.now ?? new Date();
    const revision = room.revision + 1;
    const event: LiveDraftRoomEvent = {
      id: eventIdFor(room.roomId, revision, "room_ended"),
      roomId: room.roomId,
      leagueId: room.leagueId,
      seasonId: room.seasonId,
      revision,
      type: "room_ended",
      actorUserId: input.actor.userId,
      occurredAt: now,
      ...mutationMetadataFor(input, mutationHash),
    };
    const updatedRoom = appendEvent(room, event, "ended", now, now);

    this.#roomsById.set(updatedRoom.roomId, updatedRoom);

    return updatedRoom;
  }
}
