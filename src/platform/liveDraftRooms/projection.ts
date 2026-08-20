import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import { isSnakeLeagueSeason } from "../leagueSeason.js";
import type { ExplicitLeagueSeason, FantasyTeam } from "../leagueSeason.js";
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
import { onTheClockPick, snakePicksFor } from "./snakePicks.js";

const teamStateFor = (
  season: ExplicitLeagueSeason,
  team: FantasyTeam,
  roster: readonly LiveDraftRoomRosterPlayer[],
): LiveDraftRoomTeamState => {
  const rosterSlotsRemaining = Math.max(0, draftRosterCapacityFor(season) - roster.length);
  const common = {
    teamId: team.id,
    ownerId: team.ownerId,
    ownerDisplayName: team.ownerDisplayName,
    teamDisplayName: team.displayName,
    draftOrderPosition: team.draftOrderPosition,
    rosterSlotsRemaining,
    positionCounts: countPositions(roster),
    roster: [...roster],
    slots: rosterSlotsFor(season, roster),
  };
  const auction = season.settings.auction;
  if (auction === undefined) return common;

  const spent = roster.reduce((total, player) => total + (player.price ?? 0), 0);
  const budgetRemaining = auction.budgetDollars - spent;
  return {
    ...common,
    budgetDollars: auction.budgetDollars,
    spent,
    budgetRemaining,
    maxBid: maxBidFor(budgetRemaining, rosterSlotsRemaining, auction.minimumBidDollars),
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

  const sales = activeSales.map(activeSale => activeSale.sale);
  const saleSequenceIndices = activeSales.map(activeSale => activeSale.sequenceIndex);
  const season = room.season;
  const picks = isSnakeLeagueSeason(season)
    ? snakePicksFor(season, room.initialRosters, sales, saleSequenceIndices)
    : undefined;

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
    sales,
    ...(picks === undefined ? {} : { picks, onTheClock: onTheClockPick(picks) }),
  };
};

export const roomWithProjection = (
  room: Omit<LiveDraftRoom, "projection">,
  excludedSaleEventIds?: ReadonlySet<string> | undefined,
): LiveDraftRoom => ({
  ...room,
  projection: projectRoom(room, excludedSaleEventIds),
});
