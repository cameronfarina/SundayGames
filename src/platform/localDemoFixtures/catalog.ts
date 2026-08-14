import { nflTeamByEspnProTeamId } from "../../../config/nflTeams.js";
import { leagueConfig, positions } from "../../../config/league.js";
import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import { espnPpr300AuctionBaselineValueFor } from "../../data/espnPpr300AuctionBaseline2026.js";
import { projectionRankAdjustmentFactor } from "../../modeling/liveDraftStrategies.js";
import { buildProjectionRankings } from "../../modeling/projectionRankings.js";
import { loadCurrentProjections, type ProjectionRecord } from "../../projections.js";
import { createAsyncValueCache } from "../asyncValueCache.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../liveDraftRooms.js";
import { localDemoCatalogLimit, localDemoProjectionPath } from "./constants.js";
import { localDemoRankedPlayers } from "./rankedPlayers.js";

const expectedPriceForRank = (rank: number): number =>
  Math.max(1, Math.round(74 * Math.exp(-(rank - 1) / 34)));
const currentBaselinePriceFor = (name: string, fallback: number): number =>
  Math.max(1, espnPpr300AuctionBaselineValueFor(name)?.auctionValue ?? fallback);

export const localDemoPlayerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[] =
  localDemoRankedPlayers.map((player, index) => ({
    ...player,
    expectedPrice: currentBaselinePriceFor(player.name, expectedPriceForRank(index + 1)),
  }));

const projectionFields = (
  projection: ProjectionRecord | undefined,
  projectionRanks: ReadonlyMap<number, number>,
  publicRanks: ReadonlyMap<number, number>,
) => projection === undefined
  ? { seasonProjectionAdjustmentFactor: 1, seasonProjectionScoring: leagueConfig.scoring }
  : {
      week1Projection: projection.weeks[1] ?? 0,
      weeks1To4Projection: projection.weeks1To4,
      ...(projection.seasonProjection === undefined ? {} : { seasonProjection: projection.seasonProjection }),
      seasonProjectionAdjustmentFactor: projection.projectionCalibration?.weeklyScaleFactor ??
        projectionRankAdjustmentFactor({
          projectionPositionRank: projectionRanks.get(projection.id),
          publicPositionRank: publicRanks.get(projection.id),
        }),
      seasonProjectionScoring: projection.projectionCalibration?.scoring ?? leagueConfig.scoring,
    };

const publicPositionRanksFor = (projections: readonly ProjectionRecord[]): Map<number, number> => {
  const ranks = new Map<number, number>();
  for (const position of positions) {
    projections
      .filter(projection => projection.position === position && projection.espnRank !== undefined)
      .sort((left, right) =>
        (left.espnRank ?? Number.MAX_SAFE_INTEGER) - (right.espnRank ?? Number.MAX_SAFE_INTEGER) ||
        left.name.localeCompare(right.name)
      )
      .forEach((projection, index) => ranks.set(projection.id, index + 1));
  }
  return ranks;
};

const buildCurrentPlayerCatalog = async (): Promise<readonly LiveDraftRoomPlayerCatalogEntry[]> => {
  const projections = await loadCurrentProjections({ projectionPath: localDemoProjectionPath });
  const byIdentity = new Map(
    projections.map(projection => [canonicalPlayerIdentityKey(projection.name), projection]),
  );
  const projectionRanks = new Map(
    buildProjectionRankings(projections).map(projection => [projection.id, projection.projectionRank]),
  );
  const publicRanks = publicPositionRanksFor(projections);
  const catalog: LiveDraftRoomPlayerCatalogEntry[] = localDemoPlayerCatalog.map(player => ({
    ...player,
    ...projectionFields(byIdentity.get(canonicalPlayerIdentityKey(player.name)), projectionRanks, publicRanks),
  }));
  const included = new Set(catalog.map(player => canonicalPlayerIdentityKey(player.name)));
  const ranked = [...projections].sort((left, right) =>
    (left.espnRank ?? Number.MAX_SAFE_INTEGER) - (right.espnRank ?? Number.MAX_SAFE_INTEGER) ||
    (right.espnAuctionValue ?? 0) - (left.espnAuctionValue ?? 0) ||
    (right.seasonProjection ?? 0) - (left.seasonProjection ?? 0) ||
    left.name.localeCompare(right.name)
  );

  for (const projection of ranked) {
    if (catalog.length >= localDemoCatalogLimit) break;
    const identity = canonicalPlayerIdentityKey(projection.name);
    if (!identity || included.has(identity)) continue;
    const team = projection.proTeamId === undefined
      ? undefined
      : nflTeamByEspnProTeamId[projection.proTeamId];
    catalog.push({
      name: projection.name,
      position: projection.position,
      expectedPrice: currentBaselinePriceFor(
        projection.name,
        Math.round(projection.espnAuctionValue ?? expectedPriceForRank(catalog.length + 1)),
      ),
      ...projectionFields(projection, projectionRanks, publicRanks),
      ...(team === undefined ? {} : { teamAbbreviation: team.abbreviation, byeWeek: team.byeWeek }),
    });
    included.add(identity);
  }
  return Object.freeze(catalog.map(player => Object.freeze({
    ...player,
    ...(player.seasonProjectionScoring === undefined
      ? {}
      : { seasonProjectionScoring: Object.freeze({ ...player.seasonProjectionScoring }) }),
  })));
};

export const loadCurrentPlayerCatalog = createAsyncValueCache(buildCurrentPlayerCatalog);
export const loadLocalDemoPlayerCatalog = loadCurrentPlayerCatalog;
