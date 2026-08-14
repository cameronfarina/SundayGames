import type { MockBatch } from "../mockBatch.js";
import { toCsv } from "./csv.js";

export const mockDraftBoardCsv = (batch: MockBatch): string =>
  toCsv(
    [
      "seed", "scenario", "pick", "nominator", "winner", "player",
      "position", "anchor_price", "sale_price", "budget_after_pick",
      "roster_slots_after_pick", "top_bid_1_owner", "top_bid_1_amount",
      "top_bid_1_uncapped", "top_bid_2_owner", "top_bid_2_amount",
      "top_bid_2_uncapped", "top_bid_3_owner", "top_bid_3_amount",
      "top_bid_3_uncapped",
    ],
    batch.runs.flatMap(run =>
      run.picks.map(pick => [
        run.seed, run.keeperScenario.key, pick.pick, pick.nominator,
        pick.owner, pick.player, pick.position, pick.marketPrice, pick.price,
        pick.budgetAfterPick, pick.rosterSlotsAfterPick,
        pick.topBids[0]?.owner, pick.topBids[0]?.amount,
        pick.topBids[0]?.uncappedAmount, pick.topBids[1]?.owner,
        pick.topBids[1]?.amount, pick.topBids[1]?.uncappedAmount,
        pick.topBids[2]?.owner, pick.topBids[2]?.amount,
        pick.topBids[2]?.uncappedAmount,
      ]),
    ),
  );
