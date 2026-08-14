import type {
  PlayerOutlierReasonKey,
  PlayerOutlierReviewQueueSummary,
  PlayerOutlierReviewRow,
} from "./contracts.js";

const reasonCountsFor = (
  rows: readonly PlayerOutlierReviewRow[],
): Partial<Record<PlayerOutlierReasonKey, number>> => {
  const counts: Partial<Record<PlayerOutlierReasonKey, number>> = {};
  for (const row of rows) {
    for (const reason of row.outlierReasons) {
      counts[reason.key] = (counts[reason.key] ?? 0) + 1;
    }
  }
  return counts;
};

export const buildQueueSummary = (
  rows: readonly PlayerOutlierReviewRow[],
): PlayerOutlierReviewQueueSummary => ({
  playerCount: rows.length,
  highPriorityCount: rows.filter(row => row.priority === "high").length,
  mediumPriorityCount: rows.filter(row => row.priority === "medium").length,
  lowPriorityCount: rows.filter(row => row.priority === "low").length,
  reasonCounts: reasonCountsFor(rows),
});
