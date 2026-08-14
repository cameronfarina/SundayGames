import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type { FantasyTeam, LeagueSeason } from "../leagueSeason.js";
import type { LiveDraftRoomInitialRosterPlayer } from "./contracts/core.js";
import type { LiveDraftRoomRosterPlayer } from "./contracts/players.js";
import { assertPositiveWholeDollar, pluralPosition } from "./common.js";
import { LiveDraftRoomError } from "./error.js";
import {
  countPositions,
  draftRosterCapacityFor,
  maxBidFor,
  positionMaximumsFor,
} from "./rosterCapacity.js";
import { rosterPlayerFromInitial } from "./rosterPlayers.js";
import { rosterFitsDraftSlots } from "./rosterSlots.js";

interface InitialRosterState {
  team: FantasyTeam;
  roster: LiveDraftRoomRosterPlayer[];
}

export const validateInitialRosters = (
  season: LeagueSeason,
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[],
): void => {
  const rosterStateByTeamId = new Map<string, InitialRosterState>(
    season.teams.map(team => [team.id, { team, roster: [] }]),
  );
  const unavailablePlayerIdentities = new Set<string>();

  for (const player of initialRosters) {
    const rosterPlayer = rosterPlayerFromInitial(player);
    const rosterState = rosterStateByTeamId.get(player.teamId);
    if (rosterState === undefined) {
      throw new LiveDraftRoomError("team_not_found", `Unknown team "${player.teamId}".`);
    }
    const { roster, team } = rosterState;
    assertPositiveWholeDollar(
      rosterPlayer.price,
      `Initial roster price must be a positive whole-dollar amount for ${rosterPlayer.name}.`,
    );
    const playerIdentity = canonicalPlayerIdentityKey(rosterPlayer.normalizedPlayerName);
    if (unavailablePlayerIdentities.has(playerIdentity)) {
      throw new LiveDraftRoomError("duplicate_player", `${rosterPlayer.name} is already unavailable.`);
    }

    const rosterCapacity = draftRosterCapacityFor(season);
    if (roster.length >= rosterCapacity) {
      throw new LiveDraftRoomError("roster_full", `${team.ownerDisplayName} has no open roster slots.`);
    }
    const spent = roster.reduce((total, rosteredPlayer) => total + rosteredPlayer.price, 0);
    const rosterSlotsRemaining = rosterCapacity - roster.length;
    const budgetRemaining = season.settings.auction.budgetDollars - spent;
    const maxBid = maxBidFor(
      budgetRemaining,
      rosterSlotsRemaining,
      season.settings.auction.minimumBidDollars,
    );
    if (rosterPlayer.price > maxBid) {
      throw new LiveDraftRoomError(
        "max_bid_exceeded",
        `${team.ownerDisplayName} cannot roster ${rosterPlayer.name} for $${rosterPlayer.price}: max bid is $${maxBid}.`,
      );
    }

    const positionMaximum = positionMaximumsFor(season)[rosterPlayer.position];
    if (countPositions(roster)[rosterPlayer.position] >= positionMaximum) {
      throw new LiveDraftRoomError(
        "position_limit",
        `${team.ownerDisplayName} cannot roster ${rosterPlayer.name}: roster limit is ${positionMaximum} ${pluralPosition(rosterPlayer.position)}.`,
      );
    }
    if (!rosterFitsDraftSlots(season, [...roster, rosterPlayer])) {
      throw new LiveDraftRoomError(
        "position_limit",
        `${team.ownerDisplayName} cannot roster ${rosterPlayer.name}: no open roster slot accepts ${rosterPlayer.position}.`,
      );
    }

    unavailablePlayerIdentities.add(playerIdentity);
    roster.push(rosterPlayer);
  }
};
