import { ownerOrder, type Owner } from "../../config/league.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import type { AuctionEngineConfigOverrides, OwnerPlayerTargetMaxBids } from "../modeling/auctionEngine.js";
import {
  defaultLiveDraftStrategyKey,
  liveDraftStrategyFor,
  type LiveDraftStrategyKey,
} from "../modeling/liveDraftStrategies.js";
import { parseMockDraftScript, type MockDraftScript } from "../modeling/mockScript.js";
import { maximumBatchRunsPerScenario } from "./constants.js";

export const batchRunsPerScenarioFromValue = (value: unknown): number => {
  const parsed = value === undefined ? 25 : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Mock batch runs must be a positive integer.");
  }
  return Math.min(parsed, maximumBatchRunsPerScenario);
};

export const seedPrefixFromValue = (value: unknown): string => {
  if (typeof value !== "string") return "live-ui-batch";
  return value.trim() || "live-ui-batch";
};

export const seedFromValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export const nominatedPlayerFromValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export const nominatedPriceFromValue = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const price = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number(value.trim())
      : Number.NaN;
  if (!Number.isInteger(price) || price <= 0) {
    throw new Error("Nomination price must be a positive whole-dollar amount.");
  }
  return price;
};

export const mockDraftScriptFromBody = (
  body: Record<string, unknown>,
): MockDraftScript | undefined => {
  const value = body.script ?? body.mockScript;
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("Mock script must be text.");
  return parseMockDraftScript(value);
};

export const mockDraftScriptForOwner = (
  script: MockDraftScript,
  watchOwner: Owner,
): MockDraftScript => ({
  ...script,
  targetMaxBids: script.targetMaxBids.map(target => ({ ...target, owner: watchOwner })),
  ...(script.buildAround === undefined
    ? {}
    : { buildAround: { ...script.buildAround, owner: watchOwner } }),
});

export const targetMaxBidOverridesFor = (
  script: MockDraftScript | undefined,
): AuctionEngineConfigOverrides => {
  if (!script) return {};
  const ownerPlayerTargetMaxBids: OwnerPlayerTargetMaxBids = {};
  for (const target of script.targetMaxBids) {
    ownerPlayerTargetMaxBids[target.owner] = {
      ...(ownerPlayerTargetMaxBids[target.owner] ?? {}),
      [normalizePlayerName(target.player)]: target.maxBid,
    };
  }
  return { ownerPlayerTargetMaxBids };
};

export const forcedSaleForBuildAroundRun = (
  script: MockDraftScript | undefined,
  completedRuns: number,
  runsPerPricePoint: number,
): { owner: Owner; player: string; price: number }[] | undefined => {
  const buildAround = script?.buildAround;
  const prices = buildAround?.prices;
  if (!buildAround || !prices?.length) return undefined;
  const index = Math.min(prices.length - 1, Math.floor(completedRuns / Math.max(1, runsPerPricePoint)));
  const price = prices[index];
  return price === undefined ? undefined : [{ owner: buildAround.owner, player: buildAround.player, price }];
};

export const buildAroundRunLabelsFor = (
  script: MockDraftScript | undefined,
  runsPerPricePoint: number,
  strategyKeys: readonly LiveDraftStrategyKey[],
): string[] => {
  const buildAround = script?.buildAround;
  if (!buildAround) return [];
  const shortName = buildAround.player.trim().split(/\s+/).at(-1) ?? buildAround.player;
  let runNumber = 0;
  return buildAround.prices.flatMap(price => Array.from({ length: runsPerPricePoint }, () => {
    runNumber += 1;
    const strategyKey = strategyKeys[runNumber - 1] ?? defaultLiveDraftStrategyKey;
    const label = strategyKey === "three-rb" ? "3RB" : liveDraftStrategyFor(strategyKey).label;
    return `Run ${runNumber}: ${shortName} $${price} / ${label}`;
  }));
};

export const mergeAuctionConfigOverrides = (
  base: AuctionEngineConfigOverrides,
  overrides: AuctionEngineConfigOverrides,
): AuctionEngineConfigOverrides => {
  const targets: OwnerPlayerTargetMaxBids = {};
  for (const owner of ownerOrder) {
    const ownerTargets = { ...(base.ownerPlayerTargetMaxBids?.[owner] ?? {}), ...(overrides.ownerPlayerTargetMaxBids?.[owner] ?? {}) };
    if (Object.keys(ownerTargets).length) targets[owner] = ownerTargets;
  }
  const ownerPlayerTargetMaxBids = Object.keys(targets).length ? targets : undefined;
  return { ...base, ...overrides, ...(ownerPlayerTargetMaxBids ? { ownerPlayerTargetMaxBids } : {}) };
};

export const mockBatchStrategySequence = (
  preferred: LiveDraftStrategyKey,
  count: number,
  segmentSize = count,
): LiveDraftStrategyKey[] => {
  const cycle: readonly LiveDraftStrategyKey[] = preferred === "three-rb"
    ? ["three-rb", "balanced", "three-rb", "hero-rb", "three-rb", "wr-heavy", "balanced", "three-rb"]
    : preferred === "balanced"
      ? ["balanced", "three-rb", "balanced", "hero-rb", "balanced", "wr-heavy"]
      : preferred === "hero-rb"
        ? ["hero-rb", "balanced", "hero-rb", "wr-heavy", "balanced", "three-rb"]
        : ["wr-heavy", "balanced", "wr-heavy", "hero-rb", "balanced", "three-rb"];
  return Array.from({ length: count }, (_, index) =>
    cycle[Math.max(0, index % Math.max(1, segmentSize)) % cycle.length] ?? preferred);
};
