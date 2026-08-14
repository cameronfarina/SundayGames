import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { DraftRoomRanking } from "./draftRoomRankings/contracts.js";
import { parseDraftRoomRankings } from "./draftRoomRankings/parser.js";

export type {
  DraftRoomRanking,
  DraftRoomRankingProvider,
  DraftRoomRankingScoring,
} from "./draftRoomRankings/contracts.js";
export { parseDraftRoomRankings };

export const defaultDraftRoomRankingPath =
  "data/raw/fantasy-draft-rankings-2026/average-half-ppr.tsv";

export const loadDraftRoomRankings = async (path: string): Promise<DraftRoomRanking[]> =>
  parseDraftRoomRankings(await readFile(path, "utf8"), basename(path, ".tsv"));

export const draftRoomRankingsByName = (
  rankings: readonly DraftRoomRanking[],
): ReadonlyMap<string, DraftRoomRanking> =>
  new Map(rankings.map(ranking => [ranking.normalizedName, ranking]));
