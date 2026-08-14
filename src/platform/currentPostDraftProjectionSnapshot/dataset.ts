import fs from "node:fs/promises";
import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import { createAsyncValueCache } from "../asyncValueCache.js";
import {
  espnPositionById,
  projectionDatasetId,
  projectionPath,
  type EspnProjectionDataset,
  type EspnProjectionRecord,
  type EspnProjectionStat,
} from "./contracts.js";
import { arrayFrom, finiteNumber, recordFrom } from "./unknownValues.js";

const isProjectionStatFor = (
  seasonYear: number,
  scoringPeriodId: number,
  statSplitTypeId: number,
) => (candidate: unknown): candidate is EspnProjectionStat => {
  const stat = recordFrom(candidate);
  return stat?.seasonId === seasonYear
    && stat.scoringPeriodId === scoringPeriodId
    && stat.statSourceId === 1
    && stat.statSplitTypeId === statSplitTypeId;
};

const projectedStatFor = (
  stats: unknown,
  seasonYear: number,
  scoringPeriodId: number,
  statSplitTypeId: number,
): EspnProjectionStat | undefined =>
  arrayFrom(stats).find(isProjectionStatFor(seasonYear, scoringPeriodId, statSplitTypeId));

const parseProjection = (
  rawEntry: unknown,
  year: number,
  week: number,
  existing: EspnProjectionRecord | undefined,
): EspnProjectionRecord | undefined => {
  const entry = recordFrom(rawEntry);
  const player = recordFrom(entry?.player);
  const id = finiteNumber(player?.id);
  const name = typeof player?.fullName === "string" ? player.fullName.trim() : "";
  const positionId = finiteNumber(player?.defaultPositionId);
  const position = positionId === undefined ? undefined : espnPositionById[positionId];
  if (id === undefined || !Number.isSafeInteger(id) || name.length === 0 || position === undefined) {
    return undefined;
  }

  const weeklyStats = new Map(existing?.weeklyStats ?? []);
  const weeklyStat = projectedStatFor(player?.stats, year, week, 1);
  if (weeklyStat !== undefined) weeklyStats.set(week, weeklyStat);
  const seasonStat = existing?.seasonStat ?? projectedStatFor(player?.stats, year, 0, 0);
  return { id, name, position, ...(seasonStat === undefined ? {} : { seasonStat }), weeklyStats };
};

const parseDataset = (value: unknown): EspnProjectionDataset => {
  const document = recordFrom(value);
  const year = finiteNumber(document?.year);
  const capturedAt = typeof document?.exportedAt === "string" ? document.exportedAt : undefined;
  if (year === undefined || !Number.isSafeInteger(year) || capturedAt === undefined
    || !Number.isFinite(Date.parse(capturedAt))) {
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
      const player = recordFrom(entry?.player);
      const name = typeof player?.fullName === "string" ? player.fullName.trim() : "";
      const identity = canonicalPlayerIdentityKey(name);
      const projection = parseProjection(rawEntry, year, week, projectionsByIdentity.get(identity));
      if (projection !== undefined) projectionsByIdentity.set(identity, projection);
    }
  }
  return { year, capturedAt, coveredWeeks, projectionsByIdentity };
};

export const loadProjectionDataset = createAsyncValueCache(async (): Promise<EspnProjectionDataset> =>
  fs.readFile(projectionPath, "utf8")
    .then((contents): unknown => JSON.parse(contents))
    .then(parseDataset));
