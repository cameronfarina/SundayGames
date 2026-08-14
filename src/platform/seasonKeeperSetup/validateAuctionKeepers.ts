import type { AuctionLeagueSeasonSettings } from "../leagueSeason.js";
import type { LiveDraftRoomInitialRosterPlayer } from "../liveDraftRooms.js";
import type { SeasonKeeperCommandPreview } from "./contracts.js";
import { SeasonKeeperSetupError } from "./errors.js";

interface ValidateAuctionKeepersInput {
  settings: AuctionLeagueSeasonSettings;
  teamName: string;
  teamPlayers: readonly LiveDraftRoomInitialRosterPlayer[];
  preview: SeasonKeeperCommandPreview;
}

export const validateAuctionKeepers = ({
  settings,
  teamName,
  teamPlayers,
  preview,
}: ValidateAuctionKeepersInput): void => {
  const minimumBid = settings.auction.minimumBidDollars;
  for (const player of teamPlayers) {
    if (!Number.isInteger(player.price) || player.price < minimumBid) {
      throw new SeasonKeeperSetupError(
        "keeper_value_invalid",
        `${player.playerName} must have a whole-dollar keeper cost of at least $${minimumBid}.`,
      );
    }
  }

  const spent = teamPlayers.reduce((total, player) => total + player.price, 0);
  const remainingSlots = settings.roster.rosterSize - teamPlayers.length;
  const reservedDollars = remainingSlots * minimumBid;
  if (spent + reservedDollars <= settings.auction.budgetDollars) return;
  const slotLabel = remainingSlots === 1 ? "slot" : "slots";
  const addedPrice = preview.keeper.draftType === "auction"
    ? preview.keeper.auctionCostDollars
    : 0;
  throw new SeasonKeeperSetupError(
    "keeper_budget_exceeded",
    `${teamName} cannot keep ${preview.player.name} for $${addedPrice} and reserve $${reservedDollars} for its remaining roster ${slotLabel}.`,
  );
};
