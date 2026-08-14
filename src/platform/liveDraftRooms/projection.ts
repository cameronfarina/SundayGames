import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type { AuctionLeagueSeason, FantasyTeam } from "../leagueSeason.js";
import { activeSalesFor } from "./activeSales.js";
import type {
  LiveDraftRoomProjection,
  LiveDraftRoomRosterPlayer,
  LiveDraftRoomTeamState,
} from "./contracts/players.js";
import type { LiveDraftRoom } from "./contracts/room.js";
import {
  countPositions,
  draftRosterCapacityFor,
  maxBidFor,
} from "./rosterCapacity.js";
import {
  rosterPlayerFromInitial,
  rosterPlayerFromSale,
} from "./rosterPlayers.js";
import { rosterSlotsFor } from "./rosterSlots.js";

const teamStateFor = (
  season: AuctionLeagueSeason,
  team: FantasyTeam,
  roster: readonly LiveDraftRoomRosterPlayer[],
): LiveDraftRoomTeamState => {
  const spent = roster.reduce((total, player) => total + player.price, 0);
  const rosterSlotsRemaining = Math.max(0, draftRosterCapacityFor(season) - roster.length);
  const budgetRemaining = season.settings.auction.budgetDollars - spent;
  return {
    teamId: team.id,
    ownerId: team.ownerId,
    ownerDisplayName: team.ownerDisplayName,
    teamDisplayName: team.displayName,
    draftOrderPosition: team.draftOrderPosition,
    budgetDollars: season.settings.auction.budgetDollars,
    spent,
    budgetRemaining,
    rosterSlotsRemaining,
    maxBid: maxBidFor(
      budgetRemaining,
      rosterSlotsRemaining,
      season.settings.auction.minimumBidDollars,
    ),
    positionCounts: countPositions(roster),
    roster: [...roster],
    slots: rosterSlotsFor(season, roster),
  };
};

const projectRoom = (
  room: Omit<LiveDraftRoom, "projection">,
  excludedSaleEventIds: ReadonlySet<string> = new Set(),
): LiveDraftRoomProjection => {
  const rostersByTeamId = new Map<string, LiveDraftRoomRosterPlayer[]>(
    room.season.teams.map(team => [team.id, []]),
  );
  for (const initialPlayer of room.initialRosters) {
    const roster = rostersByTeamId.get(initialPlayer.teamId);
    if (roster !== undefined) roster.push(rosterPlayerFromInitial(initialPlayer));
  }

  const activeSales = activeSalesFor(room.events)
    .filter(activeSale => !excludedSaleEventIds.has(activeSale.sourceEventId));
  for (const activeSale of activeSales) {
    const roster = rostersByTeamId.get(activeSale.sale.teamId);
    if (roster !== undefined) roster.push(rosterPlayerFromSale(activeSale.sale));
  }

  const unavailablePlayerIdentities = new Set<string>();
  for (const initialPlayer of room.initialRosters) {
    unavailablePlayerIdentities.add(canonicalPlayerIdentityKey(initialPlayer.playerName));
  }
  for (const activeSale of activeSales) {
    unavailablePlayerIdentities.add(
      canonicalPlayerIdentityKey(activeSale.sale.normalizedPlayerName),
    );
  }

  return {
    roomId: room.roomId,
    leagueId: room.leagueId,
    seasonId: room.seasonId,
    status: room.status,
    revision: room.revision,
    updatedAt: room.updatedAt,
    teams: room.season.teams.map(team =>
      teamStateFor(room.season, team, rostersByTeamId.get(team.id) ?? [])
    ),
    board: room.playerCatalog.filter(player =>
      !unavailablePlayerIdentities.has(canonicalPlayerIdentityKey(player.normalizedPlayerName))
    ),
    sales: activeSales.map(activeSale => activeSale.sale),
  };
};

export const roomWithProjection = (
  room: Omit<LiveDraftRoom, "projection">,
  excludedSaleEventIds?: ReadonlySet<string> | undefined,
): LiveDraftRoom => ({
  ...room,
  projection: projectRoom(room, excludedSaleEventIds),
});
