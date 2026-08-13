import {
  keepers as defaultKeepers,
  type KeeperDeclaration,
  type KeeperStatus,
} from "../../config/keepers.js";
import { leagueConfig, ownerOrder, type Owner, type Position } from "../../config/league.js";
import { nflTeamByEspnProTeamId } from "../../config/nflTeams.js";
import type { DraftRoomRanking } from "../data/draftRoomRankings.js";
import { cleanPlayerName, normalizePlayerName } from "../data/normalizePlayerName.js";
import type { HistoricalAuctionRecord } from "../data/parseHistoricalBoards.js";
import type { ProjectionRecord } from "../projections.js";
import type { Player } from "../types.js";
import {
  buildInitialRostersFromKeepers,
  type InitialRostersByOwner,
} from "./auctionEngine.js";
import {
  buildBasePrices,
  defaultPricingConfig,
  type BasePrice,
  type PricingConfig,
} from "./basePricing.js";
import {
  applyKeeperScenarioToPrices,
  buildKeeperScenarios,
  type KeeperScenario,
  type KeeperScenarioKey,
  type ScenarioAdjustedPrice,
} from "./keeperInflation.js";
import { buildProjectionRankings, type ProjectionRanking } from "./projectionRankings.js";
import {
  defaultLiveDraftStrategyKey,
  liveDraftStrategies,
  liveDraftStrategyFor,
  type LiveDraftStrategyDefinition,
  type LiveDraftStrategyKey,
} from "./liveDraftStrategies.js";
import { threeRbPathRules } from "./draftPlan.js";

export type LiveDraftPlayerSource = "pricedPool" | "projectionFallback";

export interface ParsedLiveDraftSaleCommand {
  ownerText: string;
  playerText: string;
  price: number;
}

export interface LiveDraftEvent {
  input: string;
  owner: Owner;
  player: string;
  normalizedPlayerName: string;
  position: Position;
  price: number;
  expectedPrice: number;
  saleVsExpected: number;
  playerSource: LiveDraftPlayerSource;
}

export interface LiveDraftSaleMockRange {
  draftedRate: number;
  averageSalePrice: number;
  minimumSalePrice: number;
  maximumSalePrice: number;
}

export type LiveDraftSaleAuditVerdict = "deal" | "fair" | "overpay";

export interface LiveDraftSaleAudit {
  input: string;
  owner: Owner;
  player: string;
  normalizedPlayerName: string;
  position: Position;
  price: number;
  expectedPrice: number;
  liveExpectedPrice: number;
  personalValue: number;
  expectedDelta: number;
  liveDelta: number;
  personalDelta: number;
  verdict: LiveDraftSaleAuditVerdict;
  mockRange?: LiveDraftSaleMockRange;
}

export interface LiveDraftCommandError {
  input: string;
  message: string;
}

export interface LiveDraftRosterPlayer {
  name: string;
  position: Position;
  price: number;
  expectedPrice: number;
  source: "keeper" | LiveDraftPlayerSource;
  teamAbbreviation?: string;
  byeWeek?: number;
}

export type LiveDraftRosterSlotKey =
  | "QB"
  | "RB1"
  | "RB2"
  | "WR1"
  | "WR2"
  | "TE"
  | "FLEX"
  | "K"
  | "DST"
  | "BENCH1"
  | "BENCH2"
  | "BENCH3"
  | "BENCH4"
  | "BENCH5"
  | "BENCH6"
  | "BENCH7";

export interface LiveDraftRosterSlot {
  slot: LiveDraftRosterSlotKey;
  player?: LiveDraftRosterPlayer;
}

export interface LiveDraftOwnerState {
  owner: Owner;
  roster: LiveDraftRosterPlayer[];
  slots: LiveDraftRosterSlot[];
  spent: number;
  budgetRemaining: number;
  rosterSlotsRemaining: number;
  maxBid: number;
  positionCounts: Record<Position, number>;
}

export interface LiveDraftRoomState {
  scenarioKey: KeeperScenarioKey;
  totalBudget: number;
  initialKeeperSpend: number;
  actualAuctionSpend: number;
  expectedAuctionSpend: number;
  saleVsExpected: number;
  remainingBudget: number;
  remainingRosterSlots: number;
  remainingExpectedSpend: number;
  liveInflationFactor: number;
}

export interface LiveDraftTarget {
  name: string;
  position: Position;
  teamAbbreviation?: string;
  byeWeek?: number;
  expectedPrice: number;
  liveExpectedPrice: number;
  personalValue: number;
  strategyValues: Record<LiveDraftStrategyKey, number>;
  recommendedMaxBid: number;
  valueScore: number;
  week1Projection: number;
  weeks1To4: number;
  seasonProjection: number;
  projectionRank?: number;
  espnRank?: number;
  draftRoomRank?: DraftRoomRanking;
  source: LiveDraftPlayerSource;
  tags: string[];
}

export interface LiveDraftKeeperTarget {
  name: string;
  position: Position;
  teamAbbreviation?: string;
  byeWeek?: number;
  keeperOwner: Owner;
  keeperCost: number;
  keeperStatus: KeeperStatus;
  draftable: false;
  expectedPrice: number;
  liveExpectedPrice: number;
  personalValue: number;
  recommendedMaxBid: number;
  valueScore: number;
  week1Projection: number;
  weeks1To4: number;
  seasonProjection: number;
  projectionRank?: number;
  espnRank?: number;
  draftRoomRank?: DraftRoomRanking;
  tags: string[];
}

export type LiveDraftPathBandStatus = "filled" | "next" | "open";

export interface LiveDraftPathPriceBand {
  slot: string;
  position: Position;
  minimumPrice: number;
  maximumPrice: number;
  status: LiveDraftPathBandStatus;
  note: string;
  filledBy?: string;
}

export interface LiveDraftPathTargetCluster {
  label: string;
  position: Position;
  targetNames: string[];
  priceBand: string;
  note: string;
}

export interface LiveDraftPathPivotRule {
  label: string;
  trigger: string;
  action: string;
}

export interface LiveDraftPathRiskAlert {
  label: string;
  status: LiveDraftReadinessStatus;
  detail: string;
}

export interface LiveDraftPathRecommendation {
  strategyKey: LiveDraftStrategyKey;
  label: string;
  summary: string;
  maxPriceBands: LiveDraftPathPriceBand[];
  targetClusters: LiveDraftPathTargetCluster[];
  pivotRules: LiveDraftPathPivotRule[];
  riskAlerts: LiveDraftPathRiskAlert[];
  deadZoneWarnings: string[];
}

export interface LiveDraftShortlistTarget {
  name: string;
  position: Position;
  teamAbbreviation?: string;
  byeWeek?: number;
  liveExpectedPrice: number;
  personalValue: number;
  recommendedMaxBid: number;
  valueGap: number;
  valueScore: number;
  reasons: string[];
}

export interface LiveDraftPositionContext {
  position: "RB" | "WR" | "TE";
  ownersNeeding: Owner[];
  blockers: Owner[];
  strongestBlockerMaxBid: number;
}

export type LiveDraftReadinessStatus = "pass" | "warn" | "fail";

export interface LiveDraftReadinessCheck {
  key: string;
  label: string;
  status: LiveDraftReadinessStatus;
  detail: string;
}

export interface LiveDraftReadiness {
  status: LiveDraftReadinessStatus;
  checks: LiveDraftReadinessCheck[];
}

export interface LiveDraftState {
  strategy: LiveDraftStrategyDefinition;
  scenario: KeeperScenario;
  room: LiveDraftRoomState;
  watchOwner: LiveDraftOwnerState;
  owners: LiveDraftOwnerState[];
  events: LiveDraftEvent[];
  errors: LiveDraftCommandError[];
  postDraftAudit: LiveDraftSaleAudit[];
  availableTargets: LiveDraftTarget[];
  keeperTargets: LiveDraftKeeperTarget[];
  draftPath: LiveDraftPathRecommendation;
  shortlist: LiveDraftShortlistTarget[];
  positionContexts: LiveDraftPositionContext[];
  readiness: LiveDraftReadiness;
}

export interface BuildLiveDraftStateOptions {
  projections: readonly ProjectionRecord[];
  historicalRecords: readonly HistoricalAuctionRecord[];
  keepers?: readonly KeeperDeclaration[];
  scenarioKey?: KeeperScenarioKey;
  strategyKey?: LiveDraftStrategyKey;
  watchOwner?: Owner;
  commands?: readonly string[];
  pricingConfig?: PricingConfig;
  targetLimit?: number;
  draftRoomRankings?: readonly DraftRoomRanking[];
}

interface LiveDraftPlayerRecord {
  name: string;
  normalizedName: string;
  position: Position;
  expectedPrice: number;
  week1: number;
  weeks1To4: number;
  seasonProjection: number;
  source: LiveDraftPlayerSource;
  teamAbbreviation?: string;
  byeWeek?: number;
  projectionRank?: number;
  espnRank?: number;
  draftRoomRank?: DraftRoomRanking;
}

interface ResolvedSale {
  owner: Owner;
  player: LiveDraftPlayerRecord;
  parsed: ParsedLiveDraftSaleCommand;
}

const defaultScenarioKey: KeeperScenarioKey = "expected";
const defaultWatchOwner: Owner = "Cam";
const defaultTargetLimit = 80;
const compactWordPattern = /[^a-z0-9]+/g;
const lineupSlotKeys = [
  "QB",
  "RB1",
  "RB2",
  "WR1",
  "WR2",
  "TE",
  "FLEX",
  "K",
  "DST",
  "BENCH1",
  "BENCH2",
  "BENCH3",
  "BENCH4",
  "BENCH5",
  "BENCH6",
  "BENCH7",
] as const satisfies readonly LiveDraftRosterSlotKey[];
const flexEligiblePositions = ["RB", "WR", "TE"] as const satisfies readonly Position[];

const emptyPositionCounts = (): Record<Position, number> => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const roundPrice = (value: number): number =>
  Math.max(1, Math.round(value));

const draftPriorityScoreFor = ({
  player,
  needMultiplier,
  liveExpectedPrice,
}: {
  player: LiveDraftPlayerRecord;
  needMultiplier: number;
  liveExpectedPrice: number;
}): number => {
  const seasonValueSignal = player.seasonProjection / 4;
  const pricePenalty = liveExpectedPrice * 0.35;

  return roundToTwo((seasonValueSignal * needMultiplier) - pricePenalty);
};

const teamMetadataFor = (
  proTeamId: number | undefined,
): { teamAbbreviation?: string; byeWeek?: number } => {
  const metadata = proTeamId === undefined ? undefined : nflTeamByEspnProTeamId[proTeamId];
  return metadata ? { teamAbbreviation: metadata.abbreviation, byeWeek: metadata.byeWeek } : {};
};

const searchKeyFor = (value: string): string =>
  normalizePlayerName(cleanPlayerName(value))
    .toLowerCase()
    .replace(compactWordPattern, " ")
    .trim();

const lastSearchToken = (value: string): string | undefined =>
  searchKeyFor(value).split(" ").filter(Boolean).at(-1);

const countPositions = (players: readonly LiveDraftRosterPlayer[]): Record<Position, number> => {
  const counts = emptyPositionCounts();
  for (const player of players) counts[player.position] += 1;
  return counts;
};

const maxBidFor = (budgetRemaining: number, rosterSlotsRemaining: number): number => {
  if (rosterSlotsRemaining <= 0) return 0;
  return Math.max(0, budgetRemaining - Math.max(0, rosterSlotsRemaining - 1));
};

export const parseLiveDraftSaleCommand = (input: string): ParsedLiveDraftSaleCommand => {
  const cleaned = input.trim().replace(/\s+/g, " ");
  const salePattern = /^(.+?)\s+(?:drafted|bought|won|got|took)\s+(.+?)\s+(?:for|at|@)\s+\$?(\d+)$/i;
  const compactPattern = /^(\S+)\s+(.+?)\s+\$?(\d+)$/i;
  const match = cleaned.match(salePattern) ?? cleaned.match(compactPattern);

  if (!match) {
    throw new Error(`Could not parse live draft sale command: "${input}".`);
  }

  const [, ownerText = "", playerText = "", priceText = ""] = match;
  const price = Number(priceText);
  if (!Number.isInteger(price) || price <= 0) {
    throw new Error(`Sale price must be a positive whole dollar amount: "${input}".`);
  }

  return {
    ownerText,
    playerText: cleanPlayerName(playerText),
    price,
  };
};

const ownerForText = (ownerText: string): Owner => {
  const key = ownerText.toLowerCase();
  const owner = ownerOrder.find(candidate => candidate.toLowerCase() === key);
  if (!owner) throw new Error(`Unknown owner "${ownerText}". Use one of: ${ownerOrder.join(", ")}.`);
  return owner;
};

const projectionPriceFor = (projection: ProjectionRanking, scenario: KeeperScenario): number => {
  const publicAnchor = projection.espnAuctionValue ?? 0;
  const scenarioFactor = scenario.positionFactors[projection.position];
  return roundPrice(Math.max(publicAnchor, 1) * scenarioFactor);
};

const liveRecordFromPrice = (price: ScenarioAdjustedPrice): LiveDraftPlayerRecord => ({
  name: price.name,
  normalizedName: price.normalizedName,
  position: price.position,
  expectedPrice: price.scenarioPrice,
  week1: price.weeks[1] ?? 0,
  weeks1To4: price.weeks1To4,
  seasonProjection: price.seasonProjection ?? price.weeks1To4 * 4,
  source: "pricedPool",
  ...teamMetadataFor(price.proTeamId),
  projectionRank: price.projectionRank,
  ...(price.espnRank === undefined ? {} : { espnRank: price.espnRank }),
});

const liveRecordFromProjection = (
  projection: ProjectionRanking,
  scenario: KeeperScenario,
): LiveDraftPlayerRecord => ({
  name: projection.name,
  normalizedName: projection.normalizedName,
  position: projection.position,
  expectedPrice: projectionPriceFor(projection, scenario),
  week1: projection.weeks[1] ?? 0,
  weeks1To4: projection.weeks1To4,
  seasonProjection: projection.seasonProjection ?? projection.weeks1To4 * 4,
  source: "projectionFallback",
  ...teamMetadataFor(projection.proTeamId),
  projectionRank: projection.projectionRank,
  ...(projection.espnRank === undefined ? {} : { espnRank: projection.espnRank }),
});

const keeperProjectionFor = ({
  keeper,
  prices,
  projections,
}: {
  keeper: KeeperDeclaration;
  prices: readonly BasePrice[];
  projections: ReadonlyMap<string, ProjectionRanking>;
}): BasePrice | ProjectionRanking | undefined => {
  const normalizedName = normalizePlayerName(keeper.player);
  return prices.find(price => price.normalizedName === normalizedName) ?? projections.get(normalizedName);
};

const keeperTargetFromDeclaration = ({
  keeper,
  projection,
  scenario,
}: {
  keeper: KeeperDeclaration;
  projection: BasePrice | ProjectionRanking | undefined;
  scenario: KeeperScenario;
}): LiveDraftKeeperTarget => {
  const expectedPrice = projection
    ? "price" in projection
      ? roundPrice(projection.price * scenario.positionFactors[keeper.position])
      : projectionPriceFor(projection, scenario)
    : keeper.newCost;
  const week1 = projection?.weeks[1] ?? 0;
  const weeks1To4 = projection?.weeks1To4 ?? 0;
  const seasonProjection = projection?.seasonProjection ?? weeks1To4 * 4;
  const metadata = teamMetadataFor(projection?.proTeamId);

  return {
    name: projection?.name ?? keeper.player,
    position: keeper.position,
    ...metadata,
    keeperOwner: keeper.owner,
    keeperCost: keeper.newCost,
    keeperStatus: keeper.status,
    draftable: false,
    expectedPrice,
    liveExpectedPrice: expectedPrice,
    personalValue: keeper.newCost,
    recommendedMaxBid: 0,
    valueScore: 0,
    week1Projection: roundToTwo(week1),
    weeks1To4: roundToTwo(weeks1To4),
    seasonProjection: roundToTwo(seasonProjection),
    ...(projection?.projectionRank === undefined ? {} : { projectionRank: projection.projectionRank }),
    ...(projection?.espnRank === undefined ? {} : { espnRank: projection.espnRank }),
    tags: [`keeper - ${keeper.owner}`, `${keeper.status} keeper`],
  };
};

const buildKeeperTargets = ({
  keepers,
  prices,
  projections,
  scenario,
}: {
  keepers: readonly KeeperDeclaration[];
  prices: readonly BasePrice[];
  projections: readonly ProjectionRecord[];
  scenario: KeeperScenario;
}): LiveDraftKeeperTarget[] => {
  const rankingsByName = new Map(
    buildProjectionRankings(projections).map(projection => [projection.normalizedName, projection]),
  );

  return keepers
    .map(keeper => keeperTargetFromDeclaration({
      keeper,
      projection: keeperProjectionFor({ keeper, prices, projections: rankingsByName }),
      scenario,
    }))
    .sort((left, right) =>
      ownerOrder.indexOf(left.keeperOwner) - ownerOrder.indexOf(right.keeperOwner) ||
      left.name.localeCompare(right.name),
    );
};

const buildLivePlayerUniverse = ({
  projections,
  prices,
  scenario,
  unavailableKeeperNames,
  draftRoomRankingsByName,
}: {
  projections: readonly ProjectionRecord[];
  prices: readonly ScenarioAdjustedPrice[];
  scenario: KeeperScenario;
  unavailableKeeperNames: ReadonlySet<string>;
  draftRoomRankingsByName: ReadonlyMap<string, DraftRoomRanking>;
}): LiveDraftPlayerRecord[] => {
  const recordsByName = new Map<string, LiveDraftPlayerRecord>();

  for (const price of prices) {
    const draftRoomRank = draftRoomRankingsByName.get(price.normalizedName);
    recordsByName.set(price.normalizedName, {
      ...liveRecordFromPrice(price),
      ...(draftRoomRank ? { draftRoomRank } : {}),
    });
  }

  for (const projection of buildProjectionRankings(projections)) {
    if (recordsByName.has(projection.normalizedName)) continue;
    if (unavailableKeeperNames.has(projection.normalizedName)) continue;
    const draftRoomRank = draftRoomRankingsByName.get(projection.normalizedName);
    recordsByName.set(projection.normalizedName, {
      ...liveRecordFromProjection(projection, scenario),
      ...(draftRoomRank ? { draftRoomRank } : {}),
    });
  }

  return [...recordsByName.values()];
};

const playerMatchScore = (record: LiveDraftPlayerRecord, playerText: string): number => {
  const query = searchKeyFor(playerText);
  const name = searchKeyFor(record.name);
  const lastToken = lastSearchToken(record.name);
  const tokens = name.split(" ");

  if (!query) return 0;
  if (name === query) return 100;
  if (lastToken === query) return 90;
  if (tokens.some(token => token === query)) return 80;
  if (name.includes(query)) return 60;
  return 0;
};

const resolvePlayer = (
  playerText: string,
  records: readonly LiveDraftPlayerRecord[],
): LiveDraftPlayerRecord => {
  const query = searchKeyFor(playerText);
  const matches = records
    .map(record => ({ record, score: playerMatchScore(record, playerText) }))
    .filter(match => match.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.record.expectedPrice - left.record.expectedPrice ||
        right.record.weeks1To4 - left.record.weeks1To4 ||
        left.record.name.localeCompare(right.record.name),
    );
  const best = matches[0];

  if (!best) throw new Error(`Unknown player "${playerText}".`);

  const tiedMatches = matches.filter(match => match.score === best.score);
  const closeSingleTokenMatches = query.split(" ").length === 1
    ? matches.filter(match => match.score >= 80 && best.score - match.score <= 10)
    : [];
  const ambiguousMatches = tiedMatches.length > 1 ? tiedMatches : closeSingleTokenMatches;

  if (ambiguousMatches.length > 1) {
    throw new Error(
      `Ambiguous player "${playerText}". Matches: ${ambiguousMatches.slice(0, 6).map(match => match.record.name).join(", ")}.`,
    );
  }

  return best.record;
};

const resolveSale = (
  input: string,
  records: readonly LiveDraftPlayerRecord[],
): ResolvedSale => {
  const parsed = parseLiveDraftSaleCommand(input);
  return {
    parsed,
    owner: ownerForText(parsed.ownerText),
    player: resolvePlayer(parsed.playerText, records),
  };
};

const playerForRoster = (
  player: Player,
  source: LiveDraftRosterPlayer["source"],
  expectedPrice = player.price,
): LiveDraftRosterPlayer => ({
  name: player.name,
  position: player.position,
  price: player.price,
  expectedPrice,
  source,
  ...teamMetadataFor(player.proTeamId),
});

const livePlayerForRoster = (
  record: LiveDraftPlayerRecord,
  price: number,
): LiveDraftRosterPlayer => ({
  name: record.name,
  position: record.position,
  price,
  expectedPrice: record.expectedPrice,
  source: record.source,
  ...(record.teamAbbreviation === undefined ? {} : { teamAbbreviation: record.teamAbbreviation }),
  ...(record.byeWeek === undefined ? {} : { byeWeek: record.byeWeek }),
});

const rostersFromKeepers = (
  initialRostersByOwner: InitialRostersByOwner,
): Map<Owner, LiveDraftRosterPlayer[]> =>
  new Map(ownerOrder.map(owner => [
    owner,
    [...(initialRostersByOwner[owner] ?? [])].map(player => playerForRoster(player, "keeper")),
  ]));

const sortRosterPlayers = (players: readonly LiveDraftRosterPlayer[]): LiveDraftRosterPlayer[] =>
  [...players].sort(
    (left, right) =>
      right.price - left.price ||
      right.expectedPrice - left.expectedPrice ||
      left.name.localeCompare(right.name),
  );

const emptyRosterSlots = (): LiveDraftRosterSlot[] =>
  lineupSlotKeys.map(slot => ({ slot }));

const slotIndexByKey = (slots: readonly LiveDraftRosterSlot[]): Map<LiveDraftRosterSlotKey, number> =>
  new Map(slots.map((slot, index) => [slot.slot, index]));

const placeInSlot = (
  slots: LiveDraftRosterSlot[],
  indexes: ReadonlyMap<LiveDraftRosterSlotKey, number>,
  slot: LiveDraftRosterSlotKey,
  player: LiveDraftRosterPlayer | undefined,
): void => {
  if (!player) return;

  const index = indexes.get(slot);
  if (index === undefined) return;
  slots[index] = { slot, player };
};

const firstEmptyBenchSlot = (slots: readonly LiveDraftRosterSlot[]): LiveDraftRosterSlotKey | undefined =>
  slots.find(slot => slot.slot.startsWith("BENCH") && !slot.player)?.slot;

const isFlexEligible = (position: Position): boolean =>
  flexEligiblePositions.some(flexPosition => flexPosition === position);

const rosterSlotsFor = (roster: readonly LiveDraftRosterPlayer[]): LiveDraftRosterSlot[] => {
  const slots = emptyRosterSlots();
  const indexes = slotIndexByKey(slots);
  const usedPlayers = new Set<LiveDraftRosterPlayer>();
  const sortedByPosition = (position: Position): LiveDraftRosterPlayer[] =>
    sortRosterPlayers(roster.filter(player => player.position === position));

  const qbs = sortedByPosition("QB");
  const rbs = sortedByPosition("RB");
  const wrs = sortedByPosition("WR");
  const tes = sortedByPosition("TE");
  const kickers = sortedByPosition("K");
  const defenses = sortedByPosition("DST");
  const primaryAssignments: [LiveDraftRosterSlotKey, LiveDraftRosterPlayer | undefined][] = [
    ["QB", qbs[0]],
    ["RB1", rbs[0]],
    ["RB2", rbs[1]],
    ["WR1", wrs[0]],
    ["WR2", wrs[1]],
    ["TE", tes[0]],
    ["K", kickers[0]],
    ["DST", defenses[0]],
  ];

  for (const [slot, player] of primaryAssignments) {
    placeInSlot(slots, indexes, slot, player);
    if (player) usedPlayers.add(player);
  }

  const flex = sortRosterPlayers(
    roster.filter(player => isFlexEligible(player.position) && !usedPlayers.has(player)),
  )[0];
  placeInSlot(slots, indexes, "FLEX", flex);
  if (flex) usedPlayers.add(flex);

  for (const player of sortRosterPlayers(roster.filter(candidate => !usedPlayers.has(candidate)))) {
    const benchSlot = firstEmptyBenchSlot(slots);
    if (!benchSlot) break;
    placeInSlot(slots, indexes, benchSlot, player);
  }

  return slots;
};

const ownerStateFor = (
  owner: Owner,
  roster: readonly LiveDraftRosterPlayer[],
): LiveDraftOwnerState => {
  const spent = roster.reduce((total, player) => total + player.price, 0);
  const rosterSlotsRemaining = leagueConfig.rosterSize - roster.length;
  const budgetRemaining = leagueConfig.auctionBudget - spent;

  return {
    owner,
    roster: [...roster],
    slots: rosterSlotsFor(roster),
    spent,
    budgetRemaining,
    rosterSlotsRemaining,
    maxBid: maxBidFor(budgetRemaining, rosterSlotsRemaining),
    positionCounts: countPositions(roster),
  };
};

const validateSaleFitsOwner = (
  sale: ResolvedSale,
  ownerState: LiveDraftOwnerState,
): void => {
  if (ownerState.rosterSlotsRemaining <= 0) {
    throw new Error(`${sale.owner} has no open roster slots.`);
  }

  if (sale.parsed.price > ownerState.maxBid) {
    throw new Error(`${sale.owner} can only bid up to $${ownerState.maxBid}.`);
  }

  const positionMaximum = leagueConfig.rosterMaximums[sale.player.position];
  if (ownerState.positionCounts[sale.player.position] >= positionMaximum) {
    throw new Error(`${sale.owner} cannot buy ${sale.player.name}: roster limit is ${positionMaximum} ${sale.player.position}s.`);
  }
};

const buildOwnerStates = (
  rostersByOwner: ReadonlyMap<Owner, readonly LiveDraftRosterPlayer[]>,
): LiveDraftOwnerState[] =>
  ownerOrder.map(owner => ownerStateFor(owner, rostersByOwner.get(owner) ?? []));

const totalKeeperSpend = (rostersByOwner: ReadonlyMap<Owner, readonly LiveDraftRosterPlayer[]>): number =>
  [...rostersByOwner.values()].reduce(
    (total, roster) => total + roster
      .filter(player => player.source === "keeper")
      .reduce((rosterTotal, player) => rosterTotal + player.price, 0),
    0,
  );

const draftableExpectedSpend = (
  records: readonly LiveDraftPlayerRecord[],
  soldNames: ReadonlySet<string>,
  remainingRosterSlots: number,
): number =>
  records
    .filter(record => !soldNames.has(record.normalizedName))
    .sort(
      (left, right) =>
        right.expectedPrice - left.expectedPrice ||
        right.weeks1To4 - left.weeks1To4 ||
        left.name.localeCompare(right.name),
    )
    .slice(0, remainingRosterSlots)
    .reduce((total, player) => total + player.expectedPrice, 0);

const rawLiveInflationFactorFor = ({
  remainingBudget,
  remainingExpectedSpend,
  remainingRosterSlots,
}: Pick<LiveDraftRoomState, "remainingBudget" | "remainingExpectedSpend" | "remainingRosterSlots">): number => {
  if (remainingRosterSlots <= 0) return 0;
  return remainingBudget / Math.max(remainingRosterSlots, remainingExpectedSpend);
};

const buildRoomState = ({
  scenario,
  owners,
  events,
  records,
  soldNames,
  initialKeeperSpend,
  startingLiveInflationFactor,
}: {
  scenario: KeeperScenario;
  owners: readonly LiveDraftOwnerState[];
  events: readonly LiveDraftEvent[];
  records: readonly LiveDraftPlayerRecord[];
  soldNames: ReadonlySet<string>;
  initialKeeperSpend: number;
  startingLiveInflationFactor: number;
}): LiveDraftRoomState => {
  const actualAuctionSpend = events.reduce((total, event) => total + event.price, 0);
  const expectedAuctionSpend = events.reduce((total, event) => total + event.expectedPrice, 0);
  const remainingBudget = owners.reduce((total, owner) => total + owner.budgetRemaining, 0);
  const remainingRosterSlots = owners.reduce((total, owner) => total + owner.rosterSlotsRemaining, 0);
  const remainingExpectedSpend = draftableExpectedSpend(records, soldNames, remainingRosterSlots);
  const rawLiveInflationFactor = rawLiveInflationFactorFor({
    remainingBudget,
    remainingExpectedSpend,
    remainingRosterSlots,
  });

  return {
    scenarioKey: scenario.key,
    totalBudget: leagueConfig.teams * leagueConfig.auctionBudget,
    initialKeeperSpend,
    actualAuctionSpend,
    expectedAuctionSpend,
    saleVsExpected: actualAuctionSpend - expectedAuctionSpend,
    remainingBudget,
    remainingRosterSlots,
    remainingExpectedSpend,
    liveInflationFactor: roundToTwo(rawLiveInflationFactor / Math.max(0.01, startingLiveInflationFactor)),
  };
};

const targetTagsFor = (
  player: LiveDraftPlayerRecord,
  watchOwner: LiveDraftOwnerState,
  strategy: LiveDraftStrategyDefinition,
): string[] => {
  const tags: string[] = [];
  const counts = watchOwner.positionCounts;

  if (watchOwner.rosterSlotsRemaining <= 0) tags.push("roster full");
  if (counts[player.position] >= leagueConfig.rosterMaximums[player.position]) tags.push("roster max");
  if (counts[player.position] < leagueConfig.lineup[player.position]) tags.push("starter need");
  const anchorTarget = strategy.anchorTargets?.[player.position] ?? 0;
  const strategyTag = strategy.tags[player.position];
  if (strategyTag && anchorTarget > 0 && counts[player.position] < anchorTarget) tags.push(strategyTag);
  if ((player.position === "WR" || player.position === "TE") && counts.RB + counts.WR + counts.TE < 5) {
    tags.push("flex need");
  }
  if (player.source === "projectionFallback") tags.push("projection fallback");
  if (player.expectedPrice > watchOwner.maxBid) tags.push("not affordable");

  return tags;
};

const positionNeedMultiplierFor = (
  player: LiveDraftPlayerRecord,
  watchOwner: LiveDraftOwnerState,
  strategy: LiveDraftStrategyDefinition,
): number => {
  const counts = watchOwner.positionCounts;
  let multiplier = 1;

  if (counts[player.position] < leagueConfig.lineup[player.position]) {
    multiplier += strategy.needMultiplier[player.position] ?? 0;
  }
  const anchorTarget = strategy.anchorTargets?.[player.position] ?? 0;
  if (anchorTarget > 0 && counts[player.position] < anchorTarget) {
    multiplier += Math.max(0, (strategy.needMultiplier[player.position] ?? 0) * 0.65);
  }
  if (
    (player.position === "RB" || player.position === "WR" || player.position === "TE") &&
    counts.RB + counts.WR + counts.TE < 5
  ) {
    multiplier += Math.max(0, strategy.needMultiplier[player.position] ?? 0) * 0.35;
  }
  if (player.position === "K" || player.position === "DST") multiplier += strategy.needMultiplier[player.position] ?? -0.4;

  return multiplier;
};

const personalPremiumFor = (
  player: LiveDraftPlayerRecord,
  watchOwner: LiveDraftOwnerState,
  strategy: LiveDraftStrategyDefinition,
): number => {
  const counts = watchOwner.positionCounts;
  let premium = 0;

  if (counts[player.position] < leagueConfig.lineup[player.position]) {
    premium += strategy.starterPremium[player.position] ?? 0;
  }
  const anchorTarget = strategy.anchorTargets?.[player.position] ?? 0;
  if (anchorTarget > 0 && counts[player.position] < anchorTarget) {
    premium += strategy.depthPremium[player.position] ?? 0;
  }
  if (
    (player.position === "RB" || player.position === "WR" || player.position === "TE") &&
    counts.RB + counts.WR + counts.TE < 5
  ) {
    premium += Math.max(0, strategy.depthPremium[player.position] ?? 0);
  }
  if (player.position === "K" || player.position === "DST") premium += strategy.starterPremium[player.position] ?? -1;

  return premium;
};

const personalValueForStrategy = ({
  player,
  watchOwner,
  liveExpectedPrice,
  strategy,
  pricingConfig,
}: {
  player: LiveDraftPlayerRecord;
  watchOwner: LiveDraftOwnerState;
  liveExpectedPrice: number;
  strategy: LiveDraftStrategyDefinition;
  pricingConfig: PricingConfig;
}): number => {
  const positionCeiling = pricingConfig.hardPriceCeilings[player.position];
  const uncappedPersonalValue = roundPrice(
    liveExpectedPrice + personalPremiumFor(player, watchOwner, strategy),
  );

  return Math.min(
    watchOwner.maxBid,
    positionCeiling,
    player.expectedPrice + 12,
    Math.max(1, uncappedPersonalValue),
  );
};

const saleAuditVerdictFor = ({
  price,
  expectedPrice,
  liveExpectedPrice,
  personalValue,
}: {
  price: number;
  expectedPrice: number;
  liveExpectedPrice: number;
  personalValue: number;
}): LiveDraftSaleAuditVerdict => {
  const benchmarks = [
    expectedPrice,
    liveExpectedPrice,
    ...(personalValue > 0 ? [personalValue] : []),
  ];
  const lowestBenchmark = Math.min(...benchmarks);
  const highestBenchmark = Math.max(...benchmarks);

  if (price <= lowestBenchmark - 3) return "deal";
  if (price >= highestBenchmark + 6) return "overpay";
  return "fair";
};

const saleAuditFor = ({
  input,
  sale,
  liveExpectedPrice,
  personalValue,
}: {
  input: string;
  sale: ResolvedSale;
  liveExpectedPrice: number;
  personalValue: number;
}): LiveDraftSaleAudit => {
  const price = sale.parsed.price;

  return {
    input,
    owner: sale.owner,
    player: sale.player.name,
    normalizedPlayerName: sale.player.normalizedName,
    position: sale.player.position,
    price,
    expectedPrice: sale.player.expectedPrice,
    liveExpectedPrice,
    personalValue,
    expectedDelta: price - sale.player.expectedPrice,
    liveDelta: price - liveExpectedPrice,
    personalDelta: price - personalValue,
    verdict: saleAuditVerdictFor({
      price,
      expectedPrice: sale.player.expectedPrice,
      liveExpectedPrice,
      personalValue,
    }),
  };
};

const priceBandText = ({
  minimumPrice,
  maximumPrice,
}: Pick<LiveDraftPathPriceBand, "minimumPrice" | "maximumPrice">): string =>
  `$${minimumPrice}-$${maximumPrice}`;

const slotMaxBidsFor = (
  strategy: LiveDraftStrategyDefinition,
  position: Position,
): readonly number[] | undefined => {
  if (strategy.key === "three-rb") {
    const slotMaxBids: Partial<Record<Position, readonly number[]>> = threeRbPathRules.slotMaxBids;
    return slotMaxBids[position];
  }
  return undefined;
};

const ownerPositionSpend = (
  owner: LiveDraftOwnerState,
  position: Position,
): number =>
  owner.roster
    .filter(player => player.position === position)
    .reduce((total, player) => total + player.price, 0);

const coreBudgetPathMaxBidFor = (
  strategy: LiveDraftStrategyDefinition,
  position: Position,
  watchOwner: LiveDraftOwnerState,
): number | undefined => {
  if (strategy.key !== "three-rb" || position !== "RB") return undefined;

  const coreBudget = threeRbPathRules.rbCoreBudget;
  const positionCount = watchOwner.positionCounts[position];
  if (positionCount >= coreBudget.targetCount) return undefined;

  const futureCoreSlots = Math.max(0, coreBudget.targetCount - positionCount - 1);
  return Math.floor(
    coreBudget.hardBudget -
      ownerPositionSpend(watchOwner, position) -
      futureCoreSlots * coreBudget.minimumFutureCorePrice,
  );
};

const strategyPathMaxBidFor = (
  player: LiveDraftPlayerRecord,
  watchOwner: LiveDraftOwnerState,
  strategy: LiveDraftStrategyDefinition,
): number | undefined => {
  const slotMaxBids = slotMaxBidsFor(strategy, player.position);
  const slotMaxBid = slotMaxBids?.[watchOwner.positionCounts[player.position]];
  const coreBudgetMaxBid = coreBudgetPathMaxBidFor(strategy, player.position, watchOwner);
  const maxBids = [slotMaxBid, coreBudgetMaxBid]
    .filter((value): value is number => value !== undefined);
  if (maxBids.length === 0) return undefined;
  return Math.min(watchOwner.maxBid, Math.max(1, Math.min(...maxBids)));
};

const canWatchOwnerRosterPlayer = (
  player: LiveDraftPlayerRecord,
  watchOwner: LiveDraftOwnerState,
): boolean =>
  watchOwner.rosterSlotsRemaining > 0 &&
  watchOwner.positionCounts[player.position] < leagueConfig.rosterMaximums[player.position];

const liveExpectedPriceFor = (
  player: LiveDraftPlayerRecord,
  room: LiveDraftRoomState,
): number =>
  room.remainingRosterSlots <= 0
    ? 0
    : roundPrice(player.expectedPrice * room.liveInflationFactor);

const buildTargets = ({
  records,
  soldNames,
  watchOwner,
  room,
  targetLimit,
  strategy,
  pricingConfig,
}: {
  records: readonly LiveDraftPlayerRecord[];
  soldNames: ReadonlySet<string>;
  watchOwner: LiveDraftOwnerState;
  room: LiveDraftRoomState;
  targetLimit: number;
  strategy: LiveDraftStrategyDefinition;
  pricingConfig: PricingConfig;
}): LiveDraftTarget[] =>
  records
    .filter(player => !soldNames.has(player.normalizedName))
    .map(player => {
      const fitsWatchOwnerRoster = canWatchOwnerRosterPlayer(player, watchOwner);
      const liveExpectedPrice = liveExpectedPriceFor(player, room);
      const needMultiplier = positionNeedMultiplierFor(player, watchOwner, strategy);
      const rawStrategyValues = Object.fromEntries(
        Object.values(liveDraftStrategies).map(candidateStrategy => [
          candidateStrategy.key,
          fitsWatchOwnerRoster
            ? personalValueForStrategy({
              player,
              watchOwner,
              liveExpectedPrice,
              strategy: candidateStrategy,
              pricingConfig,
            })
            : 0,
        ]),
      ) as Record<LiveDraftStrategyKey, number>;
      const strategyPathMaxBid = strategyPathMaxBidFor(player, watchOwner, strategy);
      const uncappedPersonalValue = rawStrategyValues[strategy.key];
      const personalValue = fitsWatchOwnerRoster
        ? uncappedPersonalValue
        : 0;
      const recommendedMaxBid = fitsWatchOwnerRoster
        ? Math.min(personalValue, strategyPathMaxBid ?? personalValue)
        : 0;
      const strategyValues = rawStrategyValues;
      const valueScore = draftPriorityScoreFor({
        player,
        needMultiplier,
        liveExpectedPrice,
      });
      const tags = targetTagsFor(player, watchOwner, strategy);
      if (strategyPathMaxBid !== undefined && strategyPathMaxBid < personalValue) {
        tags.push(`path max $${strategyPathMaxBid}`);
      }

      return {
        name: player.name,
        position: player.position,
        ...(player.teamAbbreviation === undefined ? {} : { teamAbbreviation: player.teamAbbreviation }),
        ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
        expectedPrice: player.expectedPrice,
        liveExpectedPrice,
        personalValue,
        strategyValues,
        recommendedMaxBid,
        valueScore,
        week1Projection: roundToTwo(player.week1),
        weeks1To4: roundToTwo(player.weeks1To4),
        seasonProjection: roundToTwo(player.seasonProjection),
        ...(player.projectionRank === undefined ? {} : { projectionRank: player.projectionRank }),
        ...(player.espnRank === undefined ? {} : { espnRank: player.espnRank }),
        ...(player.draftRoomRank === undefined ? {} : { draftRoomRank: player.draftRoomRank }),
        source: player.source,
        tags,
      };
    })
    .sort(
      (left, right) =>
        Number(!right.tags.includes("not affordable")) - Number(!left.tags.includes("not affordable")) ||
        right.liveExpectedPrice - left.liveExpectedPrice ||
        right.seasonProjection - left.seasonProjection ||
        right.expectedPrice - left.expectedPrice ||
        left.name.localeCompare(right.name),
    )
    .slice(0, targetLimit);

const shortlistReasonsFor = (target: LiveDraftTarget): string[] => {
  const reasons: string[] = [];
  const valueGap = target.personalValue - target.liveExpectedPrice;

  if (valueGap >= 6) reasons.push(`value +$${Math.round(valueGap)}`);
  for (const tag of target.tags) {
    if (tag === "starter need" || tag === "3RB core" || tag === "flex need") reasons.push(tag);
  }
  if (target.liveExpectedPrice >= 40 && !target.tags.includes("not affordable")) reasons.push("premium target");

  return [...new Set(reasons)];
};

const buildShortlist = (targets: readonly LiveDraftTarget[]): LiveDraftShortlistTarget[] =>
  [...targets]
    .filter(target => !target.tags.includes("not affordable"))
    .filter(target => shortlistReasonsFor(target).length > 0)
    .sort(
      (left, right) =>
        right.valueScore - left.valueScore ||
        right.liveExpectedPrice - left.liveExpectedPrice ||
        right.seasonProjection - left.seasonProjection ||
        left.name.localeCompare(right.name),
    )
    .slice(0, 10)
    .map(target => ({
      name: target.name,
      position: target.position,
      ...(target.teamAbbreviation === undefined ? {} : { teamAbbreviation: target.teamAbbreviation }),
      ...(target.byeWeek === undefined ? {} : { byeWeek: target.byeWeek }),
      liveExpectedPrice: target.liveExpectedPrice,
      personalValue: target.personalValue,
      recommendedMaxBid: target.recommendedMaxBid,
      valueGap: target.personalValue - target.liveExpectedPrice,
      valueScore: target.valueScore,
      reasons: shortlistReasonsFor(target),
    }));

const skillStarterSlots =
  leagueConfig.lineup.RB + leagueConfig.lineup.WR + leagueConfig.lineup.TE + leagueConfig.lineup.FLEX;

const ownerNeedsSkillPosition = (
  owner: LiveDraftOwnerState,
  position: LiveDraftPositionContext["position"],
): boolean => {
  if (owner.rosterSlotsRemaining <= 0) return false;
  if (owner.positionCounts[position] >= leagueConfig.rosterMaximums[position]) return false;
  if (owner.positionCounts[position] < leagueConfig.lineup[position]) return true;

  const skillCount = owner.positionCounts.RB + owner.positionCounts.WR + owner.positionCounts.TE;
  return skillCount < skillStarterSlots;
};

const buildPositionContexts = (
  owners: readonly LiveDraftOwnerState[],
  watchOwner: LiveDraftOwnerState,
): LiveDraftPositionContext[] =>
  (["RB", "WR", "TE"] as const).map(position => {
    const ownersNeeding = owners
      .filter(owner => ownerNeedsSkillPosition(owner, position))
      .map(owner => owner.owner);
    const blockingMaxBidThreshold = Math.min(watchOwner.maxBid, 60);
    const blockers = owners
      .filter(owner => owner.owner !== watchOwner.owner)
      .filter(owner => ownerNeedsSkillPosition(owner, position))
      .filter(owner => owner.maxBid >= blockingMaxBidThreshold)
      .map(owner => owner.owner);
    const strongestBlockerMaxBid = owners
      .filter(owner => blockers.includes(owner.owner))
      .reduce((maxBid, owner) => Math.max(maxBid, owner.maxBid), 0);

    return {
      position,
      ownersNeeding,
      blockers,
      strongestBlockerMaxBid,
    };
  });

const filledPlayersFor = (
  owner: LiveDraftOwnerState,
  position: Position,
): LiveDraftRosterPlayer[] =>
  owner.roster
    .filter(player => player.position === position)
    .sort(
      (left, right) =>
        right.price - left.price ||
        right.expectedPrice - left.expectedPrice ||
        left.name.localeCompare(right.name),
    );

const pathBandStatusFor = (
  filledPlayer: LiveDraftRosterPlayer | undefined,
  index: number,
  watchOwner: LiveDraftOwnerState,
  position: Position,
): LiveDraftPathBandStatus => {
  if (filledPlayer) return "filled";
  if (index === watchOwner.positionCounts[position]) return "next";
  return "open";
};

const maxPriceBandsForThreeRb = (watchOwner: LiveDraftOwnerState): LiveDraftPathPriceBand[] => {
  const seenByPosition = new Map<Position, number>();
  const filledByPosition = new Map<Position, LiveDraftRosterPlayer[]>(
    (["QB", "RB", "WR", "TE", "K", "DST"] as const).map(position => [
      position,
      filledPlayersFor(watchOwner, position),
    ]),
  );

  return threeRbPathRules.priceBands.map(band => {
    const index = seenByPosition.get(band.position) ?? 0;
    seenByPosition.set(band.position, index + 1);
    const filledPlayer = filledByPosition.get(band.position)?.[index];
    const status = pathBandStatusFor(filledPlayer, index, watchOwner, band.position);
    const remainingCoreSlotsAfterBand = Math.max(0, threeRbPathRules.rbCoreBudget.targetCount - index - 1);
    const budgetAdjustedMaximumPrice = band.position === "RB" && !filledPlayer
      ? Math.min(
        band.maximumPrice,
        Math.max(
          band.minimumPrice,
          threeRbPathRules.rbCoreBudget.hardBudget -
            ownerPositionSpend(watchOwner, band.position) -
            remainingCoreSlotsAfterBand * threeRbPathRules.rbCoreBudget.minimumFutureCorePrice,
        ),
      )
      : band.maximumPrice;

    return {
      slot: band.slot,
      position: band.position,
      minimumPrice: band.minimumPrice,
      maximumPrice: budgetAdjustedMaximumPrice,
      status,
      note: band.note,
      ...(filledPlayer ? { filledBy: filledPlayer.name } : {}),
    };
  });
};

const openStarterSlotsFor = (
  owner: LiveDraftOwnerState,
  slots: readonly LiveDraftRosterSlotKey[],
): number =>
  owner.slots.filter(slot => slots.includes(slot.slot) && !slot.player).length;

const riskStatusFor = (failed: boolean, warned: boolean): LiveDraftReadinessStatus => {
  if (failed) return "fail";
  if (warned) return "warn";
  return "pass";
};

const threeRbRiskAlertsFor = (
  watchOwner: LiveDraftOwnerState,
  maxPriceBands: readonly LiveDraftPathPriceBand[],
): LiveDraftPathRiskAlert[] => {
  const rbCoreSpend = ownerPositionSpend(watchOwner, "RB");
  const rbCoreFilled = Math.min(watchOwner.positionCounts.RB, threeRbPathRules.rbCoreBudget.targetCount);
  const openCoreRbSlots = Math.max(0, threeRbPathRules.rbCoreBudget.targetCount - rbCoreFilled);
  const rbBudgetRemaining = Math.max(0, threeRbPathRules.rbCoreBudget.hardBudget - rbCoreSpend);
  const futureRbReserve = openCoreRbSlots * threeRbPathRules.rbCoreBudget.minimumFutureCorePrice;
  const nextRbBand = maxPriceBands.find(band => band.position === "RB" && band.status === "next");
  const wrBands = maxPriceBands.filter(band => band.position === "WR");
  const openWrStarterSlots = openStarterSlotsFor(watchOwner, ["WR1", "WR2"]);
  const wrBandText = wrBands.map(priceBandText).join(" / ");
  const dollarSlotCount = Math.max(0, watchOwner.rosterSlotsRemaining - 4);

  return [
    {
      label: "RB budget remaining",
      status: riskStatusFor(
        openCoreRbSlots > 0 && rbBudgetRemaining < futureRbReserve,
        openCoreRbSlots > 0 && nextRbBand !== undefined && rbBudgetRemaining < nextRbBand.minimumPrice + futureRbReserve,
      ),
      detail: openCoreRbSlots > 0
        ? `${priceBandText({ minimumPrice: 0, maximumPrice: rbBudgetRemaining })} left for ${openCoreRbSlots} core RB slots; next RB lane is ${nextRbBand ? priceBandText(nextRbBand) : "unavailable"}.`
        : `Core RB slots are filled at $${rbCoreSpend}; stop buying meaningful RB depth unless value falls hard.`,
    },
    {
      label: "WR value pocket",
      status: riskStatusFor(false, openWrStarterSlots > 0 && watchOwner.budgetRemaining < 30),
      detail: openWrStarterSlots > 0
        ? `Keep WR starters in ${wrBandText || "$12-$26"} while the RB core is unfinished.`
        : "WR starters are filled; use the board for value depth only.",
    },
    {
      label: "Roster thinness",
      status: riskStatusFor(false, dollarSlotCount >= 9),
      detail: `${watchOwner.rosterSlotsRemaining} slots remain with max bid $${watchOwner.maxBid}; avoid turning too many bench spots into $1 fixes.`,
    },
  ];
};

const targetNamesFor = (
  targets: readonly LiveDraftTarget[],
  position: Position,
  limit: number,
): string[] =>
  targets
    .filter(target => target.position === position)
    .filter(target => target.recommendedMaxBid > 0)
    .slice(0, limit)
    .map(target => target.name);

const buildThreeRbDraftPath = (
  strategy: LiveDraftStrategyDefinition,
  watchOwner: LiveDraftOwnerState,
  availableTargets: readonly LiveDraftTarget[],
): LiveDraftPathRecommendation => {
  const maxPriceBands = maxPriceBandsForThreeRb(watchOwner);
  const rbBands = maxPriceBands.filter(band => band.position === "RB");
  const nextRbBand = rbBands.find(band => band.status === "next");
  const openRbCoreCount = Math.max(0, 3 - watchOwner.positionCounts.RB);
  const targetClusters: LiveDraftPathTargetCluster[] = [];

  if (nextRbBand) {
    targetClusters.push({
      label: "Target",
      position: "RB",
      targetNames: targetNamesFor(availableTargets, "RB", 5),
      priceBand: priceBandText(nextRbBand),
      note: `${nextRbBand.slot} is the next premium RB lane.`,
    });
  }

  const wrBands = maxPriceBands.filter(band => band.position === "WR");
  targetClusters.push({
    label: "Target",
    position: "WR",
    targetNames: targetNamesFor(availableTargets, "WR", 5),
    priceBand: wrBands.map(priceBandText).join(" / "),
    note: "WR values should fill starters after the RB core is protected.",
  });

  const teBand = maxPriceBands.find(band => band.position === "TE");
  if (teBand) {
    targetClusters.push({
      label: "Target",
      position: "TE",
      targetNames: targetNamesFor(availableTargets, "TE", 3),
      priceBand: priceBandText(teBand),
      note: "Cheap TE keeps the path from taxing RB and WR slots.",
    });
  }

  const deadZoneWarnings: string[] = [];
  if (openRbCoreCount > 0 && !targetNamesFor(availableTargets, "RB", 1).length) {
    deadZoneWarnings.push("Dead zone: no RB targets remain for the 3RB path.");
  }
  if (nextRbBand && watchOwner.maxBid < nextRbBand.minimumPrice) {
    deadZoneWarnings.push(`Dead zone: Cam max bid is below the ${nextRbBand.slot} ${priceBandText(nextRbBand)} lane.`);
  }

  return {
    strategyKey: strategy.key,
    label: strategy.label,
    summary: nextRbBand
      ? `3RB path: ${3 - openRbCoreCount}/3 core RBs filled. Next ${nextRbBand.slot} lane is ${priceBandText(nextRbBand)}.`
      : "3RB path: RB core filled. Shift attention to WR value and cheap TE.",
    maxPriceBands,
    targetClusters,
    pivotRules: threeRbPathRules.pivotRules.map(rule => ({
      label: "Pivot",
      trigger: rule.trigger,
      action: rule.action,
    })),
    riskAlerts: threeRbRiskAlertsFor(watchOwner, maxPriceBands),
    deadZoneWarnings,
  };
};

const buildDraftPath = (
  strategy: LiveDraftStrategyDefinition,
  watchOwner: LiveDraftOwnerState,
  availableTargets: readonly LiveDraftTarget[],
): LiveDraftPathRecommendation => {
  if (strategy.key === "three-rb") {
    return buildThreeRbDraftPath(strategy, watchOwner, availableTargets);
  }

  const focusPositions = (Object.keys(strategy.tags) as Position[])
    .filter(position => Boolean(strategy.tags[position]));
  return {
    strategyKey: strategy.key,
    label: strategy.label,
    summary: `${strategy.label} path: follow the live board tags and keep max bids under Cam's current room cap.`,
    maxPriceBands: [],
    targetClusters: focusPositions.map(position => ({
      label: "Target",
      position,
      targetNames: targetNamesFor(availableTargets, position, 5),
      priceBand: "Live value",
      note: `Current ${strategy.label} targets at ${position}.`,
    })),
    pivotRules: [{
      label: "Pivot",
      trigger: "Core strategy targets clear above Cam's max bid.",
      action: "Move to best value-score targets that still fill starter or flex needs.",
    }],
    riskAlerts: [],
    deadZoneWarnings: [],
  };
};

const readinessStatusFor = (checks: readonly LiveDraftReadinessCheck[]): LiveDraftReadinessStatus => {
  if (checks.some(check => check.status === "fail")) return "fail";
  if (checks.some(check => check.status === "warn")) return "warn";
  return "pass";
};

const keeperCoverageCheck = (keepers: readonly KeeperDeclaration[]): LiveDraftReadinessCheck => {
  const ownersWithKeeperDecisions = new Set(keepers.map(keeper => keeper.owner));
  const missingOwners = ownerOrder.filter(owner => !ownersWithKeeperDecisions.has(owner));

  return {
    key: "keeper-coverage",
    label: "Keeper coverage",
    status: missingOwners.length ? "warn" : "pass",
    detail: missingOwners.length
      ? `${ownersWithKeeperDecisions.size}/${ownerOrder.length} owners have keeper declarations. Missing: ${missingOwners.join(", ")}.`
      : `Keeper declarations cover all ${ownerOrder.length} owners.`,
  };
};

const buildReadiness = ({
  errors,
  availableTargets,
  owners,
  draftPath,
  keepers,
}: {
  errors: readonly LiveDraftCommandError[];
  availableTargets: readonly LiveDraftTarget[];
  owners: readonly LiveDraftOwnerState[];
  draftPath: LiveDraftPathRecommendation;
  keepers: readonly KeeperDeclaration[];
}): LiveDraftReadiness => {
  const checks: LiveDraftReadinessCheck[] = [
    {
      key: "engine-state",
      label: "Engine state",
      status: errors.length ? "warn" : "pass",
      detail: errors.length ? `${errors.length} command issue${errors.length === 1 ? "" : "s"} need review.` : "Commands replay cleanly.",
    },
    {
      key: "target-board",
      label: "Target board",
      status: availableTargets.length ? "pass" : "fail",
      detail: availableTargets.length ? `${availableTargets.length} draftable targets loaded.` : "No draftable targets are available.",
    },
    {
      key: "owner-rosters",
      label: "Owner rosters",
      status: owners.every(owner => owner.rosterSlotsRemaining >= 0 && owner.budgetRemaining >= 0) ? "pass" : "fail",
      detail: "Owner budgets, roster slots, and max bids are rebuilt from commands.",
    },
    keeperCoverageCheck(keepers),
    {
      key: "draft-path",
      label: "Draft path",
      status: draftPath.deadZoneWarnings.length ? "warn" : "pass",
      detail: draftPath.deadZoneWarnings[0] ?? draftPath.summary,
    },
  ];

  return {
    status: readinessStatusFor(checks),
    checks,
  };
};

export const buildLiveDraftState = ({
  projections,
  historicalRecords,
  keepers = defaultKeepers,
  scenarioKey = defaultScenarioKey,
  strategyKey = defaultLiveDraftStrategyKey,
  watchOwner = defaultWatchOwner,
  commands = [],
  pricingConfig = defaultPricingConfig,
  targetLimit = defaultTargetLimit,
  draftRoomRankings = [],
}: BuildLiveDraftStateOptions): LiveDraftState => {
  const prices = buildBasePrices(projections, historicalRecords, pricingConfig);
  const scenario = buildKeeperScenarios(keepers).find(candidate => candidate.key === scenarioKey);
  if (!scenario) throw new Error(`Unknown keeper scenario "${scenarioKey}".`);
  const strategy = liveDraftStrategyFor(strategyKey);

  const appliedScenario = applyKeeperScenarioToPrices(prices, scenario, keepers);
  const keeperTargets = buildKeeperTargets({
    keepers: appliedScenario.unavailableKeepers,
    prices,
    projections,
    scenario,
  });
  const unavailableKeeperNames = new Set(
    appliedScenario.unavailableKeepers.map(keeper => normalizePlayerName(keeper.player)),
  );
  const draftRoomRankingsByName = new Map(
    draftRoomRankings.map(ranking => [ranking.normalizedName, ranking]),
  );
  const records = buildLivePlayerUniverse({
    projections,
    prices: appliedScenario.availablePrices,
    scenario,
    unavailableKeeperNames,
    draftRoomRankingsByName,
  });
  const initialRostersByOwner = buildInitialRostersFromKeepers(
    keepers,
    projections,
    scenario.includedKeeperStatuses,
  );
  const rostersByOwner = rostersFromKeepers(initialRostersByOwner);
  const initialKeeperSpend = totalKeeperSpend(rostersByOwner);
  const soldNames = new Set(unavailableKeeperNames);
  const startingOwnerStates = buildOwnerStates(rostersByOwner);
  const startingRemainingBudget = startingOwnerStates.reduce((total, owner) => total + owner.budgetRemaining, 0);
  const startingRemainingRosterSlots = startingOwnerStates.reduce(
    (total, owner) => total + owner.rosterSlotsRemaining,
    0,
  );
  const startingLiveInflationFactor = rawLiveInflationFactorFor({
    remainingBudget: startingRemainingBudget,
    remainingExpectedSpend: draftableExpectedSpend(records, soldNames, startingRemainingRosterSlots),
    remainingRosterSlots: startingRemainingRosterSlots,
  });
  const events: LiveDraftEvent[] = [];
  const postDraftAudit: LiveDraftSaleAudit[] = [];
  const errors: LiveDraftCommandError[] = [];

  for (const input of commands) {
    try {
      const sale = resolveSale(input, records);
      if (soldNames.has(sale.player.normalizedName)) {
        throw new Error(`${sale.player.name} is already unavailable.`);
      }

      const roster = rostersByOwner.get(sale.owner) ?? [];
      validateSaleFitsOwner(sale, ownerStateFor(sale.owner, roster));
      const ownerStatesBeforeSale = buildOwnerStates(rostersByOwner);
      const roomBeforeSale = buildRoomState({
        scenario,
        owners: ownerStatesBeforeSale,
        events,
        records,
        soldNames,
        initialKeeperSpend,
        startingLiveInflationFactor,
      });
      const watchOwnerBeforeSale = ownerStatesBeforeSale.find(owner => owner.owner === watchOwner);
      if (!watchOwnerBeforeSale) throw new Error(`Unknown watch owner "${watchOwner}".`);
      const liveExpectedPrice = roundPrice(sale.player.expectedPrice * roomBeforeSale.liveInflationFactor);
      const personalValue = canWatchOwnerRosterPlayer(sale.player, watchOwnerBeforeSale)
        ? personalValueForStrategy({
          player: sale.player,
          watchOwner: watchOwnerBeforeSale,
          liveExpectedPrice,
          strategy,
          pricingConfig,
        })
        : 0;
      roster.push(livePlayerForRoster(sale.player, sale.parsed.price));
      rostersByOwner.set(sale.owner, roster);
      soldNames.add(sale.player.normalizedName);
      events.push({
        input,
        owner: sale.owner,
        player: sale.player.name,
        normalizedPlayerName: sale.player.normalizedName,
        position: sale.player.position,
        price: sale.parsed.price,
        expectedPrice: sale.player.expectedPrice,
        saleVsExpected: sale.parsed.price - sale.player.expectedPrice,
        playerSource: sale.player.source,
      });
      postDraftAudit.push(saleAuditFor({ input, sale, liveExpectedPrice, personalValue }));
    } catch (error) {
      errors.push({
        input,
        message: error instanceof Error ? error.message : "Unknown live draft command error.",
      });
    }
  }

  const owners = buildOwnerStates(rostersByOwner);
  const room = buildRoomState({
    scenario,
    owners,
    events,
    records,
    soldNames,
    initialKeeperSpend,
    startingLiveInflationFactor,
  });
  const currentWatchOwner = owners.find(owner => owner.owner === watchOwner);
  if (!currentWatchOwner) throw new Error(`Unknown watch owner "${watchOwner}".`);

  const availableTargets = buildTargets({
    records,
    soldNames,
    watchOwner: currentWatchOwner,
    room,
    targetLimit,
    strategy,
    pricingConfig,
  });
  const draftPath = buildDraftPath(strategy, currentWatchOwner, availableTargets);

  return {
    strategy,
    scenario,
    room,
    watchOwner: currentWatchOwner,
    owners,
    events,
    errors,
    postDraftAudit,
    availableTargets,
    keeperTargets,
    draftPath,
    shortlist: buildShortlist(availableTargets),
    positionContexts: buildPositionContexts(owners, currentWatchOwner),
    readiness: buildReadiness({ errors, availableTargets, owners, draftPath, keepers }),
  };
};
