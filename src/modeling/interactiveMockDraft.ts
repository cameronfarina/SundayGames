import { keepers as defaultKeepers, type KeeperDeclaration } from "../../config/keepers.js";
import { leagueConfig, ownerOrder, primaryOwner, type Owner, type Position } from "../../config/league.js";
import type { DraftRoomRanking } from "../data/draftRoomRankings.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import type { HistoricalAuctionRecord } from "../data/parseHistoricalBoards.js";
import type { ProjectionRecord } from "../projections.js";
import type { Player } from "../types.js";
import {
  buildAuctionConfig,
  buildAuctionPlayerPool,
  buildInitialRostersFromKeepers,
  buildOwnerAuctionBehaviors,
  buildOwnerDemandMultipliers,
  buildOwnerRosterMaximums,
  buildRunVariantOwnerAuctionBehaviors,
  buildRunVariantOwnerDemandMultipliers,
  resolveAuctionSale,
  selectNominatedPlayer,
  type AuctionBid,
  type AuctionDiagnosticsMode,
  type AuctionEngineConfig,
  type AuctionEngineConfigOverrides,
  type AuctionOwnerState,
  type OwnerAuctionBehaviors,
  type OwnerDemandMultipliers,
  type OwnerPositionAnchorTargets,
  type OwnerPositionCoreBudgetEnvelopes,
  type OwnerPositionCoreMaxBids,
  type OwnerPositionCoreTargets,
  type OwnerPositionSlotMaxBids,
  type OwnerRosterMaximums,
} from "./auctionEngine.js";
import { buildBasePrices, defaultPricingConfig, type PricingConfig } from "./basePricing.js";
import { draftPlanAuctionOverridesFor } from "./draftPlan.js";
import {
  applyKeeperScenarioToPrices,
  buildKeeperScenarios,
  type KeeperScenario,
  type KeeperScenarioKey,
} from "./keeperInflation.js";
import {
  buildLiveDraftState,
  type LiveDraftOwnerState,
  type LiveDraftShortlistTarget,
  type LiveDraftState,
  type LiveDraftTarget,
} from "./liveDraft.js";
import {
  defaultLiveDraftStrategyKey,
  type LiveDraftStrategyDefinition,
  type LiveDraftStrategyKey,
} from "./liveDraftStrategies.js";
import { buildOwnerProfiles } from "./ownerProfiles.js";
import { buildProjectionRankings } from "./projectionRankings.js";

type PositionAmounts = Record<Position, number>;

export type InteractiveMockDraftPhase =
  | "ai-sale"
  | "human-decision"
  | "human-nomination"
  | "complete"
  | "blocked";

export type InteractiveMockDraftAction = "advance" | "pass" | "cam-bid" | "cam-win" | "cam-nominate";

export interface InteractiveMockDraftNomination {
  player: string;
  position: Position;
  teamAbbreviation?: string;
  marketPrice: number;
  projectedWeeks1To4: number;
  topCandidates: {
    rank: number;
    player: string;
    position: Position;
    marketPrice: number;
    score: number;
  }[];
}

export interface InteractiveMockDraftBid {
  owner: Owner;
  player: string;
  amount: number;
  maxBid: number;
  marketPrice: number;
}

export interface InteractiveMockDraftCamDecision {
  maxBid: number;
  recommendedBid: number;
  topAiBid: number;
  topAiBidOwner: Owner;
  aiSalePrice: number;
  valueGap: number;
}

export type InteractiveMockDraftAuctionEventType =
  | "nomination"
  | "bid"
  | "pass"
  | "countdown"
  | "sold";

export interface InteractiveMockDraftAuctionEvent {
  type: InteractiveMockDraftAuctionEventType;
  text: string;
  owner?: Owner;
  amount?: number;
  countdown?: number;
}

export type InteractiveMockDraftAuctionStatus = "ai-sale" | "cam-decision" | "sold";

export interface InteractiveMockDraftAuctionState {
  status: InteractiveMockDraftAuctionStatus;
  player: string;
  position: Position;
  nominator: Owner;
  openingBid: number;
  currentBid: number;
  currentBidOwner: Owner;
  nextCamBid?: number;
  camMaxBid?: number;
  feed: InteractiveMockDraftAuctionEvent[];
  resolution?: {
    owner: Owner;
    price: number;
    command: string;
  };
}

export interface InteractiveMockDraftState {
  phase: InteractiveMockDraftPhase;
  watchOwner: Owner;
  strategy: LiveDraftStrategyDefinition;
  scenario: KeeperScenario;
  seed: string;
  pickNumber: number;
  commandCount: number;
  nominationCursor: number;
  nominator?: Owner;
  nomination?: InteractiveMockDraftNomination;
  aiBids: InteractiveMockDraftBid[];
  auction?: InteractiveMockDraftAuctionState;
  aiSaleCommand?: string;
  camDecision?: InteractiveMockDraftCamDecision;
  topTargets: LiveDraftTarget[];
  shortlist: LiveDraftShortlistTarget[];
  message?: string;
}

export type InteractiveMockDraftActionResult =
  | { command: string; mockDraft?: InteractiveMockDraftState }
  | { command?: undefined; mockDraft: InteractiveMockDraftState };

export interface BuildInteractiveMockDraftStateOptions {
  projections: readonly ProjectionRecord[];
  historicalRecords: readonly HistoricalAuctionRecord[];
  keepers?: readonly KeeperDeclaration[];
  scenarioKey?: KeeperScenarioKey;
  strategyKey?: LiveDraftStrategyKey;
  watchOwner?: Owner;
  commands?: readonly string[];
  pricingConfig?: PricingConfig;
  seed?: string;
  nominatedPlayer?: string;
  nominatedPrice?: number;
  draftRoomRankings?: readonly DraftRoomRanking[];
  diagnosticsMode?: AuctionDiagnosticsMode;
}

interface PreparedInteractiveMockDraft {
  scenario: KeeperScenario;
  liveState: LiveDraftState;
  auctionPlayers: Player[];
  ownerStates: AuctionOwnerState[];
  config: AuctionEngineConfig;
}

const defaultScenarioKey: KeeperScenarioKey = "expected";
const defaultWatchOwner: Owner = primaryOwner;
const defaultSeed = "live-ui";
const replacementDepthBuffer = 160;
const topTargetLimit = 500;
const topBidLimit = 5;

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const emptyPositionAmounts = (): PositionAmounts => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

const normalizePlayerSet = (players: readonly { name: string }[]): Set<string> =>
  new Set(players.map(player => normalizePlayerName(player.name)));

const mergeOwnerPositionMaps = <T extends OwnerDemandMultipliers | OwnerRosterMaximums | OwnerPositionAnchorTargets>(
  base: T,
  overrides?: T,
): T => {
  if (!overrides) return base;

  const merged = { ...base } as T;
  const owners = new Set<Owner>([
    ...(Object.keys(base) as Owner[]),
    ...(Object.keys(overrides) as Owner[]),
  ]);

  for (const owner of owners) {
    merged[owner] = {
      ...(base[owner] ?? {}),
      ...(overrides[owner] ?? {}),
    };
  }

  return merged;
};

const mergeOwnerPositionCoreBudgetEnvelopes = (
  base: OwnerPositionCoreBudgetEnvelopes,
  overrides?: OwnerPositionCoreBudgetEnvelopes,
): OwnerPositionCoreBudgetEnvelopes => {
  if (!overrides) return base;

  const merged: OwnerPositionCoreBudgetEnvelopes = { ...base };
  const owners = new Set<Owner>([
    ...(Object.keys(base) as Owner[]),
    ...(Object.keys(overrides) as Owner[]),
  ]);

  for (const owner of owners) {
    merged[owner] = {
      ...(base[owner] ?? {}),
      ...(overrides[owner] ?? {}),
    };
  }

  return merged;
};

const mergeOwnerPriceLadders = <
  T extends OwnerPositionCoreTargets | OwnerPositionCoreMaxBids | OwnerPositionSlotMaxBids,
>(
  base: T,
  overrides?: T,
): T => {
  if (!overrides) return base;

  const merged = { ...base } as T;
  const owners = new Set<Owner>([
    ...(Object.keys(base) as Owner[]),
    ...(Object.keys(overrides) as Owner[]),
  ]);

  for (const owner of owners) {
    merged[owner] = {
      ...(base[owner] ?? {}),
      ...(overrides[owner] ?? {}),
    };
  }

  return merged;
};

const mergeOwnerAuctionBehaviors = (
  base: OwnerAuctionBehaviors,
  overrides?: OwnerAuctionBehaviors,
): OwnerAuctionBehaviors => {
  if (!overrides) return base;

  const merged = { ...base };
  const owners = new Set<Owner>([
    ...(Object.keys(base) as Owner[]),
    ...(Object.keys(overrides) as Owner[]),
  ]);

  for (const owner of owners) {
    const mergedBehavior = {
      ...(base[owner] ?? {}),
      ...(overrides[owner] ?? {}),
    };
    const { priceAggression, scarcityChase, replacementPatience } = mergedBehavior;

    if (
      priceAggression === undefined ||
      scarcityChase === undefined ||
      replacementPatience === undefined
    ) {
      throw new Error(`Incomplete auction behavior override for ${owner}.`);
    }

    merged[owner] = {
      priceAggression,
      scarcityChase,
      replacementPatience,
      ...(mergedBehavior.anchorAggression === undefined
        ? {}
        : { anchorAggression: mergedBehavior.anchorAggression }),
      ...(mergedBehavior.depthAggression === undefined
        ? {}
        : { depthAggression: mergedBehavior.depthAggression }),
    };
  }

  return merged;
};

export const strategyAuctionOverridesFor = (
  owner: Owner,
  strategyKey: LiveDraftStrategyKey,
  options: { variantSeed?: string } = {},
): AuctionEngineConfigOverrides => {
  return draftPlanAuctionOverridesFor({
    owner,
    strategyKey,
    ...(options.variantSeed === undefined ? {} : { variantSeed: options.variantSeed }),
  });
};

const buildInteractiveAuctionConfig = ({
  historicalRecords,
  seed,
  watchOwner,
  strategyKey,
}: {
  historicalRecords: readonly HistoricalAuctionRecord[];
  seed: string;
  watchOwner: Owner;
  strategyKey: LiveDraftStrategyKey;
}): AuctionEngineConfig => {
  const ownerProfiles = buildOwnerProfiles(historicalRecords);
  const ownerDemandMultipliers = buildOwnerDemandMultipliers(ownerProfiles);
  const ownerBehaviors = buildOwnerAuctionBehaviors(ownerProfiles);
  const ownerRosterMaximums = buildOwnerRosterMaximums(ownerProfiles);
  const runOwnerDemandMultipliers = buildRunVariantOwnerDemandMultipliers(ownerDemandMultipliers, seed);
  const runOwnerBehaviors = buildRunVariantOwnerAuctionBehaviors(ownerBehaviors, seed);
  const strategyOverrides = strategyAuctionOverridesFor(watchOwner, strategyKey);

  return buildAuctionConfig({
    seed,
    nomination: {
      tieBreakWeight: 0.08,
    },
    bidVariance: {
      maxDiscount: 0.13,
      maxPremium: 0.12,
    },
    ownerDemandMultipliers: mergeOwnerPositionMaps(
      runOwnerDemandMultipliers,
      strategyOverrides.ownerDemandMultipliers,
    ),
    ownerBehaviors: mergeOwnerAuctionBehaviors(
      runOwnerBehaviors,
      strategyOverrides.ownerBehaviors,
    ),
    ownerRosterMaximums: mergeOwnerPositionMaps(
      ownerRosterMaximums,
      strategyOverrides.ownerRosterMaximums,
    ),
    ownerPositionAnchorTargets: mergeOwnerPositionMaps(
      {},
      strategyOverrides.ownerPositionAnchorTargets,
    ),
    ownerPositionCoreTargets: mergeOwnerPriceLadders(
      {},
      strategyOverrides.ownerPositionCoreTargets,
    ),
    ownerPositionCoreMaxBids: mergeOwnerPriceLadders(
      {},
      strategyOverrides.ownerPositionCoreMaxBids,
    ),
    ownerPositionSlotMaxBids: mergeOwnerPriceLadders(
      {},
      strategyOverrides.ownerPositionSlotMaxBids,
    ),
    ownerPositionCoreBudgetEnvelopes: mergeOwnerPositionCoreBudgetEnvelopes(
      {},
      strategyOverrides.ownerPositionCoreBudgetEnvelopes,
    ),
  });
};

const playerMetadataByName = (
  auctionPlayers: readonly Player[],
  projections: readonly ProjectionRecord[],
): Map<string, Player> => {
  const metadata = new Map(auctionPlayers.map(player => [normalizePlayerName(player.name), player]));

  for (const projection of buildProjectionRankings(projections)) {
    const key = projection.normalizedName;
    if (metadata.has(key)) continue;
    metadata.set(key, {
      id: projection.id,
      name: projection.name,
      position: projection.position,
      ...(projection.proTeamId === undefined ? {} : { proTeamId: projection.proTeamId }),
      price: 1,
      week1: projection.weeks[1] ?? 0,
      weeks1To4: projection.weeks1To4,
    });
  }

  return metadata;
};

const playerForAuctionState = (
  player: LiveDraftOwnerState["roster"][number],
  metadataByName: ReadonlyMap<string, Player>,
): Player => {
  const metadata = metadataByName.get(normalizePlayerName(player.name));

  return {
    ...(metadata?.id === undefined ? {} : { id: metadata.id }),
    name: player.name,
    position: player.position,
    ...(metadata?.proTeamId === undefined ? {} : { proTeamId: metadata.proTeamId }),
    price: player.price,
    week1: metadata?.week1 ?? 0,
    weeks1To4: metadata?.weeks1To4 ?? 0,
    ...(metadata?.contextAdjustmentPercent === undefined
      ? {}
      : { contextAdjustmentPercent: metadata.contextAdjustmentPercent }),
    ...(metadata?.contextEvidenceCount === undefined
      ? {}
      : { contextEvidenceCount: metadata.contextEvidenceCount }),
  };
};

const ownerStatesFromLiveState = (
  liveState: LiveDraftState,
  metadataByName: ReadonlyMap<string, Player>,
  config: AuctionEngineConfig,
): AuctionOwnerState[] =>
  liveState.owners.map(ownerState => {
    const roster = ownerState.roster.map(player => playerForAuctionState(player, metadataByName));
    const spent = roster.reduce((total, player) => total + player.price, 0);
    const rosterSlotsRemaining = config.rosterSize - roster.length;
    const budgetRemaining = config.auctionBudget - spent;

    return {
      owner: ownerState.owner,
      roster,
      spent,
      budgetRemaining,
      rosterSlotsRemaining,
      maxBid: rosterSlotsRemaining <= 0
        ? 0
        : Math.max(0, budgetRemaining - Math.max(0, rosterSlotsRemaining - 1) * config.minimumBid),
    };
  });

const prepareInteractiveMockDraft = ({
  projections,
  historicalRecords,
  keepers,
  scenarioKey,
  strategyKey,
  watchOwner,
  commands,
  pricingConfig,
  seed,
  draftRoomRankings,
}: Required<Pick<
  BuildInteractiveMockDraftStateOptions,
  "projections" | "historicalRecords" | "keepers" | "scenarioKey" | "strategyKey" | "watchOwner" | "commands" | "pricingConfig" | "seed" | "draftRoomRankings"
>>): PreparedInteractiveMockDraft => {
  const liveState = buildLiveDraftState({
    projections,
    historicalRecords,
    keepers,
    scenarioKey,
    strategyKey,
    watchOwner,
    commands,
    pricingConfig,
    targetLimit: topTargetLimit,
    draftRoomRankings,
  });
  const prices = buildBasePrices(projections, historicalRecords, pricingConfig);
  const scenario = buildKeeperScenarios(keepers).find(candidate => candidate.key === scenarioKey);
  if (!scenario) throw new Error(`Unknown keeper scenario "${scenarioKey}".`);

  const adjustedPrices = applyKeeperScenarioToPrices(prices, scenario, keepers);
  const initialRostersByOwner = buildInitialRostersFromKeepers(
    keepers,
    projections,
    scenario.includedKeeperStatuses,
  );
  const lockedKeeperCount = Object.values(initialRostersByOwner)
    .reduce((count, roster) => count + (roster?.length ?? 0), 0);
  const auctionPlayers = buildAuctionPlayerPool({
    pricedPlayers: adjustedPrices.availablePrices,
    projections,
    excludedNames: adjustedPrices.unavailableKeepers.map(keeper => keeper.player),
    targetCount: leagueConfig.teams * leagueConfig.rosterSize - lockedKeeperCount + replacementDepthBuffer,
  });
  const config = buildInteractiveAuctionConfig({
    historicalRecords,
    seed,
    watchOwner,
    strategyKey,
  });
  const metadataByName = playerMetadataByName(auctionPlayers, projections);
  const ownerStates = ownerStatesFromLiveState(liveState, metadataByName, config);
  const unavailableNames = normalizePlayerSet(ownerStates.flatMap(state => state.roster));

  return {
    scenario,
    liveState,
    auctionPlayers: auctionPlayers.filter(player => !unavailableNames.has(normalizePlayerName(player.name))),
    ownerStates,
    config,
  };
};

const allRostersFull = (ownerStates: readonly AuctionOwnerState[]): boolean =>
  ownerStates.every(state => state.rosterSlotsRemaining <= 0);

const snakeOwnerForPick = (pickIndex: number, ownerStates: readonly AuctionOwnerState[]): {
  owner: Owner;
  cursor: number;
} | undefined => {
  for (let offset = 0; offset < ownerOrder.length * 2; offset += 1) {
    const adjustedPickIndex = pickIndex + offset;
    const round = Math.floor(adjustedPickIndex / ownerOrder.length);
    const slot = adjustedPickIndex % ownerOrder.length;
    const owner = round % 2 === 0
      ? ownerOrder[slot]
      : ownerOrder[ownerOrder.length - 1 - slot];
    if (!owner) continue;

    const ownerState = ownerStates.find(state => state.owner === owner);
    if (ownerState && ownerState.rosterSlotsRemaining > 0) {
      return { owner, cursor: adjustedPickIndex + 1 };
    }
  }

  return undefined;
};

const topTargetsFor = (liveState: LiveDraftState): LiveDraftTarget[] =>
  (liveState.shortlist.length > 0
    ? liveState.shortlist.map(target => {
      const liveTarget = liveState.availableTargets.find(candidate => candidate.name === target.name);
      if (!liveTarget) throw new Error(`Missing shortlist target "${target.name}" from live board.`);
      return liveTarget;
    })
    : liveState.availableTargets).slice(0, 10);

const mockBidFor = (bid: AuctionBid, player: Player): InteractiveMockDraftBid => ({
  owner: bid.owner,
  player: player.name,
  amount: bid.amount,
  maxBid: bid.maxBid,
  marketPrice: bid.marketPrice,
});

const nominationFor = (
  selection: NonNullable<ReturnType<typeof selectNominatedPlayer>>,
): InteractiveMockDraftNomination => ({
  player: selection.player.name,
  position: selection.player.position,
  marketPrice: selection.player.price,
  projectedWeeks1To4: roundToTwo(selection.player.weeks1To4),
  topCandidates: selection.diagnostics.topCandidates.map(candidate => ({
    rank: candidate.rank,
    player: candidate.player,
    position: candidate.position,
    marketPrice: candidate.marketPrice,
    score: roundToTwo(candidate.score),
  })),
});

const nominationForPlayer = (
  player: Player,
  liveState: LiveDraftState,
): InteractiveMockDraftNomination => ({
  player: player.name,
  position: player.position,
  marketPrice: player.price,
  projectedWeeks1To4: roundToTwo(player.weeks1To4),
  topCandidates: topTargetsFor(liveState).slice(0, 8).map((target, index) => ({
    rank: index + 1,
    player: target.name,
    position: target.position,
    marketPrice: target.liveExpectedPrice,
    score: roundToTwo(target.valueScore),
  })),
});

const manualNominationPlayerFor = (
  nominatedPlayer: string,
  auctionPlayers: readonly Player[],
): Player | undefined => {
  const normalized = normalizePlayerName(nominatedPlayer);
  return auctionPlayers.find(player => normalizePlayerName(player.name) === normalized) ??
    auctionPlayers.find(player => normalizePlayerName(player.name).includes(normalized));
};

const totalCounts = (roster: readonly Player[]): PositionAmounts => {
  const counts = emptyPositionAmounts();
  for (const player of roster) counts[player.position] += 1;
  return counts;
};

const watchOwnerCanRoster = (
  watchOwnerState: AuctionOwnerState,
  player: Player,
): boolean => {
  if (watchOwnerState.rosterSlotsRemaining <= 0) return false;

  const counts = totalCounts(watchOwnerState.roster);
  return counts[player.position] < leagueConfig.rosterMaximums[player.position];
};

const aiSaleCommandFor = (owner: Owner, player: string, price: number): string =>
  `${owner} drafted ${player} for ${price}`;

const dollarText = (amount: number): string => `$${amount}`;

const auctionEvent = ({
  type,
  text,
  owner,
  amount,
  countdown,
}: {
  type: InteractiveMockDraftAuctionEventType;
  text: string;
  owner?: Owner;
  amount?: number;
  countdown?: number;
}): InteractiveMockDraftAuctionEvent => ({
  type,
  text,
  ...(owner === undefined ? {} : { owner }),
  ...(amount === undefined ? {} : { amount }),
  ...(countdown === undefined ? {} : { countdown }),
});

const bidEventFor = (owner: Owner, amount: number): InteractiveMockDraftAuctionEvent =>
  auctionEvent({
    type: "bid",
    owner,
    amount,
    text: `${owner} bid ${dollarText(amount)}`,
  });

const countdownAndSoldEventsFor = (
  owner: Owner,
  price: number,
): InteractiveMockDraftAuctionEvent[] => [
  ...[5, 4, 3, 2, 1].map(countdown =>
    auctionEvent({ type: "countdown", countdown, text: String(countdown) })
  ),
  auctionEvent({
    type: "sold",
    owner,
    amount: price,
    text: `Sold to ${owner} for ${dollarText(price)}`,
  }),
];

const nominationOpeningBidFor = (
  nomination: InteractiveMockDraftNomination,
  currentBid: number,
  config: AuctionEngineConfig,
  nominatorOpeningBid: number,
  nominatedPrice?: number,
): number => {
  const modeledOpeningBid = nominatedPrice ?? (nominatorOpeningBid > 0 ? nominatorOpeningBid : nomination.marketPrice);

  return Math.max(config.minimumBid, Math.min(currentBid, modeledOpeningBid));
};

const aiBidFeedFor = ({
  bids,
  currentBid,
  currentBidOwner,
  minimumBid,
  openingBid,
}: {
  bids: readonly AuctionBid[];
  currentBid: number;
  currentBidOwner: Owner;
  minimumBid: number;
  openingBid: number;
}): InteractiveMockDraftAuctionEvent[] => {
  if (currentBid <= openingBid) return [];

  const feed: InteractiveMockDraftAuctionEvent[] = [];
  const previousOwners = bids
    .filter(bid => bid.owner !== currentBidOwner && bid.amount > openingBid)
    .slice(0, topBidLimit)
    .sort((left, right) => left.amount - right.amount);
  let nextBid = openingBid + 1;

  for (const bid of previousOwners) {
    if (nextBid >= currentBid) break;
    if (bid.amount < nextBid) continue;
    feed.push(bidEventFor(bid.owner, nextBid));
    nextBid += minimumBid;
  }

  feed.push(bidEventFor(currentBidOwner, currentBid));
  return feed;
};

const baseStateFor = ({
  phase,
  prepared,
  watchOwner,
  seed,
  pickNumber,
  nominationCursor,
  message,
}: {
  phase: InteractiveMockDraftPhase;
  prepared: PreparedInteractiveMockDraft;
  watchOwner: Owner;
  seed: string;
  pickNumber: number;
  nominationCursor: number;
  message?: string;
}): InteractiveMockDraftState => ({
  phase,
  watchOwner,
  strategy: prepared.liveState.strategy,
  scenario: prepared.scenario,
  seed,
  pickNumber,
  commandCount: prepared.liveState.events.length,
  nominationCursor,
  aiBids: [],
  topTargets: topTargetsFor(prepared.liveState),
  shortlist: prepared.liveState.shortlist,
  ...(message === undefined ? {} : { message }),
});

const camDecisionFor = ({
  liveState,
  watchOwnerState,
  player,
  topAiBid,
  topAiBidOwner,
  aiSalePrice,
  minimumBid,
}: {
  liveState: LiveDraftState;
  watchOwnerState: AuctionOwnerState;
  player: Player;
  topAiBid: number;
  topAiBidOwner: Owner;
  aiSalePrice: number;
  minimumBid: number;
}): InteractiveMockDraftCamDecision | undefined => {
  if (!watchOwnerCanRoster(watchOwnerState, player)) return undefined;

  const target = liveState.availableTargets.find(candidate =>
    normalizePlayerName(candidate.name) === normalizePlayerName(player.name)
  );
  if (!target) return undefined;

  const mockDecisionMaxBid = target.recommendedMaxBid;
  const maxBid = Math.min(mockDecisionMaxBid, watchOwnerState.maxBid);
  if (maxBid <= aiSalePrice) return undefined;
  const nextLiveBid = aiSalePrice + minimumBid;

  return {
    maxBid,
    recommendedBid: Math.min(maxBid, nextLiveBid),
    topAiBid,
    topAiBidOwner,
    aiSalePrice,
    valueGap: target.recommendedMaxBid - target.liveExpectedPrice,
  };
};

const auctionStateFor = ({
  status,
  nomination,
  nominator,
  aiSale,
  camDecision,
  config,
  nominatedPrice,
}: {
  status: InteractiveMockDraftAuctionStatus;
  nomination: InteractiveMockDraftNomination;
  nominator: Owner;
  aiSale: NonNullable<ReturnType<typeof resolveAuctionSale>>;
  camDecision?: InteractiveMockDraftCamDecision;
  config: AuctionEngineConfig;
  nominatedPrice?: number;
}): InteractiveMockDraftAuctionState => {
  const currentBid = aiSale.price;
  const currentBidOwner = aiSale.winner;
  const openingBid = nominationOpeningBidFor(
    nomination,
    currentBid,
    config,
    aiSale.diagnostics.nominatorOpeningBid,
    nominatedPrice,
  );
  const feed = [
    auctionEvent({
      type: "nomination",
      owner: nominator,
      amount: openingBid,
      text: `${nominator} nominated ${nomination.player} for ${dollarText(openingBid)}`,
    }),
    ...aiBidFeedFor({
      bids: aiSale.bids,
      currentBid,
      currentBidOwner,
      minimumBid: config.minimumBid,
      openingBid,
    }),
  ];
  const resolution = {
    owner: aiSale.winner,
    price: aiSale.price,
    command: aiSaleCommandFor(aiSale.winner, nomination.player, aiSale.price),
  };

  if (status === "ai-sale") {
    return {
      status,
      player: nomination.player,
      position: nomination.position,
      nominator,
      openingBid,
      currentBid,
      currentBidOwner,
      feed,
      resolution,
    };
  }

  return {
    status,
    player: nomination.player,
    position: nomination.position,
    nominator,
    openingBid,
    currentBid,
    currentBidOwner,
    ...(camDecision === undefined ? {} : {
      nextCamBid: camDecision.recommendedBid,
      camMaxBid: camDecision.maxBid,
    }),
    feed,
  };
};

const stateForResolvedNomination = ({
  prepared,
  watchOwner,
  seed,
  pickIndex,
  nominationCursor,
  nominator,
  nomination,
  player,
  remainingPlayers,
  diagnosticsMode,
  nominatedPrice,
}: {
  prepared: PreparedInteractiveMockDraft;
  watchOwner: Owner;
  seed: string;
  pickIndex: number;
  nominationCursor: number;
  nominator: Owner;
  nomination: InteractiveMockDraftNomination;
  player: Player;
  remainingPlayers: readonly Player[];
  diagnosticsMode: AuctionDiagnosticsMode;
  nominatedPrice?: number;
}): InteractiveMockDraftState => {
  const aiOwnerStates = prepared.ownerStates.filter(state => state.owner !== watchOwner);
  const aiSale = resolveAuctionSale(player, aiOwnerStates, remainingPlayers, prepared.config, {
    nominator,
    diagnosticsMode,
  });
  if (!aiSale) {
    return {
      ...baseStateFor({
        phase: "blocked",
        prepared,
        watchOwner,
        seed,
        pickNumber: pickIndex + 1,
        nominationCursor,
        message: "The AI room could not produce a legal bid for this nomination.",
      }),
      nominator,
      nomination,
    };
  }

  const topAiBidder = aiSale.bids[0];
  const topAiBid = topAiBidder?.amount ?? aiSale.price;
  const topAiBidOwner = topAiBidder?.owner ?? aiSale.winner;
  const watchOwnerState = prepared.ownerStates.find(state => state.owner === watchOwner);
  if (!watchOwnerState) throw new Error(`Unknown watch owner "${watchOwner}".`);

  const camDecision = camDecisionFor({
    liveState: prepared.liveState,
    watchOwnerState,
    player,
    topAiBid,
    topAiBidOwner,
    aiSalePrice: aiSale.price,
    minimumBid: prepared.config.minimumBid,
  });
  const phase: InteractiveMockDraftPhase = camDecision ? "human-decision" : "ai-sale";
  const auction = auctionStateFor({
    status: camDecision ? "cam-decision" : "ai-sale",
    nomination,
    nominator,
    aiSale,
    ...(camDecision === undefined ? {} : { camDecision }),
    config: prepared.config,
    ...(nominatedPrice === undefined ? {} : { nominatedPrice }),
  });

  return {
    ...baseStateFor({
      phase,
      prepared,
      watchOwner,
      seed,
      pickNumber: pickIndex + 1,
      nominationCursor,
    }),
    nominator,
    nomination,
    aiBids: aiSale.bids.slice(0, topBidLimit).map(bid => mockBidFor(bid, player)),
    auction,
    aiSaleCommand: aiSaleCommandFor(aiSale.winner, player.name, aiSale.price),
    ...(camDecision === undefined ? {} : { camDecision }),
  };
};

export const buildInteractiveMockDraftState = ({
  projections,
  historicalRecords,
  keepers = defaultKeepers,
  scenarioKey = defaultScenarioKey,
  strategyKey = defaultLiveDraftStrategyKey,
  watchOwner = defaultWatchOwner,
  commands = [],
  pricingConfig = defaultPricingConfig,
  seed = defaultSeed,
  nominatedPlayer,
  nominatedPrice,
  draftRoomRankings = [],
  diagnosticsMode = "full",
}: BuildInteractiveMockDraftStateOptions): InteractiveMockDraftState => {
  const prepared = prepareInteractiveMockDraft({
    projections,
    historicalRecords,
    keepers,
    scenarioKey,
    strategyKey,
    watchOwner,
    commands,
    pricingConfig,
    seed,
    draftRoomRankings,
  });
  const pickIndex = prepared.liveState.events.length;
  const nominationTurn = snakeOwnerForPick(pickIndex, prepared.ownerStates);

  if (prepared.liveState.errors.length > 0) {
    return baseStateFor({
      phase: "blocked",
      prepared,
      watchOwner,
      seed,
      pickNumber: pickIndex + 1,
      nominationCursor: pickIndex,
      message: prepared.liveState.errors[0]?.message ?? "Resolve command errors before continuing mock draft.",
    });
  }
  if (prepared.auctionPlayers.length === 0 || allRostersFull(prepared.ownerStates) || !nominationTurn) {
    return baseStateFor({
      phase: "complete",
      prepared,
      watchOwner,
      seed,
      pickNumber: pickIndex + 1,
      nominationCursor: pickIndex,
      message: "All roster slots are filled.",
    });
  }
  if (nominationTurn.owner === watchOwner) {
    if (nominatedPlayer) {
      const manualPlayer = manualNominationPlayerFor(nominatedPlayer, prepared.auctionPlayers);
      if (!manualPlayer) {
        return baseStateFor({
          phase: "blocked",
          prepared,
          watchOwner,
          seed,
          pickNumber: pickIndex + 1,
          nominationCursor: nominationTurn.cursor,
          message: `Could not nominate "${nominatedPlayer}". Select an available player from the mock board.`,
        });
      }

      const nominatedName = normalizePlayerName(manualPlayer.name);
      const remainingPlayers = prepared.auctionPlayers.filter(player =>
        normalizePlayerName(player.name) !== nominatedName
      );
      return stateForResolvedNomination({
        prepared,
        watchOwner,
        seed,
        pickIndex,
        nominationCursor: nominationTurn.cursor,
        nominator: nominationTurn.owner,
        nomination: nominationForPlayer(manualPlayer, prepared.liveState),
        player: manualPlayer,
        remainingPlayers,
        diagnosticsMode,
        ...(nominatedPrice === undefined ? {} : { nominatedPrice }),
      });
    }

    return {
      ...baseStateFor({
        phase: "human-nomination",
        prepared,
        watchOwner,
        seed,
        pickNumber: pickIndex + 1,
        nominationCursor: nominationTurn.cursor,
        message: `${watchOwner} is up to nominate.`,
      }),
      nominator: nominationTurn.owner,
    };
  }

  const nomination = selectNominatedPlayer({
    availablePlayers: prepared.auctionPlayers,
    ownerStates: prepared.ownerStates,
    nominator: nominationTurn.owner,
    pickIndex,
    config: prepared.config,
    diagnosticsMode,
  });
  if (!nomination) {
    return baseStateFor({
      phase: "blocked",
      prepared,
      watchOwner,
      seed,
      pickNumber: pickIndex + 1,
      nominationCursor: nominationTurn.cursor,
      message: "No legal nomination is available.",
    });
  }

  const remainingPlayers = prepared.auctionPlayers.filter((_, index) => index !== nomination.index);
  return stateForResolvedNomination({
    prepared,
    watchOwner,
    seed,
    pickIndex,
    nominationCursor: nominationTurn.cursor,
    nominator: nominationTurn.owner,
    nomination: nominationFor(nomination),
    player: nomination.player,
    remainingPlayers,
    diagnosticsMode,
  });
};

const resolvedAuctionFor = (
  state: InteractiveMockDraftState,
  owner: Owner,
  price: number,
): { command: string; auction: InteractiveMockDraftAuctionState | undefined } => {
  if (!state.nomination) throw new Error("No nominated player is available to resolve.");

  const command = aiSaleCommandFor(owner, state.nomination.player, price);
  if (!state.auction) return { command, auction: undefined };

  return {
    command,
    auction: {
      ...state.auction,
      status: "sold",
      currentBid: price,
      currentBidOwner: owner,
      feed: [
        ...state.auction.feed,
        ...countdownAndSoldEventsFor(owner, price),
      ],
      resolution: { owner, price, command },
    },
  };
};

const nextAiBidAfterCam = (
  state: InteractiveMockDraftState,
  camBid: number,
): InteractiveMockDraftBid | undefined =>
  state.aiBids
    .filter(bid => bid.amount >= camBid + 1)
    .sort((left, right) => right.amount - left.amount || left.owner.localeCompare(right.owner))[0];

const stateAfterAiRaise = (
  state: InteractiveMockDraftState,
  camBid: number,
  aiBid: InteractiveMockDraftBid,
): InteractiveMockDraftState => {
  if (!state.auction || !state.camDecision) {
    throw new Error(`${state.watchOwner} does not have a live auction decision.`);
  }

  const aiResponseAmount = camBid + 1;
  const nextCamBid = aiResponseAmount + 1;
  const feed = [
    ...state.auction.feed,
    bidEventFor(state.watchOwner, camBid),
    bidEventFor(aiBid.owner, aiResponseAmount),
  ];
  const camDecision = {
    ...state.camDecision,
    recommendedBid: nextCamBid,
    aiSalePrice: aiResponseAmount,
    topAiBid: Math.max(state.camDecision.topAiBid, aiResponseAmount),
    topAiBidOwner: aiBid.owner,
  };

  return {
    ...state,
    phase: "human-decision",
    camDecision,
    auction: {
      ...state.auction,
      status: "cam-decision",
      currentBid: aiResponseAmount,
      currentBidOwner: aiBid.owner,
      nextCamBid,
      camMaxBid: state.camDecision.maxBid,
      feed,
    },
  };
};

export const resolveInteractiveMockDraftAction = (
  state: InteractiveMockDraftState,
  action: InteractiveMockDraftAction,
): InteractiveMockDraftActionResult => {
  if (action === "cam-bid" || action === "cam-win") {
    if (!state.nomination || !state.camDecision) {
      throw new Error(`${state.watchOwner} does not have a live decision to win.`);
    }
    const camBid = state.auction?.nextCamBid ?? state.camDecision.recommendedBid;
    if (camBid > state.camDecision.maxBid) {
      throw new Error(`${state.watchOwner} cannot bid ${camBid}; max bid is ${state.camDecision.maxBid}.`);
    }

    const aiRaise = nextAiBidAfterCam(state, camBid);
    if (aiRaise) {
      const nextState = stateAfterAiRaise(state, camBid, aiRaise);
      if ((nextState.auction?.nextCamBid ?? 0) <= state.camDecision.maxBid) {
        return { mockDraft: nextState };
      }

      const resolved = resolvedAuctionFor(nextState, aiRaise.owner, nextState.auction?.currentBid ?? camBid + 1);
      return {
        command: resolved.command,
        ...(resolved.auction === undefined ? {} : {
          mockDraft: {
            ...nextState,
            phase: "ai-sale",
            auction: resolved.auction,
          },
        }),
      };
    }

    const resolved = resolvedAuctionFor(state, state.watchOwner, camBid);
    return {
      command: resolved.command,
      ...(resolved.auction === undefined ? {} : {
        mockDraft: {
          ...state,
          phase: "ai-sale",
          auction: resolved.auction,
        },
      }),
    };
  }

  if (action === "advance" || action === "pass") {
    const auctionOwner = state.auction?.currentBidOwner;
    const auctionPrice = state.auction?.currentBid;
    if (action === "pass" && state.nomination && auctionOwner && auctionPrice) {
      const resolved = resolvedAuctionFor(state, auctionOwner, auctionPrice);
      return { command: resolved.command };
    }

    if (!state.aiSaleCommand) {
      throw new Error("No AI sale is ready to advance.");
    }

    return {
      command: state.aiSaleCommand,
    };
  }

  throw new Error(`Unknown mock draft action "${action}".`);
};
