import { competitiveAuctionBidFor } from "./auctionPriceFormation.js";
import { auctionCatalogCanFillOpenRosters } from "./auctionCatalogFeasibility.js";

export type GenericAuctionMockStatus = "setup" | "active" | "completed";

export type GenericAuctionMockPhase =
  | "not_started"
  | "awaiting_human_nomination"
  | "awaiting_human_bid"
  | "ready_to_complete"
  | "completed";

export interface GenericAuctionMockAiTendency {
  bidMultiplier?: number | undefined;
  positionBidMultipliers?: Readonly<Record<string, number>> | undefined;
  nominationPositionWeights?: Readonly<Record<string, number>> | undefined;
  randomness?: number | undefined;
}

export interface GenericAuctionMockTeamConfig {
  id: string;
  name: string;
  aiTendency?: GenericAuctionMockAiTendency | undefined;
}

export interface GenericAuctionMockRosterSlotConfig {
  slot: string;
  count: number;
  eligiblePositions: readonly string[];
}

export interface GenericAuctionMockPlayer {
  id: string;
  name: string;
  position: string;
  expectedPrice: number;
  humanValue?: number | undefined;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
  week1Projection?: number | undefined;
  weeks1To4Projection?: number | undefined;
  seasonProjection?: number | undefined;
  starterEligible?: boolean | undefined;
  projectedStarter?: boolean | undefined;
}

export interface GenericAuctionMockKeeper {
  teamId: string;
  playerId: string;
  price: number;
}

export interface GenericAuctionMockAiConfig {
  defaultBidMultiplier?: number | undefined;
  rosterNeedDollars?: number | undefined;
  randomness?: number | undefined;
  spendPacingExcludedPlayerIds?: readonly string[] | undefined;
  targetEndingBudgetDollars?: number | undefined;
}

export interface GenericAuctionMockConfig {
  sessionId: string;
  seed: string;
  humanTeamId: string;
  budgetDollars: number;
  minimumBidDollars: number;
  teams: readonly GenericAuctionMockTeamConfig[];
  rosterSlots: readonly GenericAuctionMockRosterSlotConfig[];
  positionMaximums: Readonly<Record<string, number>>;
  players: readonly GenericAuctionMockPlayer[];
  keepers?: readonly GenericAuctionMockKeeper[] | undefined;
  ai?: GenericAuctionMockAiConfig | undefined;
}

export type GenericAuctionMockPlayerStatus = "available" | "nominated" | "sold";

export interface GenericAuctionMockBoardPlayer extends GenericAuctionMockPlayer {
  status: GenericAuctionMockPlayerStatus;
  available: boolean;
}

export interface GenericAuctionMockRosterPlayer {
  playerId: string;
  playerName: string;
  position: string;
  expectedPrice: number;
  price: number;
  source: "keeper" | "human" | "ai";
  rosterSlot: string;
}

export interface GenericAuctionMockRosterSlot {
  slot: string;
  eligiblePositions: readonly string[];
  playerId: string | undefined;
}

export interface GenericAuctionMockTeamReadModel {
  id: string;
  name: string;
  isHuman: boolean;
  budgetDollars: number;
  spent: number;
  budgetRemaining: number;
  rosterSlotsRemaining: number;
  maxBid: number;
  positionCounts: Readonly<Record<string, number>>;
  roster: readonly GenericAuctionMockRosterPlayer[];
  slots: readonly GenericAuctionMockRosterSlot[];
}

export interface GenericAuctionMockSale {
  number: number;
  nominationNumber: number;
  playerId: string;
  playerName: string;
  position: string;
  expectedPrice: number;
  teamId: string;
  teamName: string;
  nominatedByTeamId: string;
  nominatedByTeamName: string;
  price: number;
  source: "keeper" | "human" | "ai";
}

export type GenericAuctionMockEventType = "nomination" | "bid" | "countdown" | "sold";

export interface GenericAuctionMockEvent {
  sequence: number;
  nominationNumber: number;
  type: GenericAuctionMockEventType;
  playerId: string;
  playerName: string;
  teamId?: string | undefined;
  teamName?: string | undefined;
  price?: number | undefined;
  countdown?: number | undefined;
  text: string;
}

export interface GenericAuctionMockNomination {
  number: number;
  playerId: string;
  playerName: string;
  position: string;
  expectedPrice: number;
  nominatedByTeamId: string;
  nominatedByTeamName: string;
  highestBidderTeamId: string;
  highestBidderTeamName: string;
  currentPrice: number;
  nextBid: number;
  humanCanBuy: boolean;
  humanCanPass: boolean;
  humanPassed: boolean;
}

export type GenericAuctionMockCommand =
  | {
    type: "start";
    expectedRevision: number;
  }
  | {
    type: "nominate";
    expectedRevision: number;
    playerId: string;
    openingBid?: number | undefined;
  }
  | {
    type: "buy";
    expectedRevision: number;
    price: number;
  }
  | {
    type: "pass";
    expectedRevision: number;
  }
  | {
    type: "undo";
    expectedRevision: number;
  }
  | {
    type: "complete";
    expectedRevision: number;
  };

export interface GenericAuctionMockSessionReadModel {
  id: string;
  status: GenericAuctionMockStatus;
  phase: GenericAuctionMockPhase;
  revision: number;
  seed: string;
  humanTeamId: string;
  nextNominatorTeamId: string | undefined;
  currentNomination: GenericAuctionMockNomination | undefined;
  nominationsCompleted: number;
  canUndo: boolean;
  canComplete: boolean;
  commandLog: readonly GenericAuctionMockCommand[];
}

export interface GenericAuctionMockBoardReadModel {
  players: readonly GenericAuctionMockBoardPlayer[];
}

interface GenericAuctionMockSnapshot {
  session: Pick<
    GenericAuctionMockSessionReadModel,
    | "status"
    | "phase"
    | "nextNominatorTeamId"
    | "currentNomination"
    | "nominationsCompleted"
    | "canComplete"
  > & { nextNominatorIndex: number };
  board: GenericAuctionMockBoardReadModel;
  teams: readonly GenericAuctionMockTeamReadModel[];
  sales: readonly GenericAuctionMockSale[];
  auctionEvents: readonly GenericAuctionMockEvent[];
}

export interface GenericAuctionMockState {
  readonly configuration: GenericAuctionMockConfig;
  session: GenericAuctionMockSessionReadModel;
  board: GenericAuctionMockBoardReadModel;
  teams: readonly GenericAuctionMockTeamReadModel[];
  sales: readonly GenericAuctionMockSale[];
  auctionEvents: readonly GenericAuctionMockEvent[];
  readonly decisionHistory: readonly GenericAuctionMockSnapshot[];
  readonly nextNominatorIndex: number;
}

export type GenericAuctionMockErrorCode =
  | "draft_incomplete"
  | "duplicate_player"
  | "invalid_config"
  | "invalid_decision"
  | "invalid_keeper"
  | "invalid_price"
  | "invalid_status"
  | "max_bid_exceeded"
  | "no_decision_to_undo"
  | "no_eligible_player"
  | "player_not_found"
  | "position_limit"
  | "roster_full"
  | "roster_limit"
  | "stale_revision"
  | "team_not_found";

export class GenericAuctionMockError extends Error {
  readonly code: GenericAuctionMockErrorCode;

  constructor(code: GenericAuctionMockErrorCode, message: string) {
    super(message);
    this.name = "GenericAuctionMockError";
    this.code = code;
  }
}

const isNonBlank = (value: string): boolean => value.trim().length > 0;

const isNonNegativeFinite = (value: number): boolean => Number.isFinite(value) && value >= 0;

const assertNonNegativeMap = (values: Readonly<Record<string, number>>, label: string): void => {
  for (const [key, value] of Object.entries(values)) {
    if (!isNonBlank(key) || !isNonNegativeFinite(value)) {
      throw new GenericAuctionMockError(
        "invalid_config",
        `${label} must use non-blank keys and non-negative finite values.`,
      );
    }
  }
};

const expandedRosterSlotName = (
  slot: GenericAuctionMockRosterSlotConfig,
  index: number,
): string => slot.count === 1 ? slot.slot : `${slot.slot}${index + 1}`;

const rosterCapacityFor = (config: GenericAuctionMockConfig): number =>
  config.rosterSlots.reduce((total, slot) => total + slot.count, 0);

const assertConfiguration = (config: GenericAuctionMockConfig): void => {
  if (!isNonBlank(config.sessionId) || !isNonBlank(config.seed)) {
    throw new GenericAuctionMockError("invalid_config", "Auction session id and seed are required.");
  }

  if (config.teams.length < 4 || config.teams.length > 20) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Auction mocks require between 4 and 20 teams.",
    );
  }

  const teamIds = config.teams.map(team => team.id);
  if (
    new Set(teamIds).size !== teamIds.length
    || config.teams.some(team => !isNonBlank(team.id) || !isNonBlank(team.name))
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Every auction team needs a unique non-blank id and a non-blank name.",
    );
  }

  if (!teamIds.includes(config.humanTeamId)) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Human team id must identify a configured team.",
    );
  }

  if (
    !Number.isInteger(config.minimumBidDollars)
    || config.minimumBidDollars <= 0
    || !Number.isInteger(config.budgetDollars)
    || config.budgetDollars <= 0
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Auction budget and minimum bid must be positive whole-dollar amounts.",
    );
  }

  if (
    config.rosterSlots.length === 0
    || config.rosterSlots.some(slot =>
      !isNonBlank(slot.slot)
      || !Number.isInteger(slot.count)
      || slot.count <= 0
      || slot.eligiblePositions.length === 0
      || slot.eligiblePositions.some(position => !isNonBlank(position))
      || new Set(slot.eligiblePositions).size !== slot.eligiblePositions.length
    )
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Roster slots require a name, positive count, and unique eligible positions.",
    );
  }

  const slotNames = config.rosterSlots.map(slot => slot.slot);
  const expandedSlotNames = config.rosterSlots.flatMap(slot =>
    Array.from({ length: slot.count }, (_, index) => expandedRosterSlotName(slot, index)),
  );
  if (
    new Set(slotNames).size !== slotNames.length
    || new Set(expandedSlotNames).size !== expandedSlotNames.length
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Roster slot names must remain unique after their counts are expanded.",
    );
  }

  const rosterCapacity = rosterCapacityFor(config);
  if (config.budgetDollars < rosterCapacity * config.minimumBidDollars) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Auction budget must reserve the minimum bid for every roster slot.",
    );
  }

  if (Object.keys(config.positionMaximums).length === 0) {
    throw new GenericAuctionMockError("invalid_config", "At least one position maximum is required.");
  }
  for (const [position, maximum] of Object.entries(config.positionMaximums)) {
    if (!isNonBlank(position) || !Number.isInteger(maximum) || maximum < 0) {
      throw new GenericAuctionMockError(
        "invalid_config",
        "Position maximums must be non-negative whole numbers keyed by position.",
      );
    }
  }

  const eligiblePositions = new Set(config.rosterSlots.flatMap(slot => slot.eligiblePositions));
  const playerIds = config.players.map(player => player.id);
  if (
    new Set(playerIds).size !== playerIds.length
    || config.players.some(player =>
      !isNonBlank(player.id)
      || !isNonBlank(player.name)
      || !isNonBlank(player.position)
      || !isNonNegativeFinite(player.expectedPrice)
      || (player.humanValue !== undefined && !isNonNegativeFinite(player.humanValue))
      || (player.week1Projection !== undefined && !isNonNegativeFinite(player.week1Projection))
      || (player.weeks1To4Projection !== undefined
        && !isNonNegativeFinite(player.weeks1To4Projection))
      || (player.seasonProjection !== undefined && !isNonNegativeFinite(player.seasonProjection))
      || (player.starterEligible !== undefined && typeof player.starterEligible !== "boolean")
      || (player.projectedStarter !== undefined && typeof player.projectedStarter !== "boolean")
    )
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Every player needs a unique id, name, position, and non-negative expected price.",
    );
  }

  const configuredPositions = new Set(Object.keys(config.positionMaximums));
  if (
    [...eligiblePositions].some(position => !configuredPositions.has(position))
    || config.players.some(player => !configuredPositions.has(player.position))
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Every roster and player position must have an explicit position maximum.",
    );
  }

  const aiValues = [
    config.ai?.defaultBidMultiplier,
    config.ai?.rosterNeedDollars,
    config.ai?.randomness,
  ].filter((value): value is number => value !== undefined);
  if (aiValues.some(value => !isNonNegativeFinite(value))) {
    throw new GenericAuctionMockError("invalid_config", "AI settings must be non-negative finite numbers.");
  }
  if (
    config.ai?.targetEndingBudgetDollars !== undefined
    && (!Number.isInteger(config.ai.targetEndingBudgetDollars)
      || config.ai.targetEndingBudgetDollars < 0
      || config.ai.targetEndingBudgetDollars >= config.budgetDollars)
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "AI target ending budget must be a non-negative whole-dollar amount below the auction budget.",
    );
  }
  const spendPacingExcludedPlayerIds = config.ai?.spendPacingExcludedPlayerIds ?? [];
  if (
    new Set(spendPacingExcludedPlayerIds).size !== spendPacingExcludedPlayerIds.length
    || spendPacingExcludedPlayerIds.some(playerId => !playerIds.includes(playerId))
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "AI spend-pacing exclusions must reference unique players in the auction catalog.",
    );
  }

  for (const team of config.teams) {
    const tendency = team.aiTendency;
    if (
      tendency?.bidMultiplier !== undefined
      && !isNonNegativeFinite(tendency.bidMultiplier)
    ) {
      throw new GenericAuctionMockError(
        "invalid_config",
        "AI bid multipliers must be non-negative finite numbers.",
      );
    }
    if (tendency?.randomness !== undefined && !isNonNegativeFinite(tendency.randomness)) {
      throw new GenericAuctionMockError(
        "invalid_config",
        "AI randomness must be a non-negative finite number.",
      );
    }
    if (tendency?.positionBidMultipliers !== undefined) {
      assertNonNegativeMap(tendency.positionBidMultipliers, "AI position bid multipliers");
    }
    if (tendency?.nominationPositionWeights !== undefined) {
      assertNonNegativeMap(tendency.nominationPositionWeights, "AI nomination weights");
    }
  }
};

const maxBidFor = (
  budgetRemaining: number,
  rosterSlotsRemaining: number,
  minimumBid: number,
): number => rosterSlotsRemaining <= 0
  ? 0
  : Math.max(0, budgetRemaining - Math.max(0, rosterSlotsRemaining - 1) * minimumBid);

const positionKeysFor = (config: GenericAuctionMockConfig): readonly string[] =>
  Object.keys(config.positionMaximums);

const emptyPositionCounts = (
  config: GenericAuctionMockConfig,
): Readonly<Record<string, number>> => Object.fromEntries(
  positionKeysFor(config).map(position => [position, 0]),
);

const buildRosterSlots = (
  config: GenericAuctionMockConfig,
): readonly GenericAuctionMockRosterSlot[] => config.rosterSlots.flatMap(slot =>
  Array.from({ length: slot.count }, (_, index) => ({
    slot: expandedRosterSlotName(slot, index),
    eligiblePositions: [...slot.eligiblePositions],
    playerId: undefined,
  })),
);

const deterministicFraction = (value: string): number => {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0) / 4_294_967_296;
};

const teamFor = (
  state: GenericAuctionMockState,
  teamId: string,
): GenericAuctionMockTeamReadModel => {
  const team = state.teams.find(candidate => candidate.id === teamId);
  if (team === undefined) {
    throw new GenericAuctionMockError("team_not_found", `Unknown auction team "${teamId}".`);
  }

  return team;
};

const playerFor = (
  state: GenericAuctionMockState,
  playerId: string,
): GenericAuctionMockBoardPlayer => {
  const player = state.board.players.find(candidate => candidate.id === playerId);
  if (player === undefined) {
    throw new GenericAuctionMockError("player_not_found", `Unknown auction player "${playerId}".`);
  }

  return player;
};

const assignableSlotFor = (
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
  preferFlexibleSlot = false,
): GenericAuctionMockRosterSlot | undefined => team.slots
  .filter(slot => slot.playerId === undefined && slot.eligiblePositions.includes(player.position))
  .sort((left, right) => {
    const flexibilityDifference = left.eligiblePositions.length - right.eligiblePositions.length;
    const preferredDifference = preferFlexibleSlot
      ? -flexibilityDifference
      : flexibilityDifference;
    return preferredDifference || left.slot.localeCompare(right.slot);
  })[0];

const canAcquire = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
  price: number,
): boolean => Number.isInteger(price)
  && price >= state.configuration.minimumBidDollars
  && team.rosterSlotsRemaining > 0
  && price <= team.maxBid
  && (team.positionCounts[player.position] ?? 0)
    < (state.configuration.positionMaximums[player.position] ?? 0)
  && assignableSlotFor(team, player) !== undefined;

const assertPrice = (state: GenericAuctionMockState, price: number): void => {
  if (!Number.isInteger(price) || price < state.configuration.minimumBidDollars) {
    throw new GenericAuctionMockError(
      "invalid_price",
      `Auction bids must be whole-dollar amounts of at least $${state.configuration.minimumBidDollars}.`,
    );
  }
};

const assertCanAcquire = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
  price: number,
  preferFlexibleSlot = false,
): GenericAuctionMockRosterSlot => {
  assertPrice(state, price);

  if (team.rosterSlotsRemaining <= 0) {
    throw new GenericAuctionMockError("roster_full", `${team.name} has no open roster slots.`);
  }
  if (price > team.maxBid) {
    throw new GenericAuctionMockError(
      "max_bid_exceeded",
      `${team.name} cannot bid $${price}; its max bid is $${team.maxBid}.`,
    );
  }

  const maximum = state.configuration.positionMaximums[player.position] ?? 0;
  if ((team.positionCounts[player.position] ?? 0) >= maximum) {
    throw new GenericAuctionMockError(
      "position_limit",
      `${team.name} has reached its ${player.position} maximum of ${maximum}.`,
    );
  }

  const slot = assignableSlotFor(team, player, preferFlexibleSlot);
  if (slot === undefined) {
    throw new GenericAuctionMockError(
      "roster_limit",
      `${team.name} has no open roster slot eligible for ${player.position}.`,
    );
  }

  return slot;
};

const rosterNeedFor = (
  team: GenericAuctionMockTeamReadModel,
  position: string,
): number => team.slots
  .filter(slot => slot.playerId === undefined && slot.eligiblePositions.includes(position))
  .reduce((total, slot) => total + (1 / slot.eligiblePositions.length), 0);

interface GenericAuctionMockAnalysisCache {
  availablePlayersByExpectedPrice: readonly GenericAuctionMockBoardPlayer[] | undefined;
  eligibleAiTeamsByPlayerId: Map<string, readonly GenericAuctionMockTeamReadModel[]>;
  projectedRosterPricesByTeamAndPlayerId: Map<string, readonly number[]>;
  projectedRbOrWrAlternativeByTeamId: Map<string, boolean>;
  remainingStarterEligiblePlayersByPosition: Map<string, readonly GenericAuctionMockBoardPlayer[]>;
  starterEligibilitySignalByPosition: Map<string, boolean>;
}

interface GenericAuctionMockAnalysisCacheEntry {
  teams: readonly GenericAuctionMockTeamReadModel[];
  cache: GenericAuctionMockAnalysisCache;
}

const analysisCacheByBoard = new WeakMap<
  GenericAuctionMockBoardReadModel,
  GenericAuctionMockAnalysisCacheEntry
>();

const analysisCacheFor = (state: GenericAuctionMockState): GenericAuctionMockAnalysisCache => {
  const cached = analysisCacheByBoard.get(state.board);
  if (cached?.teams === state.teams) return cached.cache;

  const created: GenericAuctionMockAnalysisCache = {
    availablePlayersByExpectedPrice: undefined,
    eligibleAiTeamsByPlayerId: new Map(),
    projectedRosterPricesByTeamAndPlayerId: new Map(),
    projectedRbOrWrAlternativeByTeamId: new Map(),
    remainingStarterEligiblePlayersByPosition: new Map(),
    starterEligibilitySignalByPosition: new Map(),
  };
  analysisCacheByBoard.set(state.board, { teams: state.teams, cache: created });
  return created;
};

const eligibleAiTeamsFor = (
  state: GenericAuctionMockState,
  player: GenericAuctionMockPlayer,
): readonly GenericAuctionMockTeamReadModel[] => {
  const byPlayer = analysisCacheFor(state).eligibleAiTeamsByPlayerId;
  const cached = byPlayer.get(player.id);
  if (cached !== undefined) return cached;

  const eligible = state.teams.filter(team =>
    !team.isHuman
    && canAcquire(state, team, player, state.configuration.minimumBidDollars)
    && isAutomatedAuctionAcquisitionEligible(state, team, player)
  );
  byPlayer.set(player.id, eligible);
  return eligible;
};

const averageRosterNeedFor = (
  teams: readonly GenericAuctionMockTeamReadModel[],
  position: string,
): number => teams.length === 0
  ? 0
  : teams.reduce((total, team) => total + rosterNeedFor(team, position), 0) / teams.length;

const positionScarcityMultiplierFor = (
  state: GenericAuctionMockState,
  player: GenericAuctionMockPlayer,
): number => {
  const originalSupply = state.configuration.players
    .filter(candidate => candidate.position === player.position)
    .length;
  const remainingSupply = state.board.players.filter(candidate =>
    candidate.position === player.position && candidate.status !== "sold"
  ).length;
  if (originalSupply === 0 || remainingSupply === 0) return 1;

  const depletion = Math.max(0, 1 - remainingSupply / originalSupply);
  const openDemand = state.teams.reduce(
    (total, team) => total + rosterNeedFor(team, player.position),
    0,
  );
  const demandPressure = Math.min(1, openDemand / remainingSupply);

  return 1 + depletion * demandPressure * 0.15;
};

const expectedSecondHighestNoiseFraction = (bidderCount: number): number =>
  bidderCount < 2 ? 0 : (bidderCount - 3) / (bidderCount + 1);

const auctionClearingPriceCushionDollars = 2;

const projectedWeeklyProductionFor = (player: GenericAuctionMockPlayer): number =>
  player.week1Projection
  ?? (player.weeks1To4Projection === undefined ? undefined : player.weeks1To4Projection / 4)
  ?? (player.seasonProjection === undefined ? 0 : player.seasonProjection / 17);

const projectedSeasonProductionFor = (player: GenericAuctionMockPlayer): number =>
  player.seasonProjection
  ?? (player.weeks1To4Projection === undefined ? undefined : player.weeks1To4Projection * 4.25)
  ?? (player.week1Projection === undefined ? 0 : player.week1Projection * 17);

const isStarterEligible = (player: GenericAuctionMockPlayer): boolean =>
  player.starterEligible ?? (player.projectedStarter === true);

const hasStarterEligibilitySignalFor = (
  state: GenericAuctionMockState,
  position: string,
): boolean => {
  const byPosition = analysisCacheFor(state).starterEligibilitySignalByPosition;
  const cached = byPosition.get(position);
  if (cached !== undefined) return cached;

  const configured = state.configuration.players.some(player =>
    player.position === position
    && player.starterEligible !== undefined
  );
  byPosition.set(position, configured);
  return configured;
};

const hasOpenDedicatedStarterSlotFor = (
  team: GenericAuctionMockTeamReadModel,
  position: string,
): boolean => team.slots.some(slot =>
  slot.playerId === undefined
  && slot.eligiblePositions.length === 1
  && slot.eligiblePositions[0] === position
);

const openDedicatedStarterDemandFor = (
  state: GenericAuctionMockState,
  position: string,
): number => state.teams.reduce((total, team) => total + team.slots.filter(slot =>
  slot.playerId === undefined
  && slot.eligiblePositions.length === 1
  && slot.eligiblePositions[0] === position
).length, 0);

const remainingStarterEligiblePlayersFor = (
  state: GenericAuctionMockState,
  position: string,
): readonly GenericAuctionMockBoardPlayer[] => {
  const byPosition = analysisCacheFor(state).remainingStarterEligiblePlayersByPosition;
  const cached = byPosition.get(position);
  if (cached !== undefined) return cached;

  const remaining = state.board.players.filter(player =>
    player.position === position
    && isStarterEligible(player)
    && player.status !== "sold"
  );
  byPosition.set(position, remaining);
  return remaining;
};

const benchOnlySpecialistPositions = new Set(["QB", "TE", "K", "DST"]);

const hasProjectedRbOrWrAlternative = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
): boolean => {
  const byTeam = analysisCacheFor(state).projectedRbOrWrAlternativeByTeamId;
  const cached = byTeam.get(team.id);
  if (cached !== undefined) return cached;

  const hasAlternative = state.board.players.some(candidate =>
    candidate.status === "available"
    && (candidate.position === "RB" || candidate.position === "WR")
    && projectedWeeklyProductionFor(candidate) > 0
    && canAcquire(state, team, candidate, state.configuration.minimumBidDollars)
  );
  byTeam.set(team.id, hasAlternative);
  return hasAlternative;
};

const bestPositiveStarterFallbackFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  position: string,
): GenericAuctionMockBoardPlayer | undefined => state.board.players
  .filter(candidate =>
    candidate.position === position
    && candidate.status !== "sold"
    && projectedWeeklyProductionFor(candidate) > 0
    && canAcquire(state, team, candidate, state.configuration.minimumBidDollars)
  )
  .sort((left, right) =>
    projectedWeeklyProductionFor(right) - projectedWeeklyProductionFor(left)
    || projectedSeasonProductionFor(right) - projectedSeasonProductionFor(left)
    || right.expectedPrice - left.expectedPrice
    || left.id.localeCompare(right.id)
  )[0];

export const isAutomatedAuctionAcquisitionEligible = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
): boolean => {
  const assignedSlot = assignableSlotFor(team, player);
  if (assignedSlot === undefined) return false;
  if (!hasStarterEligibilitySignalFor(state, player.position)) return true;
  if (
    benchOnlySpecialistPositions.has(player.position)
    && !hasOpenDedicatedStarterSlotFor(team, player.position)
    && hasProjectedRbOrWrAlternative(state, team)
  ) return false;

  const starterEligiblePlayers = remainingStarterEligiblePlayersFor(state, player.position);

  if (hasOpenDedicatedStarterSlotFor(team, player.position)) {
    if (starterEligiblePlayers.some(candidate =>
      canAcquire(state, team, candidate, state.configuration.minimumBidDollars)
    )) return isStarterEligible(player);

    return bestPositiveStarterFallbackFor(state, team, player.position)?.id === player.id;
  }
  if (!isStarterEligible(player)) return true;

  return starterEligiblePlayers.length > openDedicatedStarterDemandFor(state, player.position);
};

export const maximumAutomatedAuctionBidFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
): number => {
  const assignedSlot = assignableSlotFor(team, player);
  if (assignedSlot === undefined) return 0;

  const remainingSlots = team.slots.filter(slot =>
    slot.playerId === undefined && slot.slot !== assignedSlot.slot
  );
  let reserve = remainingSlots.length * state.configuration.minimumBidDollars;
  const positionsNeedingStarterEligiblePlayers = new Set(remainingSlots
    .filter(slot => slot.eligiblePositions.length === 1)
    .map(slot => slot.eligiblePositions[0])
    .filter((position): position is string => position !== undefined));

  for (const position of positionsNeedingStarterEligiblePlayers) {
    const needed = remainingSlots.filter(slot =>
      slot.eligiblePositions.length === 1 && slot.eligiblePositions[0] === position
    ).length;
    const affordableStarters = remainingStarterEligiblePlayersFor(state, position)
      .filter(candidate => candidate.id !== player.id)
      .sort((left, right) =>
        left.expectedPrice - right.expectedPrice
        || projectedWeeklyProductionFor(right) - projectedWeeklyProductionFor(left)
        || left.id.localeCompare(right.id)
      )
      .slice(0, needed);
    if (affordableStarters.length < needed) continue;

    reserve += affordableStarters.reduce((total, starter) => total + Math.max(
      0,
      Math.round(starter.expectedPrice)
        + auctionClearingPriceCushionDollars
        - state.configuration.minimumBidDollars,
    ), 0);
  }

  return Math.max(0, team.budgetRemaining - reserve);
};

const projectedRosterPricesAfterAcquiring = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
): readonly number[] => {
  const analysis = analysisCacheFor(state);
  const cacheKey = `${team.id}\u0000${player.id}`;
  const cached = analysis.projectedRosterPricesByTeamAndPlayerId.get(cacheKey);
  if (cached !== undefined) return cached;

  const assignedSlot = assignableSlotFor(team, player);
  if (assignedSlot === undefined) return [];

  const openSlots = team.slots
    .filter(slot => slot.playerId === undefined && slot.slot !== assignedSlot.slot)
    .map(slot => ({ ...slot }));
  const positionCounts = {
    ...team.positionCounts,
    [player.position]: (team.positionCounts[player.position] ?? 0) + 1,
  };
  const prices = [player.expectedPrice];
  const candidates = analysis.availablePlayersByExpectedPrice ?? state.board.players
    .filter(candidate => candidate.status === "available")
    .sort((left, right) =>
      right.expectedPrice - left.expectedPrice || left.id.localeCompare(right.id)
    );
  analysis.availablePlayersByExpectedPrice = candidates;

  for (const candidate of candidates) {
    if (prices.length >= team.rosterSlotsRemaining) break;
    if (candidate.id === player.id) continue;
    if ((positionCounts[candidate.position] ?? 0)
      >= (state.configuration.positionMaximums[candidate.position] ?? 0)) continue;
    const slotIndex = openSlots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot.eligiblePositions.includes(candidate.position))
      .sort((left, right) =>
        left.slot.eligiblePositions.length - right.slot.eligiblePositions.length
        || left.slot.slot.localeCompare(right.slot.slot)
      )[0]?.index;
    if (slotIndex === undefined) continue;

    openSlots.splice(slotIndex, 1);
    positionCounts[candidate.position] = (positionCounts[candidate.position] ?? 0) + 1;
    prices.push(candidate.expectedPrice);
  }

  analysis.projectedRosterPricesByTeamAndPlayerId.set(cacheKey, prices);
  return prices;
};

const aiSpendPacingBidFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
  ignoreExclusions = false,
): number => {
  const targetEndingBudget = state.configuration.ai?.targetEndingBudgetDollars;
  if (
    targetEndingBudget === undefined
    || team.rosterSlotsRemaining <= 0
    || (!ignoreExclusions
      && state.configuration.ai?.spendPacingExcludedPlayerIds?.includes(player.id))
  ) return 0;

  const minimumBid = state.configuration.minimumBidDollars;
  const projectedPrices = projectedRosterPricesAfterAcquiring(state, team, player);
  if (projectedPrices.length !== team.rosterSlotsRemaining) return 0;

  const discretionaryBudget = Math.max(
    0,
    team.budgetRemaining - targetEndingBudget - team.rosterSlotsRemaining * minimumBid,
  );
  const projectedDiscretionaryValue = projectedPrices.reduce(
    (total, price) => total + Math.max(0, price - minimumBid),
    0,
  );
  const playerWeight = Math.max(0, player.expectedPrice - minimumBid);
  const playerShare = projectedDiscretionaryValue === 0
    ? Math.floor(discretionaryBudget / team.rosterSlotsRemaining)
    : Math.ceil(discretionaryBudget * playerWeight / projectedDiscretionaryValue);

  return Math.min(
    team.maxBid,
    minimumBid + playerShare + auctionClearingPriceCushionDollars,
  );
};

const aiMaxBidFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
  nominationNumber: number,
  ignoreSpendPacingExclusions = false,
): number => {
  if (!canAcquire(state, team, player, state.configuration.minimumBidDollars)) return 0;
  if (!isAutomatedAuctionAcquisitionEligible(state, team, player)) return 0;

  const tendency = state.configuration.teams.find(candidate => candidate.id === team.id)?.aiTendency;
  const bidMultiplier = tendency?.bidMultiplier
    ?? state.configuration.ai?.defaultBidMultiplier
    ?? 1;
  const positionMultiplier = tendency?.positionBidMultipliers?.[player.position] ?? 1;
  const needDollars = state.configuration.ai?.rosterNeedDollars ?? 1;
  const randomness = tendency?.randomness ?? state.configuration.ai?.randomness ?? 0.08;
  const eligibleAiTeams = eligibleAiTeamsFor(state, player);
  const relativeRosterNeed = rosterNeedFor(team, player.position)
    - averageRosterNeedFor(eligibleAiTeams, player.position);
  const scarcityMultiplier = positionScarcityMultiplierFor(state, player);
  // Market is already a clearing-price estimate, so remove the predictable
  // second-highest-bid lift before applying owner-level random variation.
  const competitionNoiseBias = player.expectedPrice
    * randomness
    * expectedSecondHighestNoiseFraction(eligibleAiTeams.length);
  const noise = (
    deterministicFraction(
      `${state.session.seed}:bid:${nominationNumber}:${team.id}:${player.id}`,
    ) * 2 - 1
  ) * player.expectedPrice * randomness;
  const willingness = Math.max(0, Math.round(
    player.expectedPrice * bidMultiplier * positionMultiplier
    + player.expectedPrice * (scarcityMultiplier - 1)
    + relativeRosterNeed * needDollars
    + noise
    - competitionNoiseBias,
  ));

  return Math.min(team.maxBid, maximumAutomatedAuctionBidFor(state, team, player), Math.max(
    willingness,
    aiSpendPacingBidFor(state, team, player, ignoreSpendPacingExclusions),
  ));
};

const nominationScoreFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
  nominationNumber: number,
): number => {
  const tendency = state.configuration.teams.find(candidate => candidate.id === team.id)?.aiTendency;
  const positionWeight = tendency?.nominationPositionWeights?.[player.position] ?? 1;
  const needWeight = state.configuration.ai?.rosterNeedDollars ?? 1;
  const projectedStarterNeed = isStarterEligible(player)
    && hasOpenDedicatedStarterSlotFor(team, player.position);

  return player.expectedPrice * positionWeight
    + (projectedStarterNeed ? 1_000 : 0)
    + (player.week1Projection === 0 ? -10_000 : 0)
    + rosterNeedFor(team, player.position) * needWeight
    + projectedWeeklyProductionFor(player) * 0.01
    + deterministicFraction(
      `${state.session.seed}:nomination:${nominationNumber}:${team.id}:${player.id}`,
    ) * 0.001;
};

const nextNominator = (
  state: GenericAuctionMockState,
): { team: GenericAuctionMockTeamReadModel; index: number } | undefined => {
  for (let offset = 0; offset < state.teams.length; offset += 1) {
    const index = (state.nextNominatorIndex + offset) % state.teams.length;
    const team = state.teams[index];
    if (team !== undefined && team.rosterSlotsRemaining > 0) return { team, index };
  }

  return undefined;
};

const availableNominationPlayersFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
): readonly GenericAuctionMockBoardPlayer[] => state.board.players.filter(player =>
  player.status === "available"
  && canAcquire(state, team, player, state.configuration.minimumBidDollars)
  && (team.isHuman || isAutomatedAuctionAcquisitionEligible(state, team, player)),
);

const selectAiNomination = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
): GenericAuctionMockBoardPlayer => {
  const nominationNumber = state.session.nominationsCompleted + 1;
  const selected = availableNominationPlayersFor(state, team)
    .map(player => ({
      player,
      score: nominationScoreFor(state, team, player, nominationNumber),
    }))
    .sort((left, right) =>
      right.score - left.score
      || right.player.expectedPrice - left.player.expectedPrice
      || left.player.id.localeCompare(right.player.id)
    )[0]?.player;

  if (selected === undefined) {
    throw new GenericAuctionMockError(
      "no_eligible_player",
      `${team.name} cannot fill its remaining roster slots from the available player catalog.`,
    );
  }

  return selected;
};

const setBoardPlayerStatus = (
  state: GenericAuctionMockState,
  playerId: string,
  status: GenericAuctionMockPlayerStatus,
): GenericAuctionMockBoardReadModel => ({
  players: state.board.players.map(player => player.id === playerId ? {
    ...player,
    status,
    available: status === "available",
  } : player),
});

const nominationFor = ({
  state,
  player,
  nominatedByTeam,
  highestBidderTeam,
  currentPrice,
  humanPassed,
  humanCanBuy = false,
}: {
  state: GenericAuctionMockState;
  player: GenericAuctionMockPlayer;
  nominatedByTeam: GenericAuctionMockTeamReadModel;
  highestBidderTeam: GenericAuctionMockTeamReadModel;
  currentPrice: number;
  humanPassed: boolean;
  humanCanBuy?: boolean | undefined;
}): GenericAuctionMockNomination => ({
  number: state.session.nominationsCompleted + 1,
  playerId: player.id,
  playerName: player.name,
  position: player.position,
  expectedPrice: player.expectedPrice,
  nominatedByTeamId: nominatedByTeam.id,
  nominatedByTeamName: nominatedByTeam.name,
  highestBidderTeamId: highestBidderTeam.id,
  highestBidderTeamName: highestBidderTeam.name,
  currentPrice,
  nextBid: currentPrice + 1,
  humanCanBuy,
  humanCanPass: humanCanBuy,
  humanPassed,
});

type AuctionEventInput = Omit<GenericAuctionMockEvent, "sequence">;

const withAuctionEvents = (
  state: GenericAuctionMockState,
  events: readonly AuctionEventInput[],
): GenericAuctionMockState => events.length === 0 ? state : ({
  ...state,
  auctionEvents: [
    ...state.auctionEvents,
    ...events.map((event, index) => ({
      ...event,
      sequence: state.auctionEvents.length + index + 1,
    })),
  ],
});

const bidEventFor = (
  nomination: GenericAuctionMockNomination,
  team: GenericAuctionMockTeamReadModel,
  price: number,
): AuctionEventInput => ({
  nominationNumber: nomination.number,
  type: "bid",
  playerId: nomination.playerId,
  playerName: nomination.playerName,
  teamId: team.id,
  teamName: team.name,
  price,
  text: `${team.name} bid $${price}`,
});

const openNomination = (
  state: GenericAuctionMockState,
  nominator: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockBoardPlayer,
  openingBid: number,
): GenericAuctionMockState => {
  if (player.status !== "available") {
    throw new GenericAuctionMockError("duplicate_player", `${player.name} is already unavailable.`);
  }
  assertCanAcquire(state, nominator, player, openingBid);

  const opened: GenericAuctionMockState = {
    ...state,
    board: setBoardPlayerStatus(state, player.id, "nominated"),
    session: {
      ...state.session,
      nextNominatorTeamId: undefined,
      currentNomination: nominationFor({
        state,
        player,
        nominatedByTeam: nominator,
        highestBidderTeam: nominator,
        currentPrice: openingBid,
        humanPassed: false,
      }),
    },
  };

  return withAuctionEvents(opened, [{
    nominationNumber: state.session.nominationsCompleted + 1,
    type: "nomination",
    playerId: player.id,
    playerName: player.name,
    teamId: nominator.id,
    teamName: nominator.name,
    price: openingBid,
    text: `${nominator.name} nominated ${player.name} at $${openingBid}`,
  }]);
};

const addAcquisition = ({
  state,
  player,
  team,
  price,
  source,
  nominatedByTeam,
  nominationNumber,
}: {
  state: GenericAuctionMockState;
  player: GenericAuctionMockBoardPlayer;
  team: GenericAuctionMockTeamReadModel;
  price: number;
  source: GenericAuctionMockSale["source"];
  nominatedByTeam: GenericAuctionMockTeamReadModel;
  nominationNumber: number;
}): GenericAuctionMockState => {
  if (player.status === "sold") {
    throw new GenericAuctionMockError("duplicate_player", `${player.name} is already unavailable.`);
  }
  const preferFlexibleSlot = source === "keeper"
    && hasStarterEligibilitySignalFor(state, player.position)
    && !isStarterEligible(player);
  const slot = assertCanAcquire(state, team, player, price, preferFlexibleSlot);
  const rosterPlayer: GenericAuctionMockRosterPlayer = {
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    expectedPrice: player.expectedPrice,
    price,
    source,
    rosterSlot: slot.slot,
  };
  const roster = [...team.roster, rosterPlayer];
  const spent = team.spent + price;
  const rosterSlotsRemaining = team.rosterSlotsRemaining - 1;
  const positionCounts = {
    ...team.positionCounts,
    [player.position]: (team.positionCounts[player.position] ?? 0) + 1,
  };
  const nextTeam: GenericAuctionMockTeamReadModel = {
    ...team,
    spent,
    budgetRemaining: team.budgetDollars - spent,
    rosterSlotsRemaining,
    maxBid: maxBidFor(
      team.budgetDollars - spent,
      rosterSlotsRemaining,
      state.configuration.minimumBidDollars,
    ),
    positionCounts,
    roster,
    slots: team.slots.map(candidate => candidate.slot === slot.slot
      ? { ...candidate, playerId: player.id }
      : candidate),
  };
  const sale: GenericAuctionMockSale = {
    number: state.sales.length + 1,
    nominationNumber,
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    expectedPrice: player.expectedPrice,
    teamId: team.id,
    teamName: team.name,
    nominatedByTeamId: nominatedByTeam.id,
    nominatedByTeamName: nominatedByTeam.name,
    price,
    source,
  };

  return {
    ...state,
    board: setBoardPlayerStatus(state, player.id, "sold"),
    teams: state.teams.map(candidate => candidate.id === team.id ? nextTeam : candidate),
    sales: [...state.sales, sale],
  };
};

const applyKeepers = (state: GenericAuctionMockState): GenericAuctionMockState => {
  let nextState = state;

  for (const keeper of state.configuration.keepers ?? []) {
    if (!Number.isInteger(keeper.price) || keeper.price < state.configuration.minimumBidDollars) {
      throw new GenericAuctionMockError(
        "invalid_keeper",
        `Keeper prices must be at least $${state.configuration.minimumBidDollars} in whole dollars.`,
      );
    }

    const team = teamFor(nextState, keeper.teamId);
    const player = playerFor(nextState, keeper.playerId);
    nextState = addAcquisition({
      state: nextState,
      player,
      team,
      price: keeper.price,
      source: "keeper",
      nominatedByTeam: team,
      nominationNumber: 0,
    });
  }

  return nextState;
};

interface AiMaximum {
  team: GenericAuctionMockTeamReadModel;
  maximum: number;
}

const aiMaximumsFor = (
  state: GenericAuctionMockState,
  nomination: GenericAuctionMockNomination,
  forceSpendPacing = false,
): readonly AiMaximum[] => {
  const player = playerFor(state, nomination.playerId);
  const humanTeam = teamFor(state, state.configuration.humanTeamId);
  const ignoreSpendPacingExclusions = forceSpendPacing
    || nomination.humanPassed
    || !canAcquire(state, humanTeam, player, state.configuration.minimumBidDollars);

  return state.teams
    .filter(team => !team.isHuman)
    .map(team => ({
      team,
      maximum: Math.max(
        aiMaxBidFor(
          state,
          team,
          player,
          nomination.number,
          ignoreSpendPacingExclusions,
        ),
        nomination.highestBidderTeamId === team.id ? nomination.currentPrice : 0,
      ),
    }))
    .filter(entry => entry.maximum >= state.configuration.minimumBidDollars)
    .sort((left, right) => {
      const maximumDifference = right.maximum - left.maximum;
      if (maximumDifference !== 0) return maximumDifference;

      const leftIsStanding = left.team.id === nomination.highestBidderTeamId;
      const rightIsStanding = right.team.id === nomination.highestBidderTeamId;
      if (leftIsStanding !== rightIsStanding) return leftIsStanding ? -1 : 1;

      return left.team.id.localeCompare(right.team.id);
    });
};

const aiBidEventsFor = (
  nomination: GenericAuctionMockNomination,
  nextNomination: GenericAuctionMockNomination,
  maximums: readonly AiMaximum[],
): readonly AuctionEventInput[] => {
  if (
    nomination.highestBidderTeamId === nextNomination.highestBidderTeamId
    && nomination.currentPrice === nextNomination.currentPrice
  ) return [];

  const winner = maximums.find(entry => entry.team.id === nextNomination.highestBidderTeamId);
  if (winner === undefined) return [];

  const events: AuctionEventInput[] = [];
  const firstReplayPrice = Math.max(
    nomination.currentPrice + 1,
    nextNomination.currentPrice - 7,
  );
  let nextBidderTeamId = winner.team.id;
  for (let price = nextNomination.currentPrice - 1; price >= firstReplayPrice; price -= 1) {
    const bidders = maximums
      .filter(entry => entry.team.id !== nextBidderTeamId && entry.maximum >= price)
      .sort((left, right) => left.maximum - right.maximum || left.team.id.localeCompare(right.team.id));
    if (bidders.length === 0) break;

    const bidder = bidders[(nextNomination.currentPrice - price - 1) % bidders.length];
    if (bidder === undefined) break;
    events.unshift(bidEventFor(nomination, bidder.team, price));
    nextBidderTeamId = bidder.team.id;
  }

  events.push(bidEventFor(nomination, winner.team, nextNomination.currentPrice));
  return events;
};

const settleNomination = (state: GenericAuctionMockState): GenericAuctionMockState => {
  const nomination = state.session.currentNomination;
  if (nomination === undefined) {
    throw new GenericAuctionMockError("invalid_decision", "There is no current nomination to sell.");
  }

  const player = playerFor(state, nomination.playerId);
  const winningTeam = teamFor(state, nomination.highestBidderTeamId);
  const nominatingTeam = teamFor(state, nomination.nominatedByTeamId);
  const sold = addAcquisition({
    state,
    player,
    team: winningTeam,
    price: nomination.currentPrice,
    source: winningTeam.isHuman ? "human" : "ai",
    nominatedByTeam: nominatingTeam,
    nominationNumber: nomination.number,
  });
  const nominatorIndex = state.teams.findIndex(team => team.id === nomination.nominatedByTeamId);

  const settled: GenericAuctionMockState = {
    ...sold,
    nextNominatorIndex: (nominatorIndex + 1) % state.teams.length,
    session: {
      ...sold.session,
      currentNomination: undefined,
      nominationsCompleted: state.session.nominationsCompleted + 1,
    },
  };

  return withAuctionEvents(settled, [
    ...[5, 4, 3, 2, 1].map((countdown): AuctionEventInput => ({
      nominationNumber: nomination.number,
      type: "countdown",
      playerId: player.id,
      playerName: player.name,
      countdown,
      text: String(countdown),
    })),
    {
      nominationNumber: nomination.number,
      type: "sold",
      playerId: player.id,
      playerName: player.name,
      teamId: winningTeam.id,
      teamName: winningTeam.name,
      price: nomination.currentPrice,
      text: `Sold to ${winningTeam.name} for $${nomination.currentPrice}`,
    },
  ]);
};

const progressCurrentNomination = (
  state: GenericAuctionMockState,
): { state: GenericAuctionMockState; waitingForHuman: boolean } => {
  const nomination = state.session.currentNomination;
  if (nomination === undefined) return { state, waitingForHuman: false };

  const humanTeam = teamFor(state, state.configuration.humanTeamId);
  const player = playerFor(state, nomination.playerId);
  const aiMaximums = aiMaximumsFor(state, nomination);
  let activeMaximums = aiMaximums;
  let nextNomination = nomination;

  if (nomination.highestBidderTeamId === humanTeam.id) {
    const competitiveBid = competitiveAuctionBidFor({
      currentPrice: nomination.currentPrice,
      highestBidderTeamId: nomination.highestBidderTeamId,
      maximums: aiMaximums,
    });
    if (competitiveBid === undefined) {
      return { state: settleNomination(state), waitingForHuman: false };
    }
    nextNomination = nominationFor({
      state,
      player,
      nominatedByTeam: teamFor(state, nomination.nominatedByTeamId),
      highestBidderTeam: competitiveBid.team,
      currentPrice: competitiveBid.price,
      humanPassed: nomination.humanPassed,
    });
  } else {
    const competitiveBid = competitiveAuctionBidFor({
      currentPrice: nomination.currentPrice,
      highestBidderTeamId: nomination.highestBidderTeamId,
      maximums: aiMaximums,
    });
    if (competitiveBid === undefined) {
      throw new GenericAuctionMockError(
        "no_eligible_player",
        `No AI team can retain the current bid for ${player.name}.`,
      );
    }
    nextNomination = nominationFor({
      state,
      player,
      nominatedByTeam: teamFor(state, nomination.nominatedByTeamId),
      highestBidderTeam: competitiveBid.team,
      currentPrice: competitiveBid.price,
      humanPassed: nomination.humanPassed,
    });
  }

  const humanCanBuy = !nextNomination.humanPassed
    && canAcquire(state, humanTeam, player, nextNomination.nextBid);
  if (!humanCanBuy && nextNomination.highestBidderTeamId !== humanTeam.id) {
    const pacedMaximums = aiMaximumsFor(state, nextNomination, true);
    activeMaximums = pacedMaximums;
    const competitiveBid = competitiveAuctionBidFor({
      currentPrice: nextNomination.currentPrice,
      highestBidderTeamId: nextNomination.highestBidderTeamId,
      maximums: pacedMaximums,
    });
    if (competitiveBid === undefined) {
      throw new GenericAuctionMockError(
        "no_eligible_player",
        `No AI team can retain the current bid for ${player.name}.`,
      );
    }
    nextNomination = nominationFor({
      state,
      player,
      nominatedByTeam: teamFor(state, nextNomination.nominatedByTeamId),
      highestBidderTeam: competitiveBid.team,
      currentPrice: competitiveBid.price,
      humanPassed: nextNomination.humanPassed,
    });
  }
  const stateWithBidEvents = withAuctionEvents(
    state,
    aiBidEventsFor(nomination, nextNomination, activeMaximums),
  );
  const withStandingBid: GenericAuctionMockState = {
    ...stateWithBidEvents,
    session: {
      ...stateWithBidEvents.session,
      currentNomination: {
        ...nextNomination,
        humanCanBuy,
        humanCanPass: humanCanBuy,
      },
    },
  };

  if (humanCanBuy) {
    return {
      state: {
        ...withStandingBid,
        session: {
          ...withStandingBid.session,
          phase: "awaiting_human_bid",
          nextNominatorTeamId: undefined,
        },
      },
      waitingForHuman: true,
    };
  }

  return { state: settleNomination(withStandingBid), waitingForHuman: false };
};

const advanceToHumanDecision = (state: GenericAuctionMockState): GenericAuctionMockState => {
  let nextState = state;
  const maximumIterations = state.configuration.teams.length * rosterCapacityFor(state.configuration) * 3;

  for (let iteration = 0; iteration <= maximumIterations; iteration += 1) {
    if (nextState.session.currentNomination !== undefined) {
      const progressed = progressCurrentNomination(nextState);
      nextState = progressed.state;
      if (progressed.waitingForHuman) return nextState;
      continue;
    }

    const nominator = nextNominator(nextState);
    if (nominator === undefined) {
      return {
        ...nextState,
        session: {
          ...nextState.session,
          phase: "ready_to_complete",
          nextNominatorTeamId: undefined,
          currentNomination: undefined,
          canComplete: true,
        },
      };
    }

    if (availableNominationPlayersFor(nextState, nominator.team).length === 0) {
      throw new GenericAuctionMockError(
        "no_eligible_player",
        `${nominator.team.name} cannot fill its remaining roster slots from the available player catalog.`,
      );
    }

    if (nominator.team.isHuman) {
      return {
        ...nextState,
        nextNominatorIndex: nominator.index,
        session: {
          ...nextState.session,
          phase: "awaiting_human_nomination",
          nextNominatorTeamId: nominator.team.id,
          currentNomination: undefined,
          canComplete: false,
        },
      };
    }

    const player = selectAiNomination(nextState, nominator.team);
    nextState = {
      ...openNomination(
        nextState,
        nominator.team,
        player,
        nextState.configuration.minimumBidDollars,
      ),
      nextNominatorIndex: nominator.index,
    };
  }

  throw new GenericAuctionMockError(
    "no_eligible_player",
    "Auction mock could not reach another human decision or a completed roster state.",
  );
};

const snapshotFor = (state: GenericAuctionMockState): GenericAuctionMockSnapshot => ({
  session: {
    status: state.session.status,
    phase: state.session.phase,
    nextNominatorTeamId: state.session.nextNominatorTeamId,
    currentNomination: state.session.currentNomination,
    nominationsCompleted: state.session.nominationsCompleted,
    canComplete: state.session.canComplete,
    nextNominatorIndex: state.nextNominatorIndex,
  },
  board: state.board,
  teams: state.teams,
  sales: state.sales,
  auctionEvents: state.auctionEvents,
});

const withDecisionSnapshot = (state: GenericAuctionMockState): GenericAuctionMockState => ({
  ...state,
  decisionHistory: [...state.decisionHistory, snapshotFor(state)],
});

const finalizeCommand = (
  previousState: GenericAuctionMockState,
  nextState: GenericAuctionMockState,
  command: GenericAuctionMockCommand,
): GenericAuctionMockState => ({
  ...nextState,
  session: {
    ...nextState.session,
    revision: previousState.session.revision + 1,
    canUndo: nextState.session.status === "active" && nextState.decisionHistory.length > 0,
    commandLog: [...previousState.session.commandLog, { ...command }],
  },
});

const restoreLastDecision = (state: GenericAuctionMockState): GenericAuctionMockState => {
  const snapshot = state.decisionHistory.at(-1);
  if (snapshot === undefined) {
    throw new GenericAuctionMockError(
      "no_decision_to_undo",
      "There is no confirmed human auction decision to undo.",
    );
  }

  const remainingHistory = state.decisionHistory.slice(0, -1);
  return {
    ...state,
    nextNominatorIndex: snapshot.session.nextNominatorIndex,
    session: {
      ...state.session,
      status: snapshot.session.status,
      phase: snapshot.session.phase,
      nextNominatorTeamId: snapshot.session.nextNominatorTeamId,
      currentNomination: snapshot.session.currentNomination,
      nominationsCompleted: snapshot.session.nominationsCompleted,
      canComplete: snapshot.session.canComplete,
    },
    board: snapshot.board,
    teams: snapshot.teams,
    sales: snapshot.sales,
    auctionEvents: snapshot.auctionEvents,
    decisionHistory: remainingHistory,
  };
};

export const createGenericAuctionMockState = (
  config: GenericAuctionMockConfig,
): GenericAuctionMockState => {
  assertConfiguration(config);
  const rosterCapacity = rosterCapacityFor(config);
  const preparedState = applyKeepers({
    configuration: config,
    nextNominatorIndex: 0,
    decisionHistory: [],
    session: {
      id: config.sessionId,
      status: "setup",
      phase: "not_started",
      revision: 0,
      seed: config.seed,
      humanTeamId: config.humanTeamId,
      nextNominatorTeamId: undefined,
      currentNomination: undefined,
      nominationsCompleted: 0,
      canUndo: false,
      canComplete: false,
      commandLog: [],
    },
    board: {
      players: config.players.map(player => ({
        ...player,
        status: "available",
        available: true,
      })),
    },
    teams: config.teams.map(team => ({
      id: team.id,
      name: team.name,
      isHuman: team.id === config.humanTeamId,
      budgetDollars: config.budgetDollars,
      spent: 0,
      budgetRemaining: config.budgetDollars,
      rosterSlotsRemaining: rosterCapacity,
      maxBid: maxBidFor(config.budgetDollars, rosterCapacity, config.minimumBidDollars),
      positionCounts: emptyPositionCounts(config),
      roster: [],
      slots: buildRosterSlots(config),
    })),
    sales: [],
    auctionEvents: [],
  });

  if (!auctionCatalogCanFillOpenRosters({
    players: preparedState.board.players,
    teams: preparedState.teams,
    positionMaximums: config.positionMaximums,
  })) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "The player catalog cannot fill every team's remaining roster slots.",
    );
  }

  return preparedState;
};

export const applyGenericAuctionMockCommand = (
  state: GenericAuctionMockState,
  command: GenericAuctionMockCommand,
): GenericAuctionMockState => {
  if (command.expectedRevision !== state.session.revision) {
    throw new GenericAuctionMockError(
      "stale_revision",
      `Expected revision ${command.expectedRevision}, but the auction mock is at revision ${state.session.revision}.`,
    );
  }

  if (command.type === "start") {
    if (state.session.status !== "setup") {
      throw new GenericAuctionMockError("invalid_status", "The auction mock has already started.");
    }
    const started = advanceToHumanDecision({
      ...state,
      session: {
        ...state.session,
        status: "active",
      },
    });

    return finalizeCommand(state, started, command);
  }

  if (state.session.status !== "active") {
    throw new GenericAuctionMockError(
      "invalid_status",
      "Auction decisions require an active mock draft.",
    );
  }

  if (command.type === "undo") {
    return finalizeCommand(state, restoreLastDecision(state), command);
  }

  if (command.type === "complete") {
    if (!state.session.canComplete || state.teams.some(team => team.rosterSlotsRemaining > 0)) {
      throw new GenericAuctionMockError(
        "draft_incomplete",
        "Every team roster must be full before completing the auction mock.",
      );
    }

    return finalizeCommand(state, {
      ...state,
      decisionHistory: [],
      session: {
        ...state.session,
        status: "completed",
        phase: "completed",
        nextNominatorTeamId: undefined,
        currentNomination: undefined,
        canComplete: false,
      },
    }, command);
  }

  if (command.type === "nominate") {
    if (state.session.phase !== "awaiting_human_nomination") {
      throw new GenericAuctionMockError(
        "invalid_decision",
        "The human team does not have the current nomination.",
      );
    }
    const humanTeam = teamFor(state, state.configuration.humanTeamId);
    const player = playerFor(state, command.playerId);
    const openingBid = command.openingBid ?? state.configuration.minimumBidDollars;
    const decided = withDecisionSnapshot(state);
    const progressed = advanceToHumanDecision(openNomination(
      decided,
      humanTeam,
      player,
      openingBid,
    ));

    return finalizeCommand(state, progressed, command);
  }

  const nomination = state.session.currentNomination;
  if (state.session.phase !== "awaiting_human_bid" || nomination === undefined) {
    throw new GenericAuctionMockError(
      "invalid_decision",
      "There is no current nomination awaiting a human bid or pass.",
    );
  }

  if (command.type === "pass") {
    const decided = withDecisionSnapshot(state);
    const progressed = advanceToHumanDecision({
      ...decided,
      session: {
        ...decided.session,
        currentNomination: {
          ...nomination,
          humanPassed: true,
          humanCanBuy: false,
          humanCanPass: false,
        },
      },
    });

    return finalizeCommand(state, progressed, command);
  }

  if (command.price < nomination.nextBid) {
    throw new GenericAuctionMockError(
      "invalid_price",
      `The next bid for ${nomination.playerName} is $${nomination.nextBid}.`,
    );
  }
  const humanTeam = teamFor(state, state.configuration.humanTeamId);
  const player = playerFor(state, nomination.playerId);
  assertCanAcquire(state, humanTeam, player, command.price);
  const decided = withDecisionSnapshot(state);
  const withHumanBid = withAuctionEvents(decided, [
    bidEventFor(nomination, humanTeam, command.price),
  ]);
  const progressed = advanceToHumanDecision({
    ...withHumanBid,
    session: {
      ...withHumanBid.session,
      currentNomination: nominationFor({
        state: withHumanBid,
        player,
        nominatedByTeam: teamFor(state, nomination.nominatedByTeamId),
        highestBidderTeam: humanTeam,
        currentPrice: command.price,
        humanPassed: false,
      }),
    },
  });

  return finalizeCommand(state, progressed, command);
};

export const replayGenericAuctionMock = (
  config: GenericAuctionMockConfig,
  commands: readonly GenericAuctionMockCommand[],
): GenericAuctionMockState => commands.reduce(
  (state, command) => applyGenericAuctionMockCommand(state, command),
  createGenericAuctionMockState(config),
);
