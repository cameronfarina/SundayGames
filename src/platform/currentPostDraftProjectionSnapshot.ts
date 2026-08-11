import fs from "node:fs/promises";
import type { Position } from "../../config/league.js";
import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";
import {
  normalizeLeagueSeasonSettings,
  type LeagueSeason,
  type ScoringSettings,
} from "./leagueSeason.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "./liveDraftRooms.js";
import { postDraftScoringSettingsIdForSeason } from "./postDraftLiveRoomAdapter.js";
import type { PostDraftProjectionSnapshot } from "./postDraftTeamAnalysis.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const projectionDatasetId = "espn-projections-2026-weeks-1-4";

const espnPositionById: Readonly<Record<number, Position | undefined>> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "DST",
};

const espnStatId = {
  passingYards: "3",
  passingTouchdowns: "4",
  rushingYards: "24",
  rushingTouchdowns: "25",
  receivingYards: "42",
  receivingTouchdowns: "43",
  receptions: "53",
} as const;

interface EspnProjectionStat {
  seasonId?: unknown;
  scoringPeriodId?: unknown;
  statSourceId?: unknown;
  statSplitTypeId?: unknown;
  stats?: unknown;
}

interface EspnProjectionPlayer {
  id?: unknown;
  fullName?: unknown;
  defaultPositionId?: unknown;
  stats?: unknown;
}

interface EspnProjectionRecord {
  id: number;
  name: string;
  position: Position;
  seasonStat?: EspnProjectionStat;
  weeklyStats: ReadonlyMap<number, EspnProjectionStat>;
}

interface EspnProjectionDataset {
  year: number;
  capturedAt: string;
  coveredWeeks: ReadonlySet<number>;
  projectionsByIdentity: ReadonlyMap<string, EspnProjectionRecord>;
}

const recordFrom = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

const arrayFrom = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : [];

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const projectedStatFor = (
  stats: unknown,
  seasonYear: number,
  scoringPeriodId: number,
  statSplitTypeId: number,
): EspnProjectionStat | undefined =>
  arrayFrom(stats).find(candidate => {
    const stat = recordFrom(candidate);

    return stat?.seasonId === seasonYear
      && stat.scoringPeriodId === scoringPeriodId
      && stat.statSourceId === 1
      && stat.statSplitTypeId === statSplitTypeId;
  }) as EspnProjectionStat | undefined;

const parseDataset = (value: unknown): EspnProjectionDataset => {
  const document = recordFrom(value);
  const year = finiteNumber(document?.year);
  const capturedAt = typeof document?.exportedAt === "string" ? document.exportedAt : undefined;
  if (
    year === undefined
    || !Number.isSafeInteger(year)
    || capturedAt === undefined
    || !Number.isFinite(Date.parse(capturedAt))
  ) {
    throw new Error(`Static projection dataset ${projectionDatasetId} has invalid metadata.`);
  }

  const coveredWeeks = new Set<number>();
  const projectionsByIdentity = new Map<string, EspnProjectionRecord>();
  for (const rawWeek of arrayFrom(document?.weeks)) {
    const weekDocument = recordFrom(rawWeek);
    const week = finiteNumber(weekDocument?.week);
    if (week === undefined || !Number.isSafeInteger(week) || week < 1) continue;
    coveredWeeks.add(week);

    const data = recordFrom(weekDocument?.data);
    for (const rawEntry of arrayFrom(data?.players)) {
      const entry = recordFrom(rawEntry);
      const player = recordFrom(entry?.player) as EspnProjectionPlayer | undefined;
      const id = finiteNumber(player?.id);
      const name = typeof player?.fullName === "string" ? player.fullName.trim() : "";
      const positionId = finiteNumber(player?.defaultPositionId);
      const position = positionId === undefined ? undefined : espnPositionById[positionId];
      if (id === undefined || !Number.isSafeInteger(id) || name.length === 0 || position === undefined) continue;

      const identity = canonicalPlayerIdentityKey(name);
      const existing = projectionsByIdentity.get(identity);
      const weeklyStats = new Map(existing?.weeklyStats ?? []);
      const weeklyStat = projectedStatFor(player?.stats, year, week, 1);
      if (weeklyStat !== undefined) weeklyStats.set(week, weeklyStat);
      const seasonStat = existing?.seasonStat ?? projectedStatFor(player?.stats, year, 0, 0);

      projectionsByIdentity.set(identity, {
        id,
        name,
        position,
        ...(seasonStat === undefined ? {} : { seasonStat }),
        weeklyStats,
      });
    }
  }

  return { year, capturedAt, coveredWeeks, projectionsByIdentity };
};

const statValue = (stat: EspnProjectionStat, id: string): number => {
  const stats = recordFrom(stat.stats);
  return finiteNumber(stats?.[id]) ?? 0;
};

const pointsFor = (stat: EspnProjectionStat, scoring: ScoringSettings): number =>
  statValue(stat, espnStatId.passingYards) * scoring.passingYards
  + statValue(stat, espnStatId.passingTouchdowns) * scoring.passingTouchdown
  + statValue(stat, espnStatId.rushingYards) * scoring.rushingYards
  + statValue(stat, espnStatId.rushingTouchdowns) * scoring.rushingTouchdown
  + statValue(stat, espnStatId.receivingYards) * scoring.receivingYards
  + statValue(stat, espnStatId.receivingTouchdowns) * scoring.receivingTouchdown
  + statValue(stat, espnStatId.receptions) * scoring.reception;

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

export const loadCurrentPostDraftProjectionSnapshot = async (
  season: LeagueSeason,
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[],
  now = new Date(),
): Promise<PostDraftProjectionSnapshot> => {
  const dataset = await fs.readFile(projectionPath, "utf8")
    .then((contents): unknown => JSON.parse(contents))
    .then(parseDataset);
  if (dataset.year !== season.seasonYear) {
    throw new Error(
      `Static projection dataset ${projectionDatasetId} covers ${dataset.year}, not ${season.seasonYear}.`,
    );
  }

  const scoring = normalizeLeagueSeasonSettings(season.settings).scoring;
  const scoringSettingsId = postDraftScoringSettingsIdForSeason(season);
  const week = currentCoveredWeek(season.seasonYear, now, dataset.coveredWeeks);

  return {
    metadata: {
      snapshotId: [
        "static-fallback",
        season.id,
        scoringSettingsId,
        dataset.capturedAt,
        week === undefined ? "season" : `week-${week}`,
      ].join(":"),
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
      if (projection === undefined || projection.position !== player.position || projection.seasonStat === undefined) {
        return [];
      }
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
