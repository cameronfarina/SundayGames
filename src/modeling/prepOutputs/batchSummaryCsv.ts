import type { MockBatch } from "../mockBatch.js";
import { toCsv } from "./csv.js";

export const playerSaleRangesCsv = (batch: MockBatch): string =>
  toCsv(
    [
      "name", "position", "drafted_count", "drafted_rate",
      "average_market_price", "average_sale_price", "minimum_sale_price",
      "maximum_sale_price",
    ],
    batch.summary.players.map(player => [
      player.name, player.position, player.draftedCount, player.draftedRate,
      player.averageMarketPrice, player.averageSalePrice,
      player.minimumSalePrice, player.maximumSalePrice,
    ]),
  );

export const ownerSummariesCsv = (batch: MockBatch): string =>
  toCsv(
    [
      "owner", "run_count", "invalid_roster_count", "average_spend",
      "minimum_spend", "maximum_spend", "average_week1_score",
      "average_weeks1_to_4_score", "average_budget_remaining",
      "average_qb_spend", "average_rb_spend", "average_wr_spend",
      "average_te_spend", "average_k_spend", "average_dst_spend",
    ],
    batch.summary.owners.map(owner => [
      owner.owner, owner.runCount, owner.invalidRosterCount, owner.averageSpend,
      owner.minimumSpend, owner.maximumSpend, owner.averageWeek1Score,
      owner.averageWeeks1To4Score, owner.averageBudgetRemaining,
      owner.averagePositionSpend.QB, owner.averagePositionSpend.RB,
      owner.averagePositionSpend.WR, owner.averagePositionSpend.TE,
      owner.averagePositionSpend.K, owner.averagePositionSpend.DST,
    ]),
  );

export const ownerPlayerExposureCsv = (batch: MockBatch): string =>
  toCsv(
    ["owner", "player", "position", "drafted_count", "drafted_rate", "average_price"],
    batch.summary.ownerPlayerExposure.map(exposure => [
      exposure.owner, exposure.player, exposure.position,
      exposure.draftedCount, exposure.draftedRate, exposure.averagePrice,
    ]),
  );
