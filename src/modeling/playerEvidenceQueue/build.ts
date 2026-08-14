import type { FactualPlayerContextCategory } from "../../../config/playerContext.js";
import type { TopPlayerSanityReport } from "../topPlayerSanity.js";
import type {
  PlayerEvidenceQueue,
  PlayerEvidenceQueueRow,
  PlayerEvidenceQueueSummary,
} from "./contracts.js";
import { compareEvidenceRows, evidenceRowFor } from "./rows.js";

const categoryCountsFor = (
  rows: readonly PlayerEvidenceQueueRow[],
): Partial<Record<FactualPlayerContextCategory, number>> => {
  const counts: Partial<Record<FactualPlayerContextCategory, number>> = {};
  for (const row of rows) {
    for (const category of row.categories) counts[category] = (counts[category] ?? 0) + 1;
  }
  return counts;
};

const summaryFor = (rows: readonly PlayerEvidenceQueueRow[]): PlayerEvidenceQueueSummary => ({
  playerCount: rows.length,
  highPriorityCount: rows.filter(row => row.priority === "high").length,
  mediumPriorityCount: rows.filter(row => row.priority === "medium").length,
  lowPriorityCount: rows.filter(row => row.priority === "low").length,
  categoryCounts: categoryCountsFor(rows),
});

export const buildPlayerEvidenceQueue = (report: TopPlayerSanityReport): PlayerEvidenceQueue => {
  const rows = report.flaggedPlayers
    .filter(player => player.flags.length > 0)
    .map(evidenceRowFor)
    .sort(compareEvidenceRows);
  return { summary: summaryFor(rows), rows };
};
