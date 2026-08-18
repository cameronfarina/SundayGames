import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type { GenericAuctionMockConfig } from "../genericAuctionMockEngine.js";
import type { BuildSeasonAuctionMockConfigInput } from "./contracts.js";
import { SeasonAuctionMockError } from "./errors.js";
import { auctionPlayersFor } from "./players.js";
import { positionMaximumsFor, rosterSlotsFor } from "./rosterConfig.js";

export const buildSeasonAuctionMockConfig = ({
  season,
  setup,
  humanTeamId,
  sessionId,
  seed,
  playerExpectedPrices = {},
  playerHumanValues = playerExpectedPrices,
}: BuildSeasonAuctionMockConfigInput): GenericAuctionMockConfig => {
  if (season.settings.draftFormat !== "auction") {
    throw new SeasonAuctionMockError("wrong_draft_format", "This mock session is not an auction draft.");
  }
  if (setup.seasonId !== season.id) {
    throw new SeasonAuctionMockError("setup_mismatch", "Auction mock setup does not belong to this season.");
  }
  if (!season.teams.some(team => team.id === humanTeamId)) {
    throw new SeasonAuctionMockError(
      "human_team_missing",
      "Claim a team before starting an auction mock draft.",
    );
  }
  return {
    sessionId,
    seed,
    humanTeamId,
    budgetDollars: season.settings.auction.budgetDollars,
    minimumBidDollars: season.settings.auction.minimumBidDollars,
    teams: season.teams.map(team => ({ id: team.id, name: team.displayName })),
    rosterSlots: rosterSlotsFor(season),
    positionMaximums: positionMaximumsFor(season, setup),
    players: auctionPlayersFor(setup, playerExpectedPrices, playerHumanValues),
    keepers: setup.initialRosters
      .filter(player => player.source === "keeper")
      .map(player => ({
        teamId: player.teamId,
        playerId: player.playerId ?? canonicalPlayerIdentityKey(player.playerName),
        price: player.price,
      })),
  };
};
