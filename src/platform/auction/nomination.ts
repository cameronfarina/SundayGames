import { setBoardPlayerStatus } from "./board.js";
import { GenericAuctionMockError } from "./errors.js";
import { withAuctionEvents } from "./events.js";
import { assertCanAcquire } from "./roster.js";
import type {
  GenericAuctionMockBoardPlayer,
  GenericAuctionMockNomination,
  GenericAuctionMockPlayer,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "./types.js";

export const nominationFor = ({
  state,
  player,
  nominatedByTeam,
  highestBidderTeam,
  currentPrice,
  humanPassed,
  humanCanBuy = false,
}: {
  state: GenericAuctionMockState;
  player: GenericAuctionMockPlayer;
  nominatedByTeam: GenericAuctionMockTeamReadModel;
  highestBidderTeam: GenericAuctionMockTeamReadModel;
  currentPrice: number;
  humanPassed: boolean;
  humanCanBuy?: boolean | undefined;
}): GenericAuctionMockNomination => ({
  number: state.session.nominationsCompleted + 1,
  playerId: player.id,
  playerName: player.name,
  position: player.position,
  expectedPrice: player.expectedPrice,
  nominatedByTeamId: nominatedByTeam.id,
  nominatedByTeamName: nominatedByTeam.name,
  highestBidderTeamId: highestBidderTeam.id,
  highestBidderTeamName: highestBidderTeam.name,
  currentPrice,
  nextBid: currentPrice + 1,
  humanCanBuy,
  humanCanPass: humanCanBuy,
  humanPassed,
});

export const openNomination = (
  state: GenericAuctionMockState,
  nominator: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockBoardPlayer,
  openingBid: number,
): GenericAuctionMockState => {
  if (player.status !== "available") {
    throw new GenericAuctionMockError("duplicate_player", `${player.name} is already unavailable.`);
  }
  assertCanAcquire(state, nominator, player, openingBid);

  const opened: GenericAuctionMockState = {
    ...state,
    board: setBoardPlayerStatus(state, player.id, "nominated"),
    session: {
      ...state.session,
      nextNominatorTeamId: undefined,
      currentNomination: nominationFor({
        state,
        player,
        nominatedByTeam: nominator,
        highestBidderTeam: nominator,
        currentPrice: openingBid,
        humanPassed: false,
      }),
    },
  };

  return withAuctionEvents(opened, [{
    nominationNumber: state.session.nominationsCompleted + 1,
    type: "nomination",
    playerId: player.id,
    playerName: player.name,
    teamId: nominator.id,
    teamName: nominator.name,
    price: openingBid,
    text: `${nominator.name} nominated ${player.name} at $${openingBid}`,
  }]);
};
