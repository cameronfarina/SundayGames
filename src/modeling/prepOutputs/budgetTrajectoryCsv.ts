import type { MockBatch } from "../mockBatch.js";
import { toCsv } from "./csv.js";

export const ownerBudgetTrajectoryCsv = (batch: MockBatch): string =>
  toCsv(
    [
      "seed", "scenario", "pick", "event", "owner", "nominator", "winner",
      "player", "position", "market_price", "sale_price", "spent",
      "initial_spend", "auction_spend", "budget_remaining",
      "roster_slots_remaining", "max_bid", "roster_size",
      "budget_per_roster_slot", "qb_count", "rb_count", "wr_count",
      "te_count", "k_count", "dst_count",
    ],
    batch.runs.flatMap(run =>
      run.budgetTrajectory.map(row => [
        run.seed, run.keeperScenario.key, row.pick, row.event, row.owner,
        row.nominator, row.winningOwner, row.player, row.position,
        row.marketPrice, row.salePrice, row.spent, row.initialSpend,
        row.auctionSpend, row.budgetRemaining, row.rosterSlotsRemaining,
        row.maxBid, row.rosterSize, row.budgetPerRosterSlot,
        row.positionCounts.QB, row.positionCounts.RB, row.positionCounts.WR,
        row.positionCounts.TE, row.positionCounts.K, row.positionCounts.DST,
      ]),
    ),
  );
