import type {
  GenericAuctionMockBoardPlayer,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "../genericAuctionMockEngine.js";
import { remainingValuePerSlotFor } from "../auction/auctionAnalysis.js";
import { ownerBidLiftFor } from "../auction/ownerSurplus.js";
import { auctionRosterNeedFor } from "./auctionTargets.js";

// The most this manager pays on value grounds alone: market value plus
// roster need, plus plan bonuses, plus the owner-level lifts.
export const auctionValueLimitFor = (input: {
  state: GenericAuctionMockState;
  team: GenericAuctionMockTeamReadModel;
  player: GenericAuctionMockBoardPlayer;
  isTarget: boolean;
  isPair: boolean;
  isPreferred: boolean;
  pressureExempt: boolean;
}): number => {
  const { state, team, player } = input;
  const needDollars = Math.ceil(auctionRosterNeedFor(team, player.position) * 2);
  const baseValue = team.isHuman ? player.humanValue ?? player.expectedPrice : player.expectedPrice;
  const preferenceDollars = input.isPreferred ? Math.ceil(baseValue * 0.15) : 0;
  const targetDollars = input.isTarget || input.isPair ? Math.ceil(baseValue * 0.1) : 0;
  const ownerLiftDollars = ownerBidLiftFor({
    team,
    position: player.position,
    expectedPrice: baseValue,
    minimumBid: state.configuration.minimumBidDollars,
    remainingValuePerSlot: remainingValuePerSlotFor(state),
    pressureExempt: input.pressureExempt,
  });
  return Math.max(
    state.configuration.minimumBidDollars,
    Math.round(baseValue) + needDollars + preferenceDollars + targetDollars
      + ownerLiftDollars,
  );
};
