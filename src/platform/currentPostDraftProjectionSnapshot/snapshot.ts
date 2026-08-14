import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import { normalizeLeagueSeasonSettings, type LeagueSeason } from "../leagueSeason.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../liveDraftRooms.js";
import { postDraftScoringSettingsIdForSeason } from "../postDraftLiveRoomAdapter.js";
import type { PostDraftProjectionSnapshot } from "../postDraftTeamAnalysis.js";
import { loadProjectionDataset } from "./dataset.js";
import { projectionDatasetId } from "./contracts.js";
import { pointsFor } from "./scoring.js";

const fantasyWeekOneStartsAtBySeason: Readonly<Record<number, string | undefined>> = {
  2026: "2026-09-08T00:00:00.000Z",
};
const weekLengthMs = 7 * 24 * 60 * 60 * 1_000;

const currentCoveredWeek = (
  seasonYear: number,
  now: Date,
  coveredWeeks: ReadonlySet<number>,
): number | undefined => {
  const weekOneStartsAt = fantasyWeekOneStartsAtBySeason[seasonYear];
  if (weekOneStartsAt === undefined || !Number.isFinite(now.getTime())) return undefined;
  const elapsed = now.getTime() - Date.parse(weekOneStartsAt);
  if (elapsed < 0) return undefined;
  const week = Math.floor(elapsed / weekLengthMs) + 1;
  return coveredWeeks.has(week) ? week : undefined;
};

export const loadLeagueScoredWeekOneProjections = async (
  season: LeagueSeason,
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[],
): Promise<Readonly<Record<string, number>>> => {
  const dataset = await loadProjectionDataset();
  if (dataset.year !== season.seasonYear) return {};
  const scoring = normalizeLeagueSeasonSettings(season.settings).scoring;
  return Object.fromEntries(playerCatalog.flatMap(player => {
    if (player.position === "K" || player.position === "DST") return [];
    const identity = canonicalPlayerIdentityKey(player.name);
    const projection = dataset.projectionsByIdentity.get(identity);
    const weekOne = projection?.weeklyStats.get(1);
    return projection === undefined || projection.position !== player.position || weekOne === undefined
      ? []
      : [[identity, pointsFor(weekOne, scoring)]];
  }));
};

export const loadCurrentPostDraftProjectionSnapshot = async (
  season: LeagueSeason,
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[],
  now = new Date(),
): Promise<PostDraftProjectionSnapshot> => {
  const dataset = await loadProjectionDataset();
  if (dataset.year !== season.seasonYear) {
    throw new Error(`Static projection dataset ${projectionDatasetId} covers ${dataset.year}, not ${season.seasonYear}.`);
  }
  const scoring = normalizeLeagueSeasonSettings(season.settings).scoring;
  const scoringSettingsId = postDraftScoringSettingsIdForSeason(season);
  const week = currentCoveredWeek(season.seasonYear, now, dataset.coveredWeeks);
  return {
    metadata: {
      snapshotId: ["static-fallback", season.id, scoringSettingsId, dataset.capturedAt,
        week === undefined ? "season" : `week-${week}`].join(":"),
      leagueId: season.leagueId,
      seasonId: season.id,
      scoringSettingsId,
      generatedAt: dataset.capturedAt,
      validThrough: dataset.capturedAt,
      ...(week === undefined ? {} : { week }),
      source: {
        kind: week === undefined ? "static_fallback" : "weekly_scoring_specific",
        provider: "ESPN",
        datasetId: projectionDatasetId,
        capturedAt: dataset.capturedAt,
        confidence: week === undefined ? "low" : "high",
        weekly: week !== undefined,
        scoringSpecific: true,
      },
    },
    projections: playerCatalog.flatMap(player => {
      const projection = dataset.projectionsByIdentity.get(canonicalPlayerIdentityKey(player.name));
      if (projection === undefined || projection.position !== player.position
        || projection.seasonStat === undefined) return [];
      const weeklyStat = week === undefined ? undefined : projection.weeklyStats.get(week);
      return [{
        playerId: `player-espn-${projection.id}`,
        playerName: player.name,
        position: player.position,
        seasonProjectedPoints: pointsFor(projection.seasonStat, scoring),
        ...(weeklyStat === undefined ? {} : { weeklyProjectedPoints: pointsFor(weeklyStat, scoring) }),
      }];
    }),
  };
};
