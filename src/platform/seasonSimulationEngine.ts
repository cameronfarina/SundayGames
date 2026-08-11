import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";
import {
  applyGenericAuctionMockCommand,
  GenericAuctionMockError,
  type GenericAuctionMockBoardPlayer,
  type GenericAuctionMockState,
  type GenericAuctionMockTeamReadModel,
} from "./genericAuctionMockEngine.js";
import type { LeagueSeason, LeagueSeasonSettings } from "./leagueSeason.js";
import type { LiveDraftRoomSetup } from "./liveDraftRoomSetups.js";
import {
  buildSeasonAuctionMockConfig,
  replaySeasonAuctionMockCommands,
  SeasonAuctionMockError,
} from "./seasonAuctionMock.js";
import {
  buildSeasonSnakeMockConfig,
  replaySeasonSnakeMockCommands,
  SeasonSnakeMockError,
} from "./seasonSnakeMock.js";
import {
  applySnakeDraftCommand,
  SnakeDraftError,
  type SnakeDraftBoardPlayer,
  type SnakeDraftState,
  type SnakeDraftTeamReadModel,
} from "./snakeDraftEngine.js";

export interface SeasonSimulationTargetConstraint {
  playerName: string;
  maxAuctionPrice?: number | undefined;
  maxSnakeRound?: number | undefined;
  maxSnakeOverallPick?: number | undefined;
}

export interface SeasonSimulationPreferredPosition {
  position: "QB" | "RB" | "WR" | "TE";
  tier: "elite";
}

export interface ParsedSeasonSimulationStrategy {
  rawInput: string;
  target?: SeasonSimulationTargetConstraint | undefined;
  preferredPositions: readonly SeasonSimulationPreferredPosition[];
  pairWithPlayerName?: string | undefined;
  summary: string;
  warnings: readonly string[];
}

export type SeasonSimulationErrorCode =
  | "human_team_missing"
  | "invalid_configuration"
  | "invalid_run_count"
  | "invalid_seed_prefix"
  | "simulation_busy"
  | "simulation_canceled"
  | "simulation_failed"
  | "simulation_timeout";

export class SeasonSimulationError extends Error {
  constructor(
    readonly code: SeasonSimulationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SeasonSimulationError";
  }
}

export interface RunSeasonSimulationsInput {
  season: LeagueSeason<LeagueSeasonSettings>;
  setup: LiveDraftRoomSetup;
  humanTeamId: string;
  runCount: number;
  strategyInput?: string | undefined;
  seedPrefix?: string | undefined;
  playerExpectedPrices?: Readonly<Record<string, number>> | undefined;
}

export interface SeasonSimulationPlayerExposure {
  playerId: string;
  playerName: string;
  position: string;
  count: number;
  rate: number;
  averagePrice?: number | undefined;
  averagePick?: number | undefined;
}

export interface SeasonSimulationPositionCount {
  total: number;
  perRun: number;
}

export interface SeasonSimulationRosterPlayer {
  playerId: string;
  playerName: string;
  position: string;
  source: "ai" | "human" | "keeper";
  price?: number | undefined;
  overallPick?: number | undefined;
  round?: number | undefined;
}

export interface SeasonSimulationTargetOutcome {
  playerId: string;
  playerName: string;
  hitCount: number;
  hitRate: number;
}

export interface SeasonSimulationResult {
  draftFormat: "auction" | "snake";
  runCount: number;
  completedCount: number;
  seedPrefix: string;
  strategy: ParsedSeasonSimulationStrategy;
  targetOutcome?: SeasonSimulationTargetOutcome | undefined;
  playerExposure: readonly SeasonSimulationPlayerExposure[];
  positionCounts: Readonly<Record<string, SeasonSimulationPositionCount>>;
  representativeRoster: readonly SeasonSimulationRosterPlayer[];
}

interface ExtractedMatch {
  match: RegExpMatchArray;
  remainder: string;
}

const extract = (value: string, pattern: RegExp): ExtractedMatch | undefined => {
  const match = value.match(pattern);
  if (match === null || match.index === undefined) return undefined;

  return {
    match,
    remainder: `${value.slice(0, match.index)} ${value.slice(match.index + match[0].length)}`,
  };
};

const cleanPlayerName = (value: string): string => value
  .trim()
  .replace(/\s+/g, " ")
  .replace(/[.,;:]+$/g, "");

const unsupportedWarning = (value: string): string | undefined => {
  const remainder = value
    .replace(/\brun\s+\d+\s+(?:mock\s+)?simulations?\s+(?:where\s+)?(?:i\s+)?/gi, " ")
    .replace(/\b(?:where|i|please|and|to|a|an|the)\b/gi, " ")
    .replace(/[^a-z0-9$'-]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");

  return remainder.length === 0 ? undefined : `Unsupported strategy phrase: "${remainder}".`;
};

const summaryFor = (
  target: SeasonSimulationTargetConstraint | undefined,
  preferredPositions: readonly SeasonSimulationPreferredPosition[],
  pairWithPlayerName: string | undefined,
): string => {
  const clauses: string[] = [];
  if (target !== undefined) {
    if (target.maxAuctionPrice !== undefined) {
      clauses.push(`Target ${target.playerName} up to $${target.maxAuctionPrice}`);
    } else if (target.maxSnakeRound !== undefined) {
      clauses.push(`Target ${target.playerName} by round ${target.maxSnakeRound}`);
    } else if (target.maxSnakeOverallPick !== undefined) {
      clauses.push(`Target ${target.playerName} by pick ${target.maxSnakeOverallPick}`);
    } else {
      clauses.push(`Target ${target.playerName}`);
    }
  }
  for (const preference of preferredPositions) {
    clauses.push(`prioritize ${preference.tier} ${preference.position}`);
  }
  if (pairWithPlayerName !== undefined) clauses.push(`pair with ${pairWithPlayerName}`);

  return clauses.length === 0 ? "Best available roster fit." : `${clauses.join("; ")}.`;
};

export const parseSeasonSimulationStrategy = (
  rawInput: string,
): ParsedSeasonSimulationStrategy => {
  let remainder = rawInput;
  let target: SeasonSimulationTargetConstraint | undefined;
  const preferredPositions: SeasonSimulationPreferredPosition[] = [];

  const auctionTarget = extract(
    remainder,
    /\b(?:draft|target)\s+(.+?)\s+(?:for\s+)?(?:no\s+more\s+than|under|(?:at\s+)?(?:a\s+)?max(?:imum)?(?:\s+price)?(?:\s+of)?)\s*\$(\d+)\b/i,
  );
  if (auctionTarget !== undefined) {
    const playerName = cleanPlayerName(auctionTarget.match[1] ?? "");
    const maxAuctionPrice = Number(auctionTarget.match[2]);
    if (playerName.length > 0 && Number.isSafeInteger(maxAuctionPrice) && maxAuctionPrice > 0) {
      target = { playerName, maxAuctionPrice };
      remainder = auctionTarget.remainder;
    }
  }

  if (target === undefined) {
    const snakeRoundTarget = extract(
      remainder,
      /\b(?:draft|target)\s+(.+?)\s+(?:by|no\s+later\s+than)\s+round\s+(\d+)\b/i,
    );
    if (snakeRoundTarget !== undefined) {
      const playerName = cleanPlayerName(snakeRoundTarget.match[1] ?? "");
      const maxSnakeRound = Number(snakeRoundTarget.match[2]);
      if (playerName.length > 0 && Number.isSafeInteger(maxSnakeRound) && maxSnakeRound > 0) {
        target = { playerName, maxSnakeRound };
        remainder = snakeRoundTarget.remainder;
      }
    }
  }

  if (target === undefined) {
    const snakePickTarget = extract(
      remainder,
      /\b(?:draft|target)\s+(.+?)\s+(?:by|no\s+later\s+than)\s+(?:overall\s+)?pick\s+(\d+)\b/i,
    );
    if (snakePickTarget !== undefined) {
      const playerName = cleanPlayerName(snakePickTarget.match[1] ?? "");
      const maxSnakeOverallPick = Number(snakePickTarget.match[2]);
      if (
        playerName.length > 0
        && Number.isSafeInteger(maxSnakeOverallPick)
        && maxSnakeOverallPick > 0
      ) {
        target = { playerName, maxSnakeOverallPick };
        remainder = snakePickTarget.remainder;
      }
    }
  }

  const preferredPattern = /\b(?:target|prioriti[sz]e|draft)?\s*(?:an?\s+)?(?:elite|top|premium)\s+(QB|RB|WR|TE)\b/i;
  while (true) {
    const preference = extract(remainder, preferredPattern);
    if (preference === undefined) break;
    const position = preference.match[1]?.toUpperCase();
    if (position === "QB" || position === "RB" || position === "WR" || position === "TE") {
      if (!preferredPositions.some(candidate => candidate.position === position)) {
        preferredPositions.push({ position, tier: "elite" });
      }
    }
    remainder = preference.remainder;
  }

  const pair = extract(
    remainder,
    /\bpair(?:ed)?\s+with\s+([a-z][a-z.'-]*(?:\s+[a-z][a-z.'-]*){0,3})(?=\s+(?:and|for|by)\b|\s*$)/i,
  );
  const pairWithPlayerName = pair === undefined
    ? undefined
    : cleanPlayerName(pair.match[1] ?? "");
  if (pair !== undefined && pairWithPlayerName !== undefined && pairWithPlayerName.length > 0) {
    remainder = pair.remainder;
  }

  if (target === undefined) {
    const namedTarget = extract(
      remainder,
      /\b(?:draft|target)\s+([a-z][a-z.'-]*(?:\s+[a-z][a-z.'-]*){0,4})(?=\s+(?:and|to)\b|\s*$)/i,
    );
    if (namedTarget !== undefined) {
      const playerName = cleanPlayerName(namedTarget.match[1] ?? "");
      if (playerName.length > 0) {
        target = { playerName };
        remainder = namedTarget.remainder;
      }
    }
  }

  const warning = unsupportedWarning(remainder);
  return {
    rawInput,
    ...(target === undefined ? {} : { target }),
    preferredPositions,
    ...(pairWithPlayerName === undefined || pairWithPlayerName.length === 0
      ? {}
      : { pairWithPlayerName }),
    summary: summaryFor(target, preferredPositions, pairWithPlayerName),
    warnings: warning === undefined ? [] : [warning],
  };
};

const defaultSeedPrefix = "season-simulation";
const maximumDecisionsPerRun = 10_000;

const deterministicFraction = (value: string): number => {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0) / 4_294_967_296;
};

const auctionRosterNeedFor = (
  team: GenericAuctionMockTeamReadModel,
  position: string,
): number => team.slots
  .filter(slot => slot.playerId === undefined && slot.eligiblePositions.includes(position))
  .reduce((total, slot) => total + (1 / slot.eligiblePositions.length), 0);

const canAuctionTeamAcquire = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockBoardPlayer,
): boolean => player.available
  && team.rosterSlotsRemaining > 0
  && team.maxBid >= state.configuration.minimumBidDollars
  && (team.positionCounts[player.position] ?? 0)
    < (state.configuration.positionMaximums[player.position] ?? 0)
  && team.slots.some(slot =>
    slot.playerId === undefined && slot.eligiblePositions.includes(player.position)
  );

const selectAuctionNomination = (
  state: GenericAuctionMockState,
  targetPlayerId: string | undefined,
  pairPlayerId: string | undefined,
  strategy: ParsedSeasonSimulationStrategy,
  seed: string,
): GenericAuctionMockBoardPlayer => {
  const humanTeam = state.teams.find(team => team.id === state.configuration.humanTeamId);
  if (humanTeam === undefined) {
    throw new SeasonSimulationError("human_team_missing", "Claim a team before running simulations.");
  }
  const preferredPositions = new Set<string>(strategy.preferredPositions.map(entry => entry.position));
  const selected = state.board.players
    .filter(player => canAuctionTeamAcquire(state, humanTeam, player))
    .map(player => ({
      player,
      score: (player.id === targetPlayerId ? 1_000_000 : 0)
        + (player.id === pairPlayerId ? 100_000 : 0)
        + (preferredPositions.has(player.position) ? 10_000 : 0)
        + auctionRosterNeedFor(humanTeam, player.position) * 100
        + player.expectedPrice
        + deterministicFraction(`${seed}:nominate:${state.session.revision}:${player.id}`) * 0.001,
    }))
    .sort((left, right) =>
      right.score - left.score || left.player.id.localeCompare(right.player.id)
    )[0]?.player;

  if (selected === undefined) {
    throw new SeasonSimulationError(
      "simulation_failed",
      "The claimed team cannot fill its remaining auction roster from the available players.",
    );
  }
  return selected;
};

const auctionWillingnessFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockBoardPlayer,
  targetPlayerId: string | undefined,
  pairPlayerId: string | undefined,
  strategy: ParsedSeasonSimulationStrategy,
): number => {
  const isTarget = player.id === targetPlayerId;
  const isPair = player.id === pairPlayerId;
  const isPreferred = strategy.preferredPositions.some(entry => entry.position === player.position);
  const needDollars = Math.ceil(auctionRosterNeedFor(team, player.position) * 2);
  const preferenceDollars = isPreferred ? Math.ceil(player.expectedPrice * 0.15) : 0;
  const targetDollars = isTarget || isPair ? Math.ceil(player.expectedPrice * 0.1) : 0;
  const valueLimit = Math.max(
    state.configuration.minimumBidDollars,
    Math.round(player.expectedPrice) + needDollars + preferenceDollars + targetDollars,
  );
  const strategyLimit = isTarget && strategy.target?.maxAuctionPrice !== undefined
    ? strategy.target.maxAuctionPrice
    : team.maxBid;

  return Math.min(team.maxBid, strategyLimit, valueLimit);
};

const runAuctionSimulation = (input: {
  config: ReturnType<typeof buildSeasonAuctionMockConfig>;
  strategy: ParsedSeasonSimulationStrategy;
  targetPlayerId: string | undefined;
  pairPlayerId: string | undefined;
  seed: string;
}): GenericAuctionMockState => {
  let state = replaySeasonAuctionMockCommands(input.config, []);
  state = applyGenericAuctionMockCommand(state, { type: "start", expectedRevision: 0 });

  for (let decisions = 0; decisions < maximumDecisionsPerRun; decisions += 1) {
    if (state.session.status === "completed") return state;
    if (state.session.phase === "ready_to_complete") {
      state = applyGenericAuctionMockCommand(state, {
        type: "complete",
        expectedRevision: state.session.revision,
      });
      continue;
    }
    if (state.session.phase === "awaiting_human_nomination") {
      const player = selectAuctionNomination(
        state,
        input.targetPlayerId,
        input.pairPlayerId,
        input.strategy,
        input.seed,
      );
      state = applyGenericAuctionMockCommand(state, {
        type: "nominate",
        expectedRevision: state.session.revision,
        playerId: player.id,
      });
      continue;
    }
    const nomination = state.session.currentNomination;
    const humanTeam = state.teams.find(team => team.id === state.configuration.humanTeamId);
    const player = nomination === undefined
      ? undefined
      : state.board.players.find(candidate => candidate.id === nomination.playerId);
    if (nomination === undefined || humanTeam === undefined || player === undefined) {
      throw new SeasonSimulationError(
        "simulation_failed",
        "The auction engine did not expose a valid human decision.",
      );
    }
    const willingness = auctionWillingnessFor(
      state,
      humanTeam,
      player,
      input.targetPlayerId,
      input.pairPlayerId,
      input.strategy,
    );
    state = applyGenericAuctionMockCommand(state, nomination.nextBid <= willingness
      ? { type: "buy", expectedRevision: state.session.revision, price: nomination.nextBid }
      : { type: "pass", expectedRevision: state.session.revision });
  }

  throw new SeasonSimulationError(
    "simulation_failed",
    "The auction simulation exceeded its deterministic decision limit.",
  );
};

const snakeRosterNeedFor = (
  team: SnakeDraftTeamReadModel,
  position: string,
): number => team.slots
  .filter(slot => slot.playerId === undefined && slot.eligiblePositions.includes(position))
  .reduce((total, slot) => total + (1 / slot.eligiblePositions.length), 0);

const selectSnakePlayer = (
  state: SnakeDraftState,
  targetPlayerId: string | undefined,
  pairPlayerId: string | undefined,
  strategy: ParsedSeasonSimulationStrategy,
  seed: string,
): SnakeDraftBoardPlayer => {
  const humanTeam = state.teams.find(team => team.id === state.configuration.humanTeamId);
  const currentPick = state.session.currentPick;
  if (humanTeam === undefined) {
    throw new SeasonSimulationError("human_team_missing", "Claim a team before running simulations.");
  }
  if (currentPick === undefined) {
    throw new SeasonSimulationError("simulation_failed", "The snake engine did not expose a human pick.");
  }
  const targetDeadlineAllowsPick = strategy.target === undefined
    || (
      (strategy.target.maxSnakeRound === undefined
        || currentPick.round <= strategy.target.maxSnakeRound)
      && (strategy.target.maxSnakeOverallPick === undefined
        || currentPick.overall <= strategy.target.maxSnakeOverallPick)
    );
  const preferredPositions = new Set<string>(strategy.preferredPositions.map(entry => entry.position));
  const selected = state.board.players
    .filter(player => player.available && humanTeam.slots.some(slot =>
      slot.playerId === undefined && slot.eligiblePositions.includes(player.position)
    ))
    .map(player => ({
      player,
      score: (player.id === targetPlayerId && targetDeadlineAllowsPick ? 1_000_000 : 0)
        + (player.id === pairPlayerId ? 100_000 : 0)
        + (preferredPositions.has(player.position) ? 10_000 : 0)
        + snakeRosterNeedFor(humanTeam, player.position) * 100
        - (player.personalRank ?? player.leagueExpectedPick ?? player.rank)
        + deterministicFraction(`${seed}:pick:${currentPick.overall}:${player.id}`) * 0.001,
    }))
    .sort((left, right) =>
      right.score - left.score || left.player.id.localeCompare(right.player.id)
    )[0]?.player;
  if (selected === undefined) {
    throw new SeasonSimulationError(
      "simulation_failed",
      "The claimed team cannot fill its remaining snake roster from the available players.",
    );
  }

  return selected;
};

const runSnakeSimulation = (input: {
  config: ReturnType<typeof buildSeasonSnakeMockConfig>;
  strategy: ParsedSeasonSimulationStrategy;
  targetPlayerId: string | undefined;
  pairPlayerId: string | undefined;
  seed: string;
}): SnakeDraftState => {
  let state = replaySeasonSnakeMockCommands(input.config, []);
  state = applySnakeDraftCommand(state, { type: "start", expectedRevision: 0 });

  for (let decisions = 0; decisions < maximumDecisionsPerRun; decisions += 1) {
    if (state.session.status === "completed") return state;
    if (state.session.canComplete) {
      state = applySnakeDraftCommand(state, {
        type: "complete",
        expectedRevision: state.session.revision,
      });
      continue;
    }
    const player = selectSnakePlayer(
      state,
      input.targetPlayerId,
      input.pairPlayerId,
      input.strategy,
      input.seed,
    );
    state = applySnakeDraftCommand(state, {
      type: "pick",
      expectedRevision: state.session.revision,
      playerId: player.id,
    });
  }

  throw new SeasonSimulationError(
    "simulation_failed",
    "The snake simulation exceeded its deterministic decision limit.",
  );
};

interface CompletedSimulationRun {
  roster: readonly SeasonSimulationRosterPlayer[];
}

const aggregateRuns = (input: {
  draftFormat: "auction" | "snake";
  runs: readonly CompletedSimulationRun[];
  runCount: number;
  seedPrefix: string;
  strategy: ParsedSeasonSimulationStrategy;
  targetPlayerId: string | undefined;
}): SeasonSimulationResult => {
  const exposure = new Map<string, {
    playerId: string;
    playerName: string;
    position: string;
    count: number;
    priceTotal: number;
    priceCount: number;
    pickTotal: number;
    pickCount: number;
  }>();
  const positionTotals = new Map<string, number>();

  for (const run of input.runs) {
    for (const player of run.roster) {
      const current = exposure.get(player.playerId) ?? {
        playerId: player.playerId,
        playerName: player.playerName,
        position: player.position,
        count: 0,
        priceTotal: 0,
        priceCount: 0,
        pickTotal: 0,
        pickCount: 0,
      };
      current.count += 1;
      if (player.price !== undefined) {
        current.priceTotal += player.price;
        current.priceCount += 1;
      }
      if (player.overallPick !== undefined) {
        current.pickTotal += player.overallPick;
        current.pickCount += 1;
      }
      exposure.set(player.playerId, current);
      positionTotals.set(player.position, (positionTotals.get(player.position) ?? 0) + 1);
    }
  }

  const playerExposure = [...exposure.values()]
    .map(player => ({
      playerId: player.playerId,
      playerName: player.playerName,
      position: player.position,
      count: player.count,
      rate: player.count / input.runCount,
      ...(player.priceCount === 0 ? {} : { averagePrice: player.priceTotal / player.priceCount }),
      ...(player.pickCount === 0 ? {} : { averagePick: player.pickTotal / player.pickCount }),
    }))
    .sort((left, right) =>
      right.count - left.count || left.playerName.localeCompare(right.playerName)
    );
  const targetExposure = input.targetPlayerId === undefined
    ? undefined
    : exposure.get(input.targetPlayerId);
  const targetName = input.strategy.target?.playerName;

  return {
    draftFormat: input.draftFormat,
    runCount: input.runCount,
    completedCount: input.runs.length,
    seedPrefix: input.seedPrefix,
    strategy: input.strategy,
    ...(input.targetPlayerId === undefined || targetName === undefined ? {} : {
      targetOutcome: {
        playerId: input.targetPlayerId,
        playerName: targetName,
        hitCount: targetExposure?.count ?? 0,
        hitRate: (targetExposure?.count ?? 0) / input.runCount,
      },
    }),
    playerExposure,
    positionCounts: Object.fromEntries([...positionTotals.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([position, total]) => [position, { total, perRun: total / input.runCount }])),
    representativeRoster: input.runs[0]?.roster ?? [],
  };
};

const resolvedStrategy = (
  strategy: ParsedSeasonSimulationStrategy,
  setup: LiveDraftRoomSetup,
  humanTeamId: string,
): {
  strategy: ParsedSeasonSimulationStrategy;
  targetPlayerId: string | undefined;
  pairPlayerId: string | undefined;
} => {
  const catalogIds = new Set(setup.playerCatalog.map(player => canonicalPlayerIdentityKey(player.name)));
  const resolveCatalogId = (name: string | undefined): {
    id: string | undefined;
    ambiguous: boolean;
  } => {
    if (name === undefined) return { id: undefined, ambiguous: false };
    const query = canonicalPlayerIdentityKey(name);
    if (catalogIds.has(query)) return { id: query, ambiguous: false };
    const matches = [...catalogIds].filter(id =>
      id.startsWith(`${query} `)
      || id.endsWith(` ${query}`)
      || id.includes(` ${query} `)
    );
    return matches.length === 1
      ? { id: matches[0], ambiguous: false }
      : { id: undefined, ambiguous: matches.length > 1 };
  };
  const targetResolution = resolveCatalogId(strategy.target?.playerName);
  const pairResolution = resolveCatalogId(strategy.pairWithPlayerName);
  const targetPlayerId = targetResolution.id
    ?? (strategy.target === undefined
      ? undefined
      : canonicalPlayerIdentityKey(strategy.target.playerName));
  const pairPlayerId = pairResolution.id;
  const warnings = [...strategy.warnings];
  if (strategy.target !== undefined && targetResolution.id === undefined) {
    warnings.push(targetResolution.ambiguous
      ? `Target player ${strategy.target.playerName} matches multiple players; use the full name.`
      : `Target player ${strategy.target.playerName} was not found in the player catalog.`);
  }
  if (strategy.pairWithPlayerName !== undefined && pairPlayerId === undefined) {
    warnings.push(pairResolution.ambiguous
      ? `Pair-with player ${strategy.pairWithPlayerName} matches multiple players; use the full name.`
      : `Pair-with player ${strategy.pairWithPlayerName} was not found in the player catalog.`);
  }
  const ownedPair = pairPlayerId === undefined || setup.initialRosters.some(player =>
    player.teamId === humanTeamId
    && (player.playerId ?? canonicalPlayerIdentityKey(player.playerName)) === pairPlayerId
  );
  if (pairPlayerId !== undefined && !ownedPair) {
    warnings.push(`Pair-with player ${strategy.pairWithPlayerName ?? pairPlayerId} is not a keeper; the simulation will also prioritize acquiring that player.`);
  }

  return {
    strategy: { ...strategy, warnings },
    targetPlayerId,
    pairPlayerId,
  };
};

const runSeasonSimulationsUnchecked = (
  input: RunSeasonSimulationsInput,
): SeasonSimulationResult => {
  if (!Number.isInteger(input.runCount) || input.runCount < 1 || input.runCount > 25) {
    throw new SeasonSimulationError(
      "invalid_run_count",
      "Simulation run count must be a whole number from 1 through 25.",
    );
  }
  const seedPrefix = input.seedPrefix ?? defaultSeedPrefix;
  if (seedPrefix.trim().length === 0) {
    throw new SeasonSimulationError("invalid_seed_prefix", "Simulation seed prefix is required.");
  }
  if (!input.season.teams.some(team => team.id === input.humanTeamId)) {
    throw new SeasonSimulationError("human_team_missing", "Claim a team before running simulations.");
  }
  if (input.setup.seasonId !== input.season.id) {
    throw new SeasonSimulationError(
      "invalid_configuration",
      "Simulation setup does not belong to the selected league season.",
    );
  }

  const parsedStrategy = parseSeasonSimulationStrategy(input.strategyInput ?? "");
  const formatWarnings = [...parsedStrategy.warnings];
  if (
    input.season.settings.draftFormat === "auction"
    && (parsedStrategy.target?.maxSnakeRound !== undefined
      || parsedStrategy.target?.maxSnakeOverallPick !== undefined)
  ) {
    formatWarnings.push(
      "Round and pick deadlines do not apply to auction simulations; the player target was still prioritized.",
    );
  }
  if (
    input.season.settings.draftFormat === "snake"
    && parsedStrategy.target?.maxAuctionPrice !== undefined
  ) {
    formatWarnings.push(
      "Auction price limits do not apply to snake simulations; the player target was still prioritized.",
    );
  }
  const parsed = { ...parsedStrategy, warnings: formatWarnings };
  const strategyResolution = resolvedStrategy(parsed, input.setup, input.humanTeamId);
  if (input.season.settings.draftFormat !== "auction" && input.season.settings.draftFormat !== "snake") {
    throw new SeasonSimulationError(
      "invalid_configuration",
      "Simulation season must explicitly use auction or snake draft settings.",
    );
  }

  const runs: CompletedSimulationRun[] = [];
  if (input.season.settings.draftFormat === "snake") {
    for (let runNumber = 1; runNumber <= input.runCount; runNumber += 1) {
      const seed = `${seedPrefix}:${runNumber}`;
      const config = buildSeasonSnakeMockConfig({
        season: input.season,
        setup: input.setup,
        humanTeamId: input.humanTeamId,
        sessionId: `${seedPrefix}-snake-${runNumber}`,
        seed,
      });
      const state = runSnakeSimulation({
        config,
        strategy: strategyResolution.strategy,
        targetPlayerId: strategyResolution.targetPlayerId,
        pairPlayerId: strategyResolution.pairPlayerId,
        seed,
      });
      const humanTeam = state.teams.find(team => team.id === input.humanTeamId);
      if (humanTeam === undefined) {
        throw new SeasonSimulationError("human_team_missing", "Claim a team before running simulations.");
      }
      runs.push({
        roster: humanTeam.roster.map(selection => {
          const player = state.configuration.players.find(candidate => candidate.id === selection.playerId);
          const pick = state.board.picks.find(candidate =>
            candidate.teamId === input.humanTeamId
            && candidate.selection?.playerId === selection.playerId
          );
          if (player === undefined || pick === undefined) {
            throw new SeasonSimulationError(
              "simulation_failed",
              "A completed snake roster could not be mapped back to its player catalog and pick.",
            );
          }
          return {
            playerId: player.id,
            playerName: player.name,
            position: player.position,
            source: selection.source,
            overallPick: pick.overall,
            round: pick.round,
          };
        }),
      });
    }

    return aggregateRuns({
      draftFormat: "snake",
      runs,
      runCount: input.runCount,
      seedPrefix,
      strategy: strategyResolution.strategy,
      targetPlayerId: strategyResolution.targetPlayerId,
    });
  }

  for (let runNumber = 1; runNumber <= input.runCount; runNumber += 1) {
    const seed = `${seedPrefix}:${runNumber}`;
    const config = buildSeasonAuctionMockConfig({
      season: input.season,
      setup: input.setup,
      humanTeamId: input.humanTeamId,
      sessionId: `${seedPrefix}-auction-${runNumber}`,
      seed,
      playerExpectedPrices: input.playerExpectedPrices,
    });
    const state = runAuctionSimulation({
      config,
      strategy: strategyResolution.strategy,
      targetPlayerId: strategyResolution.targetPlayerId,
      pairPlayerId: strategyResolution.pairPlayerId,
      seed,
    });
    const humanTeam = state.teams.find(team => team.id === input.humanTeamId);
    if (humanTeam === undefined) {
      throw new SeasonSimulationError("human_team_missing", "Claim a team before running simulations.");
    }
    runs.push({
      roster: humanTeam.roster.map(player => ({
        playerId: player.playerId,
        playerName: player.playerName,
        position: player.position,
        source: player.source,
        price: player.price,
      })),
    });
  }

  return aggregateRuns({
    draftFormat: "auction",
    runs,
    runCount: input.runCount,
    seedPrefix,
    strategy: strategyResolution.strategy,
    targetPlayerId: strategyResolution.targetPlayerId,
  });
};

export const runSeasonSimulations = (
  input: RunSeasonSimulationsInput,
): SeasonSimulationResult => {
  try {
    return runSeasonSimulationsUnchecked(input);
  } catch (error) {
    if (error instanceof SeasonSimulationError) throw error;
    if (
      error instanceof SeasonAuctionMockError
      || error instanceof SeasonSnakeMockError
      || error instanceof GenericAuctionMockError
      || error instanceof SnakeDraftError
    ) {
      throw new SeasonSimulationError("invalid_configuration", error.message);
    }
    throw error;
  }
};
