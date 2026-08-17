import { canonicalPlayerIdentityKey } from "../../../../data/normalizePlayerName.js";
import { espnPpr300AuctionBaselineValueFor } from "../../../../data/espnPpr300AuctionBaseline2026.js";
import type { HistoricalSaleRecord } from "../../../historicalImports.js";
import type { LeagueSeason } from "../../../leagueSeason.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../../../liveDraftRooms.js";
import type { LiveDraftRoomSetup } from "../../../liveDraftRoomSetups.js";
import type { PlatformApp } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { listSeasonKeepers } from "../../../seasonKeeperSetup.js";
import type { PricingSnapshot } from "../../../pricingSnapshots.js";
import type {
  PreflightLeaguePricingWorkflowResult,
  RebuildLeaguePricingWorkflowResult,
} from "../../../platformPricingWorkflow.js";

// v4 scales history-calibrated prices to the league budget. Prices computed
// before that change differ, so they need their own version: a saved snapshot
// is immutable, and reusing v3 makes every recalculation collide with it.
export const currentLeaguePricingModelVersion = "league-history-keepers-v4";

const staleKeeperPricingModelVersions = new Set([
  "league-history-keepers-v2",
  "league-history-v2",
]);

const publicBaselinePriceFor = (player: LiveDraftRoomPlayerCatalogEntry): number =>
  Math.max(
    1,
    espnPpr300AuctionBaselineValueFor(player.name)?.auctionValue
      ?? player.marketPrice
      ?? player.expectedPrice,
  );

export const rebuildPricingAfterKeeperChange = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  season: LeagueSeason,
  setup: Pick<LiveDraftRoomSetup, "playerCatalog" | "initialRosters">,
  options: {
    preflight?: boolean;
    historicalSaleRecords?: readonly HistoricalSaleRecord[];
    modelVersion?: string;
  } = {},
): Promise<PreflightLeaguePricingWorkflowResult | RebuildLeaguePricingWorkflowResult | undefined> => {
  if (season.settings.draftFormat === "snake") return undefined;
  const keepers = listSeasonKeepers(setup);
  const input = {
    actorSessionToken: request.sessionToken,
    leagueId: season.leagueId,
    seasonYear: season.seasonYear,
    modelVersion: options.modelVersion ?? currentLeaguePricingModelVersion,
    scenarioIds: ["expected"],
    baselinePrices: setup.playerCatalog.map(player => ({
      name: player.name,
      normalizedName: canonicalPlayerIdentityKey(player.name),
      position: player.position,
      price: publicBaselinePriceFor(player),
    })),
    currentKeeperCount: keepers.length,
    keeperLockedSpend: keepers.reduce((total, keeper) => total + keeper.price, 0),
    currentKeepers: keepers.map(keeper => ({
      normalizedName: canonicalPlayerIdentityKey(keeper.playerName),
      priceDollars: keeper.price,
    })),
    now: request.now,
    ...(options.historicalSaleRecords === undefined ? {} : { historicalSaleRecords: options.historicalSaleRecords }),
  };
  return options.preflight === true
    ? await app.preflightLeaguePricing(input)
    : await app.rebuildLeaguePricing(input);
};

export const playerCatalogWithPricingSnapshot = (
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[],
  snapshot: PricingSnapshot | undefined,
): readonly LiveDraftRoomPlayerCatalogEntry[] => {
  if (snapshot === undefined) return playerCatalog;
  const rowsByPlayer = new Map(snapshot.rows.map(row => [canonicalPlayerIdentityKey(row.playerName), row]));
  return playerCatalog.map(player => {
    const pricing = rowsByPlayer.get(canonicalPlayerIdentityKey(player.name));
    return pricing === undefined ? player : {
      ...player,
      marketPrice: pricing.marketPrice,
      expectedPrice: Math.max(1, Math.round(pricing.scenarioPrice)),
    };
  });
};

export const liveRoomCatalogForSeason = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  season: LeagueSeason,
  setup: Pick<LiveDraftRoomSetup, "playerCatalog" | "initialRosters">,
): Promise<readonly LiveDraftRoomPlayerCatalogEntry[]> => {
  if (season.settings.draftFormat !== "auction") return setup.playerCatalog;
  const latest = await currentPricingSnapshotForSeason(app, request, season, setup);
  return playerCatalogWithPricingSnapshot(setup.playerCatalog, latest);
};

export const currentPricingSnapshotForSeason = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  season: LeagueSeason,
  setup: Pick<LiveDraftRoomSetup, "playerCatalog" | "initialRosters">,
): Promise<PricingSnapshot | undefined> => {
  const latest = await app.getLatestLeaguePricingSnapshot({
    actorSessionToken: request.sessionToken,
    leagueId: season.leagueId,
    seasonYear: season.seasonYear,
    scenarioId: "expected",
    now: request.now,
  });
  if (latest === undefined || !staleKeeperPricingModelVersions.has(latest.modelVersion)) {
    return latest;
  }
  const refreshed = await rebuildPricingAfterKeeperChange(app, request, season, setup, {
    preflight: true,
  });
  return refreshed?.snapshots.at(-1);
};

export const synchronizeUnopenedLiveRoomAfterKeeperChange = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  season: LeagueSeason,
  setup: LiveDraftRoomSetup,
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[],
  idempotencyKey = `keepers:${setup.contentHash}:${setup.updatedAt.toISOString()}`,
  expectedRevision?: number,
) => await app.synchronizeLiveDraftRoomInitialRosters({
  actorSessionToken: request.sessionToken,
  seasonId: season.id,
  initialRosters: setup.initialRosters,
  playerCatalog,
  idempotencyKey,
  ...(expectedRevision === undefined ? {} : { expectedRevision }),
  now: request.now,
});
