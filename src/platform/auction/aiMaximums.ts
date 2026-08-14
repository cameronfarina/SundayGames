import { nominationFor } from "./nomination.js";
import { aiMaxBidFor } from "./pricing.js";
import { canAcquire, playerFor, teamFor } from "./roster.js";
import type {
  GenericAuctionMockNomination,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "./types.js";

export interface AiMaximum {
  team: GenericAuctionMockTeamReadModel;
  maximum: number;
}

export const aiMaximumsFor = (
  state: GenericAuctionMockState,
  nomination: GenericAuctionMockNomination,
  forceSpendPacing = false,
): readonly AiMaximum[] => {
  const player = playerFor(state, nomination.playerId);
  const humanTeam = teamFor(state, state.configuration.humanTeamId);
  const ignoreSpendPacingExclusions = forceSpendPacing
    || nomination.humanPassed
    || !canAcquire(state, humanTeam, player, state.configuration.minimumBidDollars);

  return state.teams
    .filter(team => !team.isHuman)
    .map(team => ({
      team,
      maximum: Math.max(
        aiMaxBidFor(
          state,
          team,
          player,
          nomination.number,
          ignoreSpendPacingExclusions,
        ),
        nomination.highestBidderTeamId === team.id ? nomination.currentPrice : 0,
      ),
    }))
    .filter(entry => entry.maximum >= state.configuration.minimumBidDollars)
    .sort((left, right) => {
      const maximumDifference = right.maximum - left.maximum;
      if (maximumDifference !== 0) return maximumDifference;

      const leftIsStanding = left.team.id === nomination.highestBidderTeamId;
      const rightIsStanding = right.team.id === nomination.highestBidderTeamId;
      if (leftIsStanding !== rightIsStanding) return leftIsStanding ? -1 : 1;

      return left.team.id.localeCompare(right.team.id);
    });
};

export const modeledHumanWinningBidFor = (
  state: GenericAuctionMockState,
  playerId: string,
): number | undefined => {
  const player = playerFor(state, playerId);
  const humanTeam = teamFor(state, state.configuration.humanTeamId);
  const minimumBid = state.configuration.minimumBidDollars;
  if (!canAcquire(state, humanTeam, player, minimumBid)) return undefined;

  const nomination = nominationFor({
    state,
    player,
    nominatedByTeam: humanTeam,
    highestBidderTeam: humanTeam,
    currentPrice: minimumBid,
    humanPassed: false,
  });
  const strongestAiMaximum = aiMaximumsFor(state, nomination)[0]?.maximum;
  const winningBid = strongestAiMaximum === undefined
    ? minimumBid
    : strongestAiMaximum + 1;

  return winningBid <= humanTeam.maxBid ? winningBid : undefined;
};
