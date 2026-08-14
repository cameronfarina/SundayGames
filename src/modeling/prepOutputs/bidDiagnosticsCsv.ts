import type { MockBatch } from "../mockBatch.js";
import type { CsvValue } from "./csv.js";
import { toCsv } from "./csv.js";

const headers = [
  "seed", "scenario", "pick", "nominator", "winner", "player", "position",
  "anchor_price", "sale_price", "bid_rank", "bid_owner", "bid_amount",
  "bid_uncapped", "bid_max", "bid_capped_by_max", "owner_demand_multiplier",
  "roster_need_multiplier", "scarcity_multiplier",
  "behavior_aggression_multiplier", "behavior_scarcity_multiplier",
  "build_style_multiplier", "replacement_patience_multiplier",
  "endgame_pressure_multiplier", "room_pressure_multiplier",
  "competition_pressure_multiplier", "budget_pacing_multiplier",
  "bid_variance_multiplier", "top_end_damping_multiplier",
  "position_overbid_damping_multiplier", "context_penalty_damping_multiplier",
  "second_bid_amount", "reserve_price", "nominator_opening_bid",
  "uncapped_sale_price", "top_end_guarded_price", "sale_price_basis",
  "top_driver_1", "top_driver_1_multiplier", "top_driver_2",
  "top_driver_2_multiplier", "top_driver_3", "top_driver_3_multiplier",
];

export const mockBidDiagnosticsCsv = (batch: MockBatch): string =>
  toCsv(
    headers,
    batch.runs.flatMap(run =>
      run.picks.flatMap(pick =>
        pick.topBids.map((bid, bidIndex): readonly CsvValue[] => {
          const diagnostics = pick.diagnostics.topBids[bidIndex];
          const drivers = diagnostics?.drivers ?? [];

          return [
            run.seed, run.keeperScenario.key, pick.pick, pick.nominator,
            pick.owner, pick.player, pick.position, pick.marketPrice, pick.price,
            bidIndex + 1, bid.owner, bid.amount, bid.uncappedAmount, bid.maxBid,
            diagnostics?.cappedByMaxBid ?? bid.amount < bid.uncappedAmount,
            bid.ownerDemandMultiplier, bid.rosterNeedMultiplier,
            bid.scarcityMultiplier, bid.behaviorAggressionMultiplier,
            bid.behaviorScarcityMultiplier, bid.buildStyleMultiplier,
            bid.replacementPatienceMultiplier, bid.endgamePressureMultiplier,
            bid.roomPressureMultiplier, bid.competitionPressureMultiplier,
            bid.budgetPacingMultiplier, bid.bidVarianceMultiplier,
            bid.topEndDampingMultiplier, bid.positionOverbidDampingMultiplier,
            bid.contextPenaltyDampingMultiplier,
            pick.diagnostics.secondBidAmount, pick.diagnostics.reservePrice,
            pick.diagnostics.nominatorOpeningBid,
            pick.diagnostics.uncappedSalePrice,
            pick.diagnostics.topEndGuardedPrice,
            pick.diagnostics.salePriceBasis,
            drivers[0]?.key, drivers[0]?.multiplier,
            drivers[1]?.key, drivers[1]?.multiplier,
            drivers[2]?.key, drivers[2]?.multiplier,
          ];
        }),
      ),
    ),
  );
