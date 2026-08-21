import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type {
  GenericAuctionMockAiTendency,
  GenericAuctionMockConfig,
} from "../genericAuctionMockEngine.js";
import type { BuildSeasonAuctionMockConfigInput } from "./contracts.js";
import { SeasonAuctionMockError } from "./errors.js";
import { ownerDraftingTendenciesFor } from "./draftingStyles.js";
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
  historicalSaleRecords = [],
  managerProfiles,
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
  const players = auctionPlayersFor(setup, playerExpectedPrices, playerHumanValues);
  const keepers = setup.initialRosters
    .filter(player => player.source === "keeper")
    .map(player => ({
      teamId: player.teamId,
      playerId: player.playerId ?? canonicalPlayerIdentityKey(player.playerName),
      price: player.price,
    }));
  let tendencies: ReadonlyMap<string, GenericAuctionMockAiTendency>;
  if (managerProfiles === undefined) {
    tendencies = ownerDraftingTendenciesFor({
      leagueId: season.leagueId,
      teams: season.teams,
      players,
      keptPlayerIds: new Set(keepers.map(keeper => keeper.playerId)),
      historicalSaleRecords,
    });
  } else {
    const frozenTendencies = new Map<string, GenericAuctionMockAiTendency>();
    for (const profile of managerProfiles) {
      if (profile.aiTendency !== undefined) {
        frozenTendencies.set(profile.teamId, profile.aiTendency);
      }
    }
    tendencies = frozenTendencies;
  }
  return {
    sessionId,
    seed,
    humanTeamId,
    budgetDollars: season.settings.auction.budgetDollars,
    minimumBidDollars: season.settings.auction.minimumBidDollars,
    teams: season.teams.map(team => {
      const aiTendency = tendencies.get(team.id);
      return {
        id: team.id,
        name: team.displayName,
        ...(aiTendency === undefined ? {} : { aiTendency }),
      };
    }),
    rosterSlots: rosterSlotsFor(season),
    positionMaximums: positionMaximumsFor(season, setup),
    players,
    keepers,
  };
};
