import type { MockBatch } from "../mockBatch.js";
import { toCsv } from "./csv.js";

export const mockRoomPressureDiagnosticsCsv = (batch: MockBatch): string =>
  toCsv(
    [
      "seed", "scenario", "pick", "nominator", "winner", "player",
      "position", "anchor_price", "sale_price", "legal_bidder_count",
      "bidders_at_or_above_reserve", "bidders_at_or_above_anchor",
      "bidders_at_or_above_sale_price", "cash_heavy_bidder_count",
      "max_bidder_max_bid", "median_bidder_max_bid", "average_bidder_max_bid",
      "winning_owner_max_bid", "winning_owner_budget_remaining_before",
      "winning_owner_budget_per_roster_slot_before",
    ],
    batch.runs.flatMap(run =>
      run.picks.map(pick => {
        const pressure = pick.diagnostics.roomPressure;
        return [
          run.seed, run.keeperScenario.key, pick.pick, pick.nominator,
          pick.owner, pick.player, pick.position, pick.marketPrice, pick.price,
          pressure.legalBidderCount, pressure.biddersAtOrAboveReserve,
          pressure.biddersAtOrAboveAnchor, pressure.biddersAtOrAboveSalePrice,
          pressure.cashHeavyBidderCount, pressure.maxBidderMaxBid,
          pressure.medianBidderMaxBid, pressure.averageBidderMaxBid,
          pressure.winningOwnerMaxBid,
          pressure.winningOwnerBudgetRemainingBefore,
          pressure.winningOwnerBudgetPerRosterSlotBefore,
        ];
      }),
    ),
  );
