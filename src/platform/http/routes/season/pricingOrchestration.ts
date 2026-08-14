import { canonicalPlayerIdentityKey } from "../../../../data/normalizePlayerName.js";
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

export const rebuildPricingAfterKeeperChange = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  season: LeagueSeason,
  setup: LiveDraftRoomSetup,
  options: {
    preflight?: boolean;
    historicalSaleRecords?: readonly HistoricalSaleRecord[];
    modelVersion?: string;
  } = {},
): Promise<PreflightLeaguePricingWorkflowResult | RebuildLeaguePricingWorkflowResult | undefined> => {
  if (season.settings.draftFormat === "snake") return undefined;
  const keepers = listSeasonKeepers(setup);
  const keeperPlayerKeys = new Set(keepers.map(keeper => canonicalPlayerIdentityKey(keeper.playerName)));
  const input = {
    actorSessionToken: request.sessionToken,
    leagueId: season.leagueId,
    seasonYear: season.seasonYear,
    modelVersion: options.modelVersion ?? "league-history-keepers-v2",
    scenarioIds: ["expected"],
    baselinePrices: setup.playerCatalog
      .filter(player => !keeperPlayerKeys.has(canonicalPlayerIdentityKey(player.name)))
      .map(player => ({
        name: player.name,
        normalizedName: canonicalPlayerIdentityKey(player.name),
        position: player.position,
        price: player.marketPrice ?? player.expectedPrice,
      })),
    currentKeeperCount: keepers.length,
    keeperLockedSpend: keepers.reduce((total, keeper) => total + keeper.price, 0),
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
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[],
): Promise<readonly LiveDraftRoomPlayerCatalogEntry[]> => {
  if (season.settings.draftFormat !== "auction") return playerCatalog;
  const snapshots = await app.listLeaguePricingSnapshots({
    actorSessionToken: request.sessionToken,
    leagueId: season.leagueId,
    seasonYear: season.seasonYear,
    scenarioId: "expected",
    now: request.now,
  });
  return playerCatalogWithPricingSnapshot(playerCatalog, snapshots.at(-1));
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
