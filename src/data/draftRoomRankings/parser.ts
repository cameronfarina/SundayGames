import type {
  DraftRoomRanking,
  DraftRoomRankingScoring,
} from "./contracts.js";
import { draftRoomRankingFor } from "./row.js";
import { tabularHeaders } from "./tabularRow.js";

const titleize = (value: string): string =>
  value
    .split("-")
    .map(part =>
      part === "ppr" || part === "cbs"
        ? part.toUpperCase()
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");

const scoringFor = (sourceId: string): DraftRoomRankingScoring => {
  if (sourceId.includes("half")) return "half-ppr";
  if (sourceId.includes("ppr")) return "ppr";
  if (sourceId.includes("standard")) return "standard";
  return "unknown";
};

export const parseDraftRoomRankings = (
  raw: string,
  sourceId = "draft-room-rankings",
): DraftRoomRanking[] => {
  const lines = raw.split(/\r?\n/).filter(line => line.trim().length > 0);
  const headerLine = lines[0];
  if (!headerLine) return [];

  const headers = tabularHeaders(headerLine);
  const source = {
    sourceId,
    sourceLabel: titleize(sourceId),
    scoring: scoringFor(sourceId),
  };
  return lines.slice(1).flatMap(line => {
    const ranking = draftRoomRankingFor(headers, line, source);
    return ranking === undefined ? [] : [ranking];
  });
};
