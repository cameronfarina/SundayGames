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
  targetCount?: number | undefined;
  maxAuctionPrice?: number | undefined;
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

export const maximumSeasonSimulationRunCount = 100;

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
  week1Projections?: Readonly<Record<string, number>> | undefined;
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
  rosterSlot: string;
  starter: boolean;
  week1Points: number;
}

export interface SeasonSimulationTeamResult {
  teamId: string;
  teamName: string;
  isUserTeam: boolean;
  roster: readonly SeasonSimulationRosterPlayer[];
  week1Points: number;
  spent?: number | undefined;
  budgetRemaining?: number | undefined;
}

export interface SeasonSimulationRunResult {
  runNumber: number;
  label: string;
  seed: string;
  teams: readonly SeasonSimulationTeamResult[];
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
  runs: readonly SeasonSimulationRunResult[];
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
    const count = preference.targetCount === undefined ? "" : `${preference.targetCount} `;
    const cap = preference.maxAuctionPrice === undefined
      ? ""
      : ` up to $${preference.maxAuctionPrice} each`;
    clauses.push(`prioritize ${count}${preference.tier} ${preference.position}${cap}`);
  }
  if (pairWithPlayerName !== undefined) clauses.push(`pair with ${pairWithPlayerName}`);

  if (clauses.length === 0) return "Best available roster fit.";
  const summary = clauses.join("; ");
  return `${summary.charAt(0).toUpperCase()}${summary.slice(1)}.`;
};

const preferredCount = (value: string): number | undefined => {
  const namedCounts: Readonly<Record<string, number>> = { one: 1, two: 2, three: 3, four: 4 };
  const parsed = namedCounts[value.toLowerCase()] ?? Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const parseSeasonSimulationStrategy = (
  rawInput: string,
): ParsedSeasonSimulationStrategy => {
  let remainder = rawInput;
  let target: SeasonSimulationTargetConstraint | undefined;
  const preferredPositions: SeasonSimulationPreferredPosition[] = [];

  const countedPreference = extract(
    remainder,
    /\b(?:target|prioriti[sz]e|draft)?\s*(\d+|one|two|three|four)\s+(?:elite|top|premium)\s+(QB|RB|WR|TE)s?(?:\s*(?:,|and)?\s*(?:for\s+)?(?:no\s+more\s+than|under|(?:at\s+)?(?:a\s+)?max(?:imum)?(?:\s+price)?(?:\s+of)?)\s*\$?(\d+)(?:\s+(?:for\s+)?each)?)?\b/i,
  );
  if (countedPreference !== undefined) {
    const targetCount = preferredCount(countedPreference.match[1] ?? "");
    const position = countedPreference.match[2]?.toUpperCase();
    const maxAuctionPrice = countedPreference.match[3] === undefined
      ? undefined
      : Number(countedPreference.match[3]);
    if (
      targetCount !== undefined
      && (position === "QB" || position === "RB" || position === "WR" || position === "TE")
      && (maxAuctionPrice === undefined
        || (Number.isSafeInteger(maxAuctionPrice) && maxAuctionPrice > 0))
    ) {
      preferredPositions.push({
        position,
        tier: "elite",
        targetCount,
        ...(maxAuctionPrice === undefined ? {} : { maxAuctionPrice }),
      });
      remainder = countedPreference.remainder;
    }
  }

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

const activePositionPreferenceFor = (
  strategy: ParsedSeasonSimulationStrategy,
  positionCounts: Readonly<Record<string, number>>,
  position: string,
): SeasonSimulationPreferredPosition | undefined => strategy.preferredPositions.find(preference =>
  preference.position === position
  && (preference.targetCount === undefined
    || (positionCounts[position] ?? 0) < preference.targetCount)
);

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
  const selected = state.board.players
    .filter(player => canAuctionTeamAcquire(state, humanTeam, player))
    .map(player => ({
      player,
      score: (player.id === targetPlayerId ? 1_000_000 : 0)
        + (player.id === pairPlayerId ? 100_000 : 0)
        + (activePositionPreferenceFor(strategy, humanTeam.positionCounts, player.position) ? 10_000 : 0)
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
  const preference = activePositionPreferenceFor(strategy, team.positionCounts, player.position);
  const isPreferred = preference !== undefined;
  const needDollars = Math.ceil(auctionRosterNeedFor(team, player.position) * 2);
  const preferenceDollars = isPreferred ? Math.ceil(player.expectedPrice * 0.15) : 0;
  const targetDollars = isTarget || isPair ? Math.ceil(player.expectedPrice * 0.1) : 0;
  const valueLimit = Math.max(
    state.configuration.minimumBidDollars,
    Math.round(player.expectedPrice) + needDollars + preferenceDollars + targetDollars,
  );
  const strategyLimit = Math.min(
    team.maxBid,
    isTarget ? strategy.target?.maxAuctionPrice ?? team.maxBid : team.maxBid,
    preference?.maxAuctionPrice ?? team.maxBid,
  );

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
  const positionsByPlayer = new Map(state.board.players.map(player => [player.id, player.position]));
  const positionCounts = humanTeam.roster.reduce<Record<string, number>>((counts, player) => {
    const position = positionsByPlayer.get(player.playerId);
    if (position !== undefined) counts[position] = (counts[position] ?? 0) + 1;
    return counts;
  }, {});
  const selected = state.board.players
    .filter(player => player.available && humanTeam.slots.some(slot =>
      slot.playerId === undefined && slot.eligiblePositions.includes(player.position)
    ))
    .map(player => ({
      player,
      score: (player.id === targetPlayerId && targetDeadlineAllowsPick ? 1_000_000 : 0)
        + (player.id === pairPlayerId ? 100_000 : 0)
        + (activePositionPreferenceFor(strategy, positionCounts, player.position) ? 10_000 : 0)
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
  runNumber: number;
  seed: string;
  teams: readonly SeasonSimulationTeamResult[];
}

const isStarterSlot = (slot: string): boolean => !/^(?:BENCH|IR)/u.test(slot);

interface SimulationRosterSlot {
  slot: string;
  eligiblePositions: readonly string[];
}

const optimizedRoster = (
  roster: readonly SeasonSimulationRosterPlayer[],
  slots: readonly SimulationRosterSlot[],
): readonly SeasonSimulationRosterPlayer[] => {
  if (roster.length === 0 || roster.length !== slots.length || roster.length > 30) return roster;
  const starterSlots = slots
    .filter(slot => isStarterSlot(slot.slot))
    .sort((left, right) =>
      left.eligiblePositions.length - right.eligiblePositions.length
      || left.slot.localeCompare(right.slot)
    );
  const reserveSlots = slots
    .filter(slot => !isStarterSlot(slot.slot))
    .sort((left, right) =>
      left.eligiblePositions.length - right.eligiblePositions.length
      || left.slot.localeCompare(right.slot)
    );

  const reserveAssignmentFor = (usedMask: number): ReadonlyMap<number, string> | null => {
    const assignment = new Map<number, string>();
    const assign = (slotIndex: number, assignedMask: number): boolean => {
      if (slotIndex === reserveSlots.length) return true;
      const slot = reserveSlots[slotIndex];
      if (slot === undefined) return false;
      for (let playerIndex = 0; playerIndex < roster.length; playerIndex += 1) {
        const player = roster[playerIndex];
        if (
          player === undefined
          || (assignedMask & (1 << playerIndex)) !== 0
          || !slot.eligiblePositions.includes(player.position)
        ) continue;
        assignment.set(playerIndex, slot.slot);
        if (assign(slotIndex + 1, assignedMask | (1 << playerIndex))) return true;
        assignment.delete(playerIndex);
      }
      return false;
    };

    return assign(0, usedMask) ? assignment : null;
  };

  let bestScore = Number.NEGATIVE_INFINITY;
  let bestAssignment: ReadonlyMap<number, string> | null = null;
  const starterAssignment = new Map<number, string>();
  const search = (slotIndex: number, usedMask: number, score: number): void => {
    if (slotIndex === starterSlots.length) {
      const reserveAssignment = reserveAssignmentFor(usedMask);
      if (reserveAssignment === null || score <= bestScore) return;
      bestScore = score;
      bestAssignment = new Map([...starterAssignment, ...reserveAssignment]);
      return;
    }
    const slot = starterSlots[slotIndex];
    if (slot === undefined) return;
    const candidates = roster
      .map((player, index) => ({ player, index }))
      .filter(({ player, index }) =>
        (usedMask & (1 << index)) === 0 && slot.eligiblePositions.includes(player.position)
      )
      .sort((left, right) =>
        right.player.week1Points - left.player.week1Points
        || left.player.playerId.localeCompare(right.player.playerId)
      );
    for (const { player, index } of candidates) {
      starterAssignment.set(index, slot.slot);
      search(slotIndex + 1, usedMask | (1 << index), score + player.week1Points);
      starterAssignment.delete(index);
    }
  };

  search(0, 0, 0);
  if (bestAssignment === null) return roster;
  return roster.map((player, index) => {
    const rosterSlot = bestAssignment?.get(index) ?? player.rosterSlot;
    return { ...player, rosterSlot, starter: isStarterSlot(rosterSlot) };
  });
};

const week1PointsFor = (
  projectionsByPlayer: ReadonlyMap<string, number>,
  playerId: string,
): number => projectionsByPlayer.get(canonicalPlayerIdentityKey(playerId)) ?? 0;

const teamResultFor = (
  input: Omit<SeasonSimulationTeamResult, "week1Points">,
  slots: readonly SimulationRosterSlot[],
): SeasonSimulationTeamResult => {
  const roster = optimizedRoster(input.roster, slots);
  return {
    ...input,
    roster,
    week1Points: roster.reduce(
      (total, player) => total + (player.starter ? player.week1Points : 0),
      0,
    ),
  };
};

const aggregateRuns = (input: {
  draftFormat: "auction" | "snake";
  runs: readonly CompletedSimulationRun[];
  runCount: number;
  seedPrefix: string;
  strategy: ParsedSeasonSimulationStrategy;
  targetPlayerId: string | undefined;
  humanTeamId: string;
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
    const humanRoster = run.teams.find(team => team.teamId === input.humanTeamId)?.roster ?? [];
    for (const player of humanRoster) {
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
    runs: input.runs.map(run => ({
      runNumber: run.runNumber,
      label: `Run ${run.runNumber}`,
      seed: run.seed,
      teams: run.teams,
    })),
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
  if (
    !Number.isInteger(input.runCount)
    || input.runCount < 1
    || input.runCount > maximumSeasonSimulationRunCount
  ) {
    throw new SeasonSimulationError(
      "invalid_run_count",
      `Simulation run count must be a whole number from 1 through ${maximumSeasonSimulationRunCount}.`,
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
  const week1ProjectionsByPlayer = new Map(input.setup.playerCatalog.map(player => {
    const playerKey = canonicalPlayerIdentityKey(player.name);
    return [playerKey, input.week1Projections?.[playerKey] ?? player.week1Projection ?? 0];
  }));
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
      if (!state.teams.some(team => team.id === input.humanTeamId)) {
        throw new SeasonSimulationError("human_team_missing", "Claim a team before running simulations.");
      }
      runs.push({
        runNumber,
        seed,
        teams: state.teams.map(team => teamResultFor({
          teamId: team.id,
          teamName: team.name,
          isUserTeam: team.id === input.humanTeamId,
          roster: team.roster.map(selection => {
            const player = state.configuration.players.find(candidate => candidate.id === selection.playerId);
            const pick = state.board.picks.find(candidate =>
              candidate.teamId === team.id
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
              rosterSlot: selection.rosterSlot,
              starter: isStarterSlot(selection.rosterSlot),
              week1Points: week1PointsFor(week1ProjectionsByPlayer, player.id),
            };
          }),
        }, team.slots)),
      });
    }

    return aggregateRuns({
      draftFormat: "snake",
      runs,
      runCount: input.runCount,
      seedPrefix,
      strategy: strategyResolution.strategy,
      targetPlayerId: strategyResolution.targetPlayerId,
      humanTeamId: input.humanTeamId,
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
    if (!state.teams.some(team => team.id === input.humanTeamId)) {
      throw new SeasonSimulationError("human_team_missing", "Claim a team before running simulations.");
    }
    runs.push({
      runNumber,
      seed,
      teams: state.teams.map(team => teamResultFor({
        teamId: team.id,
        teamName: team.name,
        isUserTeam: team.id === input.humanTeamId,
        spent: team.spent,
        budgetRemaining: team.budgetRemaining,
        roster: team.roster.map(player => ({
          playerId: player.playerId,
          playerName: player.playerName,
          position: player.position,
          source: player.source,
          price: player.price,
          rosterSlot: player.rosterSlot,
          starter: isStarterSlot(player.rosterSlot),
          week1Points: week1PointsFor(week1ProjectionsByPlayer, player.playerId),
        })),
      }, team.slots)),
    });
  }

  return aggregateRuns({
    draftFormat: "auction",
    runs,
    runCount: input.runCount,
    seedPrefix,
    strategy: strategyResolution.strategy,
    targetPlayerId: strategyResolution.targetPlayerId,
    humanTeamId: input.humanTeamId,
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
