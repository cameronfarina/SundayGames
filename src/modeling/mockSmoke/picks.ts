import { ownerOrder } from "../../../config/league.js";
import type { MockRun } from "../mockBatch.js";
import type { MockSmokePick } from "./contracts.js";

export const smokeOwnerCount = ownerOrder.length;

export const firstSmokeRoundsFor = (run: MockRun, rounds: number): MockSmokePick[] =>
  run.picks.slice(0, smokeOwnerCount * rounds).map(pick => ({
    pick: pick.pick,
    round: Math.ceil(pick.pick / smokeOwnerCount),
    nominator: pick.nominator,
    winner: pick.owner,
    player: pick.player,
    position: pick.position,
    anchorPrice: pick.marketPrice,
    salePrice: pick.price,
    saleVsAnchor: pick.price - pick.marketPrice,
    budgetAfterPick: pick.budgetAfterPick,
    rosterSlotsAfterPick: pick.rosterSlotsAfterPick,
    nominationDiagnostics: pick.nominationDiagnostics,
    roomPressure: pick.diagnostics.roomPressure,
    saleResolution: {
      secondBidAmount: pick.diagnostics.secondBidAmount,
      reservePrice: pick.diagnostics.reservePrice,
      nominatorOpeningBid: pick.diagnostics.nominatorOpeningBid,
      uncappedSalePrice: pick.diagnostics.uncappedSalePrice,
      topEndGuardedPrice: pick.diagnostics.topEndGuardedPrice,
      salePriceBasis: pick.diagnostics.salePriceBasis,
    },
    bidDiagnostics: pick.topBids.map((bid, index) => {
      const diagnostics = pick.diagnostics.topBids[index];
      return {
        rank: index + 1,
        owner: bid.owner,
        amount: bid.amount,
        uncappedAmount: bid.uncappedAmount,
        maxBid: bid.maxBid,
        cappedByMaxBid: diagnostics?.cappedByMaxBid ?? bid.amount < bid.uncappedAmount,
        ownerDemandMultiplier: bid.ownerDemandMultiplier,
        rosterNeedMultiplier: bid.rosterNeedMultiplier,
        scarcityMultiplier: bid.scarcityMultiplier,
        behaviorAggressionMultiplier: bid.behaviorAggressionMultiplier,
        behaviorScarcityMultiplier: bid.behaviorScarcityMultiplier,
        buildStyleMultiplier: bid.buildStyleMultiplier,
        replacementPatienceMultiplier: bid.replacementPatienceMultiplier,
        endgamePressureMultiplier: bid.endgamePressureMultiplier,
        roomPressureMultiplier: bid.roomPressureMultiplier,
        competitionPressureMultiplier: bid.competitionPressureMultiplier,
        budgetPacingMultiplier: bid.budgetPacingMultiplier,
        bidVarianceMultiplier: bid.bidVarianceMultiplier,
        topEndDampingMultiplier: bid.topEndDampingMultiplier,
        positionOverbidDampingMultiplier: bid.positionOverbidDampingMultiplier,
        contextPenaltyDampingMultiplier: bid.contextPenaltyDampingMultiplier,
        drivers: diagnostics?.drivers ?? [],
      };
    }),
  }));
