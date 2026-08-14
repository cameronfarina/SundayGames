import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";
import {
  applyGenericAuctionMockCommand,
  GenericAuctionMockError,
  isAutomatedAuctionAcquisitionEligible,
  maximumAutomatedAuctionBidFor,
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
import {
  activePositionPreferenceFor,
  preferenceRosterCountFor,
  resolveSeasonSimulationPreferences,
  type ResolvedSeasonSimulationPreference,
  type SeasonSimulationPreferenceOutcome,
  type SeasonSimulationPreferenceRule,
  type SeasonSimulationPreferredPosition,
} from "./seasonSimulationPreferences.js";
import {
  seasonSimulationTargetOutcomeFor,
  targetKeeperInfeasibilityFor,
  targetResolutionInfeasibilityFor,
  type ResolvedSeasonSimulationTarget,
  type SeasonSimulationTargetConstraint,
  type SeasonSimulationTargetOutcome,
} from "./seasonSimulationTargets.js";
import { reconciledSeasonSimulationTeams } from "./seasonSimulationAuctionBudgets.js";
import { resolveAuctionTargetPlan } from "./seasonSimulationTargetPlan.js";

export type {
  SeasonSimulationPreferenceOutcome,
  SeasonSimulationPreferenceRule,
  SeasonSimulationPreferredPosition,
} from "./seasonSimulationPreferences.js";
export type {
  SeasonSimulationTargetConstraint,
  SeasonSimulationTargetOutcome,
  SeasonSimulationTargetOutcomeReason,
  SeasonSimulationTargetOutcomeStatus,
} from "./seasonSimulationTargets.js";

export interface SeasonSimulationPositionCap {
  position: "QB" | "RB" | "WR" | "TE";
  maxAuctionPrice: number;
  excludeNamedTargets: boolean;
}

export interface ParsedSeasonSimulationStrategy {
  rawInput: string;
  targets?: readonly SeasonSimulationTargetConstraint[] | undefined;
  target?: SeasonSimulationTargetConstraint | undefined;
  preferredPositions: readonly SeasonSimulationPreferredPosition[];
  positionCaps?: readonly SeasonSimulationPositionCap[] | undefined;
  pairWithPlayerName?: string | undefined;
  summary: string;
  warnings: readonly string[];
}

export type SeasonSimulationErrorCode =
  | "human_team_missing"
  | "invalid_configuration"
  | "invalid_run_count"
  | "invalid_seed_prefix"
  | "simulation_account_queue_full"
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
  targetConstraints?: readonly SeasonSimulationTargetConstraint[] | undefined;
  seedPrefix?: string | undefined;
  playerExpectedPrices?: Readonly<Record<string, number>> | undefined;
  playerHumanValues?: Readonly<Record<string, number>> | undefined;
  week1Projections?: Readonly<Record<string, number>> | undefined;
}

export interface SeasonSimulationProgress {
  completed: number;
  total: number;
}

export interface RunSeasonSimulationsOptions {
  onProgress?: ((progress: SeasonSimulationProgress) => void) | undefined;
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

export interface SeasonSimulationResult {
  draftFormat: "auction" | "snake";
  runCount: number;
  completedCount: number;
  seedPrefix: string;
  strategy: ParsedSeasonSimulationStrategy;
  targetOutcomes?: readonly SeasonSimulationTargetOutcome[] | undefined;
  targetOutcome?: SeasonSimulationTargetOutcome | undefined;
  preferenceOutcomes?: readonly SeasonSimulationPreferenceOutcome[] | undefined;
  playerExposure: readonly SeasonSimulationPlayerExposure[];
  positionCounts: Readonly<Record<string, SeasonSimulationPositionCount>>;
  runs: readonly SeasonSimulationRunResult[];
}

interface ExtractedMatch {
  index: number;
  match: RegExpMatchArray;
  remainder: string;
}

const extract = (value: string, pattern: RegExp): ExtractedMatch | undefined => {
  const match = value.match(pattern);
  if (match === null || match.index === undefined) return undefined;

  return {
    index: match.index,
    match,
    remainder: `${value.slice(0, match.index)}${" ".repeat(match[0].length)}${value.slice(match.index + match[0].length)}`,
  };
};

const cleanPlayerName = (value: string): string => value
  .trim()
  .replace(/\s+/g, " ")
  .replace(/[.,;:]+$/g, "");

const unsupportedWarning = (value: string): string | undefined => {
  const remainder = value
    .replace(/\brun\s+\d+\s+(?:mock\s+)?simulations?\s+(?:where\s+)?(?:i\s+)?/gi, " ")
    .replace(/\b(?:where|i|please|and|to|a|an|the|draft)\b/gi, " ")
    .replace(/[^a-z0-9$'-]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");

  return remainder.length === 0 ? undefined : `Unsupported strategy phrase: "${remainder}".`;
};

const summaryFor = (
  targets: readonly SeasonSimulationTargetConstraint[],
  preferredPositions: readonly SeasonSimulationPreferredPosition[],
  positionCaps: readonly SeasonSimulationPositionCap[],
  pairWithPlayerName: string | undefined,
): string => {
  const clauses: string[] = [];
  for (const target of targets) {
    if (target.maxAuctionPrice !== undefined) {
      clauses.push(`target ${target.playerName} up to $${target.maxAuctionPrice}`);
    } else if (target.maxSnakeRound !== undefined) {
      clauses.push(`target ${target.playerName} by round ${target.maxSnakeRound}`);
    } else if (target.maxSnakeOverallPick !== undefined) {
      clauses.push(`target ${target.playerName} by pick ${target.maxSnakeOverallPick}`);
    } else {
      clauses.push(`target ${target.playerName}`);
    }
  }
  for (const preference of preferredPositions) {
    const count = preference.targetCount === undefined ? "" : `${preference.targetCount} `;
    const cap = preference.maxAuctionPrice === undefined
      ? ""
      : ` up to $${preference.maxAuctionPrice} each`;
    clauses.push(`prioritize ${count}${preference.tier} ${preference.position}${cap}`);
  }
  for (const positionCap of positionCaps) {
    clauses.push(
      `cap ${positionCap.excludeNamedTargets ? "other " : ""}${positionCap.position}s at $${positionCap.maxAuctionPrice}`,
    );
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
  const targetCandidates: {
    index: number;
    target: SeasonSimulationTargetConstraint;
  }[] = [];
  const preferredPositions: SeasonSimulationPreferredPosition[] = [];
  const positionCaps: SeasonSimulationPositionCap[] = [];

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

  while (true) {
    const positionCap = extract(
      remainder,
      /\b(?:do\s+not|don't|dont|never)\s+(?:spend|pay)\s+(?:over|more\s+than)\s+\$?(\d+)\s+(?:for|on)\s+(?:(another|any\s+other|other)\s+)?(QB|RB|WR|TE)s?\b/i,
    );
    if (positionCap === undefined) break;
    const maxAuctionPrice = Number(positionCap.match[1]);
    const position = positionCap.match[3]?.toUpperCase();
    if (
      Number.isSafeInteger(maxAuctionPrice)
      && maxAuctionPrice > 0
      && (position === "QB" || position === "RB" || position === "WR" || position === "TE")
    ) {
      positionCaps.push({
        position,
        maxAuctionPrice,
        excludeNamedTargets: positionCap.match[2] !== undefined,
      });
    }
    remainder = positionCap.remainder;
  }

  while (true) {
    const auctionTarget = extract(
      remainder,
      /\b(?:draft|target)\s+([a-z][a-z.'-]*(?:\s+(?!(?:and\s+)?(?:draft|target)\b)[a-z0-9][a-z0-9.'-]*){0,4}?)\s+(?:for\s+)?(no\s+more\s+than|under|(?:at\s+)?(?:a\s+)?max(?:imum)?(?:\s+price)?(?:\s+of)?)\s*\$(\d+)\b/i,
    );
    if (auctionTarget === undefined) break;
    const playerName = cleanPlayerName(auctionTarget.match[1] ?? "");
    const strictMaximum = auctionTarget.match[2]?.toLowerCase() === "under";
    const maxAuctionPrice = Number(auctionTarget.match[3]) - (strictMaximum ? 1 : 0);
    if (playerName.length > 0 && Number.isSafeInteger(maxAuctionPrice) && maxAuctionPrice > 0) {
      targetCandidates.push({
        index: auctionTarget.index,
        target: { playerName, maxAuctionPrice },
      });
    }
    remainder = auctionTarget.remainder;
  }

  while (true) {
    const snakeRoundTarget = extract(
      remainder,
      /\b(?:draft|target)\s+([a-z][a-z.'-]*(?:\s+(?!(?:and\s+)?(?:draft|target)\b)[a-z0-9][a-z0-9.'-]*){0,4}?)\s+(?:by|no\s+later\s+than)\s+round\s+(\d+)\b/i,
    );
    if (snakeRoundTarget === undefined) break;
    const playerName = cleanPlayerName(snakeRoundTarget.match[1] ?? "");
    const maxSnakeRound = Number(snakeRoundTarget.match[2]);
    if (playerName.length > 0 && Number.isSafeInteger(maxSnakeRound) && maxSnakeRound > 0) {
      targetCandidates.push({
        index: snakeRoundTarget.index,
        target: { playerName, maxSnakeRound },
      });
    }
    remainder = snakeRoundTarget.remainder;
  }

  while (true) {
    const snakePickTarget = extract(
      remainder,
      /\b(?:draft|target)\s+([a-z][a-z.'-]*(?:\s+(?!(?:and\s+)?(?:draft|target)\b)[a-z0-9][a-z0-9.'-]*){0,4}?)\s+(?:by|no\s+later\s+than)\s+(?:overall\s+)?pick\s+(\d+)\b/i,
    );
    if (snakePickTarget === undefined) break;
    const playerName = cleanPlayerName(snakePickTarget.match[1] ?? "");
    const maxSnakeOverallPick = Number(snakePickTarget.match[2]);
    if (
      playerName.length > 0
      && Number.isSafeInteger(maxSnakeOverallPick)
      && maxSnakeOverallPick > 0
    ) {
      targetCandidates.push({
        index: snakePickTarget.index,
        target: { playerName, maxSnakeOverallPick },
      });
    }
    remainder = snakePickTarget.remainder;
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

  while (true) {
    const namedTarget = extract(
      remainder,
      /\b(?:draft|target)\s+([a-z][a-z.'-]*(?:\s+(?!(?:and|to)\b|(?:and\s+)?(?:draft|target)\b)[a-z0-9][a-z0-9.'-]*){0,4}?)(?=\s*(?:(?:[.;,]\s*)(?:(?:draft|target)\b|$)|and\s+(?:draft|target)\b|(?:and|to)\b|$))/i,
    );
    if (namedTarget === undefined) break;
    const playerName = cleanPlayerName(namedTarget.match[1] ?? "");
    if (playerName.length > 0) {
      targetCandidates.push({ index: namedTarget.index, target: { playerName } });
    }
    remainder = namedTarget.remainder;
  }

  const targets = targetCandidates
    .sort((left, right) => left.index - right.index)
    .map(candidate => candidate.target);
  const target = targets[0];
  const warning = unsupportedWarning(remainder);
  return {
    rawInput,
    targets,
    ...(target === undefined ? {} : { target }),
    preferredPositions,
    ...(positionCaps.length === 0 ? {} : { positionCaps }),
    ...(pairWithPlayerName === undefined || pairWithPlayerName.length === 0
      ? {}
      : { pairWithPlayerName }),
    summary: summaryFor(targets, preferredPositions, positionCaps, pairWithPlayerName),
    warnings: warning === undefined ? [] : [warning],
  };
};

const defaultSeedPrefix = "season-simulation";
const maximumDecisionsPerRun = 10_000;
// AI pacing includes a $2 clearing cushion; the human needs one more dollar to win the next bid.
const humanClearingPriceCushionDollars = 3;

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

const auctionProjectedWeeklyProductionFor = (
  player: GenericAuctionMockBoardPlayer,
): number => player.week1Projection
  ?? (player.weeks1To4Projection === undefined ? undefined : player.weeks1To4Projection / 4)
  ?? (player.seasonProjection === undefined ? 0 : player.seasonProjection / 17);

const needsDedicatedStarterFor = (
  team: GenericAuctionMockTeamReadModel,
  position: string,
): boolean => team.slots.some(slot =>
  slot.playerId === undefined
  && slot.eligiblePositions.length === 1
  && slot.eligiblePositions[0] === position
);

const targetsFor = (
  strategy: ParsedSeasonSimulationStrategy,
): readonly SeasonSimulationTargetConstraint[] => strategy.targets
  ?? (strategy.target === undefined ? [] : [strategy.target]);

const canAuctionTeamRoster = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockBoardPlayer,
): boolean => team.rosterSlotsRemaining > 0
  && team.maxBid >= state.configuration.minimumBidDollars
  && (team.positionCounts[player.position] ?? 0)
    < (state.configuration.positionMaximums[player.position] ?? 0)
  && team.slots.some(slot =>
    slot.playerId === undefined && slot.eligiblePositions.includes(player.position)
  );

const canAuctionTeamAcquire = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockBoardPlayer,
): boolean => player.available && canAuctionTeamRoster(state, team, player);

const availableTargetPlayersFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  currentPlayerId: string,
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>,
): readonly GenericAuctionMockBoardPlayer[] => [...targetsByPlayerId.keys()]
  .filter(playerId => playerId !== currentPlayerId)
  .map(playerId => state.board.players.find(player => player.id === playerId))
  .filter((player): player is GenericAuctionMockBoardPlayer =>
    player !== undefined && canAuctionTeamAcquire(state, team, player)
  );

const canFitTargetPositions = (
  positions: readonly string[],
  openSlots: GenericAuctionMockTeamReadModel["slots"],
): boolean => {
  const orderedPositions = [...positions].sort((left, right) => {
    const leftOptions = openSlots.filter(slot => slot.eligiblePositions.includes(left)).length;
    const rightOptions = openSlots.filter(slot => slot.eligiblePositions.includes(right)).length;
    return leftOptions - rightOptions;
  });
  const positionBySlotIndex = new Map<number, number>();
  const assign = (positionIndex: number, visitedSlotIndexes: Set<number>): boolean => {
    const position = orderedPositions[positionIndex];
    if (position === undefined) return false;
    for (const [slotIndex, slot] of openSlots.entries()) {
      if (visitedSlotIndexes.has(slotIndex) || !slot.eligiblePositions.includes(position)) continue;
      visitedSlotIndexes.add(slotIndex);
      const assignedPositionIndex = positionBySlotIndex.get(slotIndex);
      if (
        assignedPositionIndex === undefined
        || assign(assignedPositionIndex, visitedSlotIndexes)
      ) {
        positionBySlotIndex.set(slotIndex, positionIndex);
        return true;
      }
    }
    return false;
  };

  return orderedPositions.every((_, positionIndex) => assign(positionIndex, new Set()));
};

const preservesSlotsForTargets = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockBoardPlayer,
  targetPlayers: readonly GenericAuctionMockBoardPlayer[],
): boolean => {
  const playerSlotIndex = team.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) =>
      slot.playerId === undefined && slot.eligiblePositions.includes(player.position)
    )
    .sort((left, right) =>
      left.slot.eligiblePositions.length - right.slot.eligiblePositions.length
      || left.slot.slot.localeCompare(right.slot.slot)
    )[0]?.index;
  if (playerSlotIndex === undefined) return false;

  const projectedPositionCounts = { ...team.positionCounts };
  projectedPositionCounts[player.position] = (projectedPositionCounts[player.position] ?? 0) + 1;
  for (const targetPlayer of targetPlayers) {
    projectedPositionCounts[targetPlayer.position]
      = (projectedPositionCounts[targetPlayer.position] ?? 0) + 1;
  }
  if (Object.entries(projectedPositionCounts).some(([position, count]) =>
    count > (state.configuration.positionMaximums[position] ?? 0)
  )) return false;

  const remainingSlots = team.slots.filter((slot, index) =>
    index !== playerSlotIndex && slot.playerId === undefined
  );
  return canFitTargetPositions(
    targetPlayers.map(targetPlayer => targetPlayer.position),
    remainingSlots,
  );
};

const canReserveTargetsForTeam = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  targetPlayers: readonly GenericAuctionMockBoardPlayer[],
): boolean => {
  const projectedPositionCounts = { ...team.positionCounts };
  for (const targetPlayer of targetPlayers) {
    projectedPositionCounts[targetPlayer.position]
      = (projectedPositionCounts[targetPlayer.position] ?? 0) + 1;
  }
  if (Object.entries(projectedPositionCounts).some(([position, count]) =>
    count > (state.configuration.positionMaximums[position] ?? 0)
  )) return false;

  return canFitTargetPositions(
    targetPlayers.map(targetPlayer => targetPlayer.position),
    team.slots.filter(slot => slot.playerId === undefined),
  );
};

const minimumTargetAcquisitionCostFor = (
  state: GenericAuctionMockState,
  player: GenericAuctionMockBoardPlayer,
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>,
): number => {
  const minimumBid = state.configuration.minimumBidDollars;
  const targetCap = targetsByPlayerId.get(player.id)?.maxAuctionPrice;
  const expectedClearingPrice = Math.max(minimumBid, Math.round(player.expectedPrice));
  return targetCap === undefined
    ? expectedClearingPrice
    : Math.min(targetCap, expectedClearingPrice);
};

const plannedFutureTargetsFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockBoardPlayer,
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>,
): readonly GenericAuctionMockBoardPlayer[] => {
  const minimumBid = state.configuration.minimumBidDollars;
  const nomination = state.session.currentNomination;
  const candidateIsTarget = targetsByPlayerId.has(player.id);
  const currentBid = nomination?.playerId === player.id ? nomination.nextBid : minimumBid;
  const candidateCost = candidateIsTarget ? currentBid : 0;
  const candidateSlots = candidateIsTarget ? 1 : 0;
  const availableTargets = availableTargetPlayersFor(
    state,
    team,
    player.id,
    targetsByPlayerId,
  );
  const plannedTargets: GenericAuctionMockBoardPlayer[] = [];
  let plannedTargetCost = 0;

  for (const targetPlayer of availableTargets) {
    if (plannedTargets.length >= team.rosterSlotsRemaining - candidateSlots) break;
    const nextTargets = [...plannedTargets, targetPlayer];
    const targetsFit = candidateIsTarget
      ? preservesSlotsForTargets(state, team, player, nextTargets)
      : canReserveTargetsForTeam(state, team, nextTargets);
    if (!targetsFit) continue;

    const nextTargetCost = minimumTargetAcquisitionCostFor(
      state,
      targetPlayer,
      targetsByPlayerId,
    );
    const unplannedSlots = team.rosterSlotsRemaining - nextTargets.length - candidateSlots;
    const minimumRosterCost = unplannedSlots * minimumBid;
    if (
      candidateCost + plannedTargetCost + nextTargetCost + minimumRosterCost
      > team.budgetRemaining
    ) continue;

    plannedTargets.push(targetPlayer);
    plannedTargetCost += nextTargetCost;
  }

  return plannedTargets;
};

const selectAuctionNomination = (
  state: GenericAuctionMockState,
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>,
  pairPlayerId: string | undefined,
  preferences: readonly ResolvedSeasonSimulationPreference[],
  seed: string,
): GenericAuctionMockBoardPlayer => {
  const humanTeam = state.teams.find(team => team.id === state.configuration.humanTeamId);
  if (humanTeam === undefined) {
    throw new SeasonSimulationError("human_team_missing", "Claim a team before running simulations.");
  }
  const targetPriorityBase = 10_000_000;
  const targetOrderStep = 1_000_000;
  const targetIds = [...targetsByPlayerId.keys()];
  const targetPriorityFor = (playerId: string): number => {
    const index = targetIds.indexOf(playerId);
    return index < 0 ? 0 : targetPriorityBase + (targetIds.length - index) * targetOrderStep;
  };
  const selected = state.board.players
    .filter(player => {
      const target = targetsByPlayerId.get(player.id);
      const isUncappedTarget = target !== undefined && target.maxAuctionPrice === undefined;
      return canAuctionTeamAcquire(state, humanTeam, player)
        && (isUncappedTarget || isAutomatedAuctionAcquisitionEligible(state, humanTeam, player));
    })
    .map(player => ({
      player,
      score: targetPriorityFor(player.id)
        + (player.id === pairPlayerId ? 100_000 : 0)
        + (activePositionPreferenceFor(
          preferences,
          humanTeam.roster,
          player,
          pairPlayerId,
        ) ? 10_000 : 0)
        + (player.projectedStarter === true
          && needsDedicatedStarterFor(humanTeam, player.position) ? 1_000 : 0)
        + (player.week1Projection === 0 ? -10_000 : 0)
        + auctionRosterNeedFor(humanTeam, player.position) * 100
        + (player.humanValue ?? player.expectedPrice)
        + auctionProjectedWeeklyProductionFor(player) * 0.01
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
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>,
  pairPlayerId: string | undefined,
  strategy: ParsedSeasonSimulationStrategy,
  preferences: readonly ResolvedSeasonSimulationPreference[],
): number => {
  const target = targetsByPlayerId.get(player.id);
  const isTarget = target !== undefined;
  const isUncappedTarget = isTarget && target.maxAuctionPrice === undefined;
  if (
    isUncappedTarget
      ? !canAuctionTeamRoster(state, team, player)
      : !isAutomatedAuctionAcquisitionEligible(state, team, player)
  ) return 0;

  const isPair = player.id === pairPlayerId;
  const preference = activePositionPreferenceFor(
    preferences,
    team.roster,
    player,
    pairPlayerId,
  );
  const positionPreference = preferences.find(candidate =>
    candidate.preference.position === player.position
    && preferenceRosterCountFor(team.roster, candidate, pairPlayerId) < candidate.targetCount
  );
  const positionCap = [...(strategy.positionCaps ?? [])]
    .reverse()
    .find(cap => cap.position === player.position);
  const isPreferred = preference !== undefined;
  const needDollars = Math.ceil(auctionRosterNeedFor(team, player.position) * 2);
  const baseValue = team.isHuman ? player.humanValue ?? player.expectedPrice : player.expectedPrice;
  const preferenceDollars = isPreferred ? Math.ceil(baseValue * 0.15) : 0;
  const targetDollars = isTarget || isPair ? Math.ceil(baseValue * 0.1) : 0;
  const valueLimit = Math.max(
    state.configuration.minimumBidDollars,
    Math.round(baseValue) + needDollars + preferenceDollars + targetDollars,
  );
  const plannedTargetPlayers = plannedFutureTargetsFor(
    state,
    team,
    player,
    targetsByPlayerId,
  );
  if (
    !isTarget
    && plannedTargetPlayers.some(targetPlayer => targetPlayer.position === player.position)
  ) return 0;
  const reservedTargetBudget = plannedTargetPlayers.reduce(
    (total, targetPlayer) => total + Math.max(
      0,
      minimumTargetAcquisitionCostFor(state, targetPlayer, targetsByPlayerId)
        - state.configuration.minimumBidDollars,
    ),
    0,
  );
  const preservesTargetSlots = preservesSlotsForTargets(
    state,
    team,
    player,
    plannedTargetPlayers,
  );
  const strategyLimit = Math.min(
    team.maxBid,
    isUncappedTarget ? team.maxBid : maximumAutomatedAuctionBidFor(state, team, player),
    Math.max(0, team.maxBid - reservedTargetBudget),
    preservesTargetSlots ? team.maxBid : 0,
    target?.maxAuctionPrice ?? team.maxBid,
    positionCap === undefined || (positionCap.excludeNamedTargets && isTarget)
      ? team.maxBid
      : positionCap.maxAuctionPrice,
    isTarget ? team.maxBid : positionPreference?.preference.maxAuctionPrice ?? team.maxBid,
  );
  const minimumBid = state.configuration.minimumBidDollars;
  const discretionaryBudget = Math.max(
    0,
    team.budgetRemaining - team.rosterSlotsRemaining * minimumBid,
  );
  const closingPaceLimit = Math.min(
    team.maxBid,
    minimumBid
      + Math.ceil(discretionaryBudget / team.rosterSlotsRemaining)
      + humanClearingPriceCushionDollars,
  );
  let enforcedValueLimit = team.maxBid;
  if ((!isTarget || target.maxAuctionPrice !== undefined) && preference === undefined) {
    enforcedValueLimit = Math.max(valueLimit, closingPaceLimit);
  }

  return Math.min(team.maxBid, strategyLimit, enforcedValueLimit);
};

const runAuctionSimulation = (input: {
  config: ReturnType<typeof buildSeasonAuctionMockConfig>;
  strategy: ParsedSeasonSimulationStrategy;
  preferences: readonly ResolvedSeasonSimulationPreference[];
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>;
  pairPlayerId: string | undefined;
  seed: string;
}): GenericAuctionMockState => {
  const config = {
    ...input.config,
    ai: {
      ...input.config.ai,
      spendPacingExcludedPlayerIds: [...input.targetsByPlayerId.keys()].filter(playerId =>
        input.config.players.some(player => player.id === playerId)
      ),
    },
  };
  let state = replaySeasonAuctionMockCommands(config, []);
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
        input.targetsByPlayerId,
        input.pairPlayerId,
        input.preferences,
        input.seed,
      );
      const humanTeam = state.teams.find(team => team.id === state.configuration.humanTeamId);
      if (humanTeam === undefined) {
        throw new SeasonSimulationError("human_team_missing", "Claim a team before running simulations.");
      }
      state = applyGenericAuctionMockCommand(state, {
        type: "nominate",
        expectedRevision: state.session.revision,
        playerId: player.id,
        openingBid: state.configuration.minimumBidDollars,
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
      input.targetsByPlayerId,
      input.pairPlayerId,
      input.strategy,
      input.preferences,
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
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>,
  pairPlayerId: string | undefined,
  preferences: readonly ResolvedSeasonSimulationPreference[],
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
  const selected = state.board.players
    .filter(player => player.available && humanTeam.slots.some(slot =>
      slot.playerId === undefined && slot.eligiblePositions.includes(player.position)
    ))
    .map(player => {
      const target = targetsByPlayerId.get(player.id);
      const targetDeadlineAllowsPick = target !== undefined
        && (target.maxSnakeRound === undefined || currentPick.round <= target.maxSnakeRound)
        && (target.maxSnakeOverallPick === undefined || currentPick.overall <= target.maxSnakeOverallPick);
      return {
        player,
        score: (targetDeadlineAllowsPick ? 1_000_000 : 0)
          + (player.id === pairPlayerId ? 100_000 : 0)
          + (activePositionPreferenceFor(
            preferences,
            humanTeam.roster,
            player,
            pairPlayerId,
          ) ? 10_000 : 0)
          + snakeRosterNeedFor(humanTeam, player.position) * 100
          - (player.personalRank ?? player.leagueExpectedPick ?? player.rank)
          + deterministicFraction(`${seed}:pick:${currentPick.overall}:${player.id}`) * 0.001,
      };
    })
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
  preferences: readonly ResolvedSeasonSimulationPreference[];
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>;
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
      input.targetsByPlayerId,
      input.pairPlayerId,
      input.preferences,
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
  resolvedTargets: readonly ResolvedSeasonSimulationTarget[];
  preferences: readonly ResolvedSeasonSimulationPreference[];
  pairPlayerId: string | undefined;
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
  const humanRosters = input.runs.map(run =>
    run.teams.find(team => team.teamId === input.humanTeamId)?.roster ?? []
  );
  const targetOutcomes = input.resolvedTargets.map(resolvedTarget =>
    seasonSimulationTargetOutcomeFor({
      resolvedTarget,
      draftFormat: input.draftFormat,
      humanRosters,
    })
  );
  const targetOutcome = targetOutcomes[0];
  const preferenceOutcomes = input.preferences.map(preference => {
    const hitCount = input.runs.filter(run => {
      const roster = run.teams.find(team => team.teamId === input.humanTeamId)?.roster ?? [];
      return preferenceRosterCountFor(roster, preference, input.pairPlayerId)
        >= preference.targetCount;
    }).length;
    const status: SeasonSimulationPreferenceOutcome["status"] = hitCount === input.runCount
      ? "hit"
      : preference.feasible ? "miss" : "infeasible";
    const label = `${preference.preference.tier.charAt(0).toUpperCase()}${preference.preference.tier.slice(1)} ${preference.preference.position}`;
    const message = status === "hit"
      ? `${label} preference hit in ${hitCount}/${input.runCount} runs.`
      : status === "miss"
        ? `${label} preference missed in ${input.runCount - hitCount}/${input.runCount} runs.`
        : `${label} preference is infeasible under the recorded tier rule and constraints.`;

    return {
      position: preference.preference.position,
      tier: preference.preference.tier,
      targetCount: preference.targetCount,
      status,
      feasible: preference.feasible,
      hitCount,
      hitRate: hitCount / input.runCount,
      rule: preference.rule,
      message,
    };
  });

  return {
    draftFormat: input.draftFormat,
    runCount: input.runCount,
    completedCount: input.runs.length,
    seedPrefix: input.seedPrefix,
    strategy: input.strategy,
    ...(targetOutcomes.length === 0 ? {} : { targetOutcomes }),
    ...(targetOutcome === undefined ? {} : { targetOutcome }),
    ...(preferenceOutcomes.length === 0 ? {} : { preferenceOutcomes }),
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

const hasContiguousTokenPrefixMatch = (
  catalogId: string,
  queryTokens: readonly string[],
): boolean => catalogId.split(" ").some((_, startIndex, catalogTokens) =>
  queryTokens.every((queryToken, queryIndex) =>
    catalogTokens[startIndex + queryIndex]?.startsWith(queryToken) === true
  )
);

const resolvedStrategy = (
  strategy: ParsedSeasonSimulationStrategy,
  setup: LiveDraftRoomSetup,
  humanTeamId: string,
  teams: readonly { id: string; displayName: string }[],
  draftFormat: "auction" | "snake" | undefined,
): {
  strategy: ParsedSeasonSimulationStrategy;
  resolvedTargets: readonly ResolvedSeasonSimulationTarget[];
  pairPlayerId: string | undefined;
} => {
  const catalogNamesById = new Map(setup.playerCatalog.map(player => [
    canonicalPlayerIdentityKey(player.name),
    player.name,
  ]));
  const catalogIds = new Set(catalogNamesById.keys());
  const resolveCatalogId = (name: string | undefined): {
    id: string | undefined;
    ambiguous: boolean;
  } => {
    if (name === undefined) return { id: undefined, ambiguous: false };
    const query = canonicalPlayerIdentityKey(name);
    if (catalogIds.has(query)) return { id: query, ambiguous: false };
    const queryTokens = query.split(" ");
    const matches = [...catalogIds].filter(id =>
      id.startsWith(`${query} `)
      || id.endsWith(` ${query}`)
      || id.includes(` ${query} `)
      || hasContiguousTokenPrefixMatch(id, queryTokens)
      || (
        id.split(" ").length === queryTokens.length
        && id.split(" ").every((token, index) =>
          token.startsWith(queryTokens[index] ?? "")
          || (queryTokens[index] ?? "").startsWith(token)
        )
      )
    );
    return matches.length === 1
      ? { id: matches[0], ambiguous: false }
      : { id: undefined, ambiguous: matches.length > 1 };
  };
  const resolvedTargets = targetsFor(strategy).map(target => {
    const resolution = resolveCatalogId(target.playerName);
    return {
      target: {
        ...target,
        playerName: resolution.id === undefined
          ? target.playerName
          : catalogNamesById.get(resolution.id) ?? target.playerName,
      },
      resolution,
      playerId: resolution.id ?? canonicalPlayerIdentityKey(target.playerName),
    };
  }).filter((target, index, targets) =>
    targets.findIndex(candidate => candidate.playerId === target.playerId) === index
  );
  const pairResolution = resolveCatalogId(strategy.pairWithPlayerName);
  const pairPlayerId = pairResolution.id;
  const warnings = [...strategy.warnings];
  const classifiedTargets = resolvedTargets.map(({ target, resolution, playerId }) => {
    const infeasibility = resolution.id === undefined
      ? targetResolutionInfeasibilityFor({ target, ambiguous: resolution.ambiguous })
      : targetKeeperInfeasibilityFor({
        playerId,
        target,
        humanTeamId,
        draftFormat,
        initialRosters: setup.initialRosters,
        teams,
      });
    if (infeasibility !== undefined) warnings.push(infeasibility.message);
    return {
      playerId,
      target,
      ...(infeasibility === undefined ? {} : { infeasibility }),
    };
  });
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

  const targets = resolvedTargets.map(({ target }) => target);
  const target = targets[0];
  return {
    strategy: {
      ...strategy,
      ...(strategy.targets === undefined && strategy.target === undefined ? {} : {
        targets,
        ...(target === undefined ? {} : { target }),
        summary: summaryFor(
          targets,
          strategy.preferredPositions,
          strategy.positionCaps ?? [],
          strategy.pairWithPlayerName,
        ),
      }),
      warnings,
    },
    resolvedTargets: classifiedTargets,
    pairPlayerId,
  };
};

const withConfiguredTargets = (
  strategy: ParsedSeasonSimulationStrategy,
  configuredTargets: readonly SeasonSimulationTargetConstraint[],
): ParsedSeasonSimulationStrategy => {
  if (configuredTargets.length === 0) return strategy;

  const normalizedConfiguredTargets = configuredTargets
    .map(target => ({ ...target, playerName: target.playerName.trim() }))
    .filter(target => target.playerName.length > 0);
  const targets = [
    ...normalizedConfiguredTargets,
    ...targetsFor(strategy),
  ];
  const target = targets[0];

  return {
    ...strategy,
    targets,
    ...(target === undefined ? {} : { target }),
    summary: summaryFor(
      targets,
      strategy.preferredPositions,
      strategy.positionCaps ?? [],
      strategy.pairWithPlayerName,
    ),
  };
};

const runSeasonSimulationsUnchecked = (
  input: RunSeasonSimulationsInput,
  options: RunSeasonSimulationsOptions,
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

  const parsedStrategy = withConfiguredTargets(
    parseSeasonSimulationStrategy(input.strategyInput ?? ""),
    input.targetConstraints ?? [],
  );
  const week1ProjectionsByPlayer = new Map(input.setup.playerCatalog.map(player => {
    const playerKey = canonicalPlayerIdentityKey(player.name);
    return [playerKey, input.week1Projections?.[playerKey] ?? player.week1Projection ?? 0];
  }));
  const formatWarnings = [...parsedStrategy.warnings];
  if (
    input.season.settings.draftFormat === "auction"
    && targetsFor(parsedStrategy).some(target =>
      target.maxSnakeRound !== undefined || target.maxSnakeOverallPick !== undefined
    )
  ) {
    formatWarnings.push(
      "Round and pick deadlines do not apply to auction simulations; the player target was still prioritized.",
    );
  }
  if (
    input.season.settings.draftFormat === "snake"
    && targetsFor(parsedStrategy).some(target => target.maxAuctionPrice !== undefined)
  ) {
    formatWarnings.push(
      "Auction price limits do not apply to snake simulations; the player target was still prioritized.",
    );
  }
  const parsed = { ...parsedStrategy, warnings: formatWarnings };
  const baseStrategyResolution = resolvedStrategy(
    parsed,
    input.setup,
    input.humanTeamId,
    input.season.teams,
    input.season.settings.draftFormat,
  );
  const targetPlan = input.season.settings.draftFormat === "auction"
    ? resolveAuctionTargetPlan({
      state: replaySeasonAuctionMockCommands(buildSeasonAuctionMockConfig({
        season: input.season,
        setup: input.setup,
        humanTeamId: input.humanTeamId,
        sessionId: `${seedPrefix}-target-plan`,
        seed: `${seedPrefix}:target-plan`,
        playerExpectedPrices: input.playerExpectedPrices,
        playerHumanValues: input.playerHumanValues,
      }), []),
      humanTeamId: input.humanTeamId,
      targets: baseStrategyResolution.resolvedTargets,
    })
    : { targets: baseStrategyResolution.resolvedTargets, plannedAcquisitions: [] };
  const targetPlanWarnings = targetPlan.targets
    .map(target => target.infeasibility?.message)
    .filter((message): message is string =>
      message !== undefined && !baseStrategyResolution.strategy.warnings.includes(message)
    );
  const preferenceResolution = resolveSeasonSimulationPreferences({
    preferences: baseStrategyResolution.strategy.preferredPositions,
    season: input.season,
    setup: input.setup,
    humanTeamId: input.humanTeamId,
    pairPlayerId: baseStrategyResolution.pairPlayerId,
    playerExpectedPrices: input.playerExpectedPrices,
  });
  const strategyResolution = {
    ...baseStrategyResolution,
    resolvedTargets: targetPlan.targets,
    strategy: {
      ...baseStrategyResolution.strategy,
      warnings: [
        ...baseStrategyResolution.strategy.warnings,
        ...targetPlanWarnings,
        ...preferenceResolution.warnings,
      ],
    },
  };
  const targetsByPlayerId = new Map(strategyResolution.resolvedTargets
    .filter(target => target.infeasibility === undefined)
    .map(({ playerId, target }) => [playerId, target]));
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
        preferences: preferenceResolution.preferences,
        targetsByPlayerId,
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
      options.onProgress?.({ completed: runNumber, total: input.runCount });
    }

    return aggregateRuns({
      draftFormat: "snake",
      runs,
      runCount: input.runCount,
      seedPrefix,
      strategy: strategyResolution.strategy,
      resolvedTargets: strategyResolution.resolvedTargets,
      preferences: preferenceResolution.preferences,
      pairPlayerId: strategyResolution.pairPlayerId,
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
      playerHumanValues: input.playerHumanValues,
    });
    const state = runAuctionSimulation({
      config: { ...config, plannedAcquisitions: targetPlan.plannedAcquisitions },
      strategy: strategyResolution.strategy,
      preferences: preferenceResolution.preferences,
      targetsByPlayerId,
      pairPlayerId: strategyResolution.pairPlayerId,
      seed,
    });
    if (!state.teams.some(team => team.id === input.humanTeamId)) {
      throw new SeasonSimulationError("human_team_missing", "Claim a team before running simulations.");
    }
    const reconciledTeams = reconciledSeasonSimulationTeams({
      state,
      targetsByPlayerId,
      positionCaps: strategyResolution.strategy.positionCaps ?? [],
    });
    runs.push({
      runNumber,
      seed,
      teams: reconciledTeams.map(team => teamResultFor({
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
    options.onProgress?.({ completed: runNumber, total: input.runCount });
  }

  return aggregateRuns({
    draftFormat: "auction",
    runs,
    runCount: input.runCount,
    seedPrefix,
    strategy: strategyResolution.strategy,
    resolvedTargets: strategyResolution.resolvedTargets,
    preferences: preferenceResolution.preferences,
    pairPlayerId: strategyResolution.pairPlayerId,
    humanTeamId: input.humanTeamId,
  });
};

export const runSeasonSimulations = (
  input: RunSeasonSimulationsInput,
  options: RunSeasonSimulationsOptions = {},
): SeasonSimulationResult => {
  try {
    return runSeasonSimulationsUnchecked(input, options);
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
