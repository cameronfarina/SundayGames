import {
  modeledHumanWinningBidFor,
  type GenericAuctionMockBoardPlayer,
  type GenericAuctionMockState,
} from "./genericAuctionMockEngine.js";
import type { SeasonSimulationTargetConstraint } from "./seasonSimulationTargets.js";

export const neutralTargetPricingState = (input: {
  state: GenericAuctionMockState;
}): GenericAuctionMockState => ({
  ...input.state,
  configuration: {
    ...input.state.configuration,
    teams: input.state.configuration.teams.map(team => ({
      ...team,
      aiTendency: { ...team.aiTendency, randomness: 0 },
    })),
    ai: {
      ...input.state.configuration.ai,
      randomness: 0,
    },
  },
});

export const modeledTargetWinningBid = (input: {
  state: GenericAuctionMockState;
  player: GenericAuctionMockBoardPlayer;
  target: SeasonSimulationTargetConstraint;
}): number => {
  const marketPrice = modeledHumanWinningBidFor(input.state, input.player.id)
    ?? input.state.configuration.budgetDollars + 1;
  return input.target.maxAuctionPrice === undefined
    ? marketPrice
    : Math.min(input.target.maxAuctionPrice, marketPrice);
};
