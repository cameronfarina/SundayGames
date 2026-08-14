import type { TopPlayerSanityReport } from "../topPlayerSanity.js";
import { buildReviewRow } from "./buildRow.js";
import type {
  PlayerOutlierReviewQueue,
  PlayerOutlierReviewRow,
} from "./contracts.js";
import { sortRows } from "./priority.js";
import { buildQueueSummary } from "./summary.js";

const rowsFor = (report: TopPlayerSanityReport): PlayerOutlierReviewRow[] =>
  report.players.flatMap(player => {
    const row = buildReviewRow(player, report);
    return row === undefined ? [] : [row];
  });

export const buildPlayerOutlierReviewQueue = (
  report: TopPlayerSanityReport,
): PlayerOutlierReviewQueue => {
  const rows = rowsFor(report).sort(sortRows);
  return {
    summary: buildQueueSummary(rows),
    rows,
  };
};
