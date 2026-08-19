import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type { LiveDraftRoomSaleCommandInput } from "./contracts/players.js";
import type { LiveDraftRoomSale } from "./contracts/players.js";
import type { LiveDraftRoom } from "./contracts/room.js";
import { assertPositiveWholeDollar, pluralPosition } from "./common.js";
import { LiveDraftRoomError } from "./error.js";
import { positionMaximumsFor } from "./rosterCapacity.js";
import { rosterPlayerFromSale } from "./rosterPlayers.js";
import { rosterFitsDraftSlots } from "./rosterSlots.js";
import { parseSaleInput, sourceInputLabelFor } from "./saleInput.js";
import { resolvePlayer, resolveTeam } from "./teamPlayerResolution.js";

export const validateSale = (room: LiveDraftRoom, sale: LiveDraftRoomSale): void => {
  const salePlayerIdentity = canonicalPlayerIdentityKey(sale.normalizedPlayerName);
  const playerIsAlreadyRostered = room.projection.teams.some(team =>
    team.roster.some(player =>
      canonicalPlayerIdentityKey(player.normalizedPlayerName) === salePlayerIdentity
    )
  );
  if (playerIsAlreadyRostered) {
    throw new LiveDraftRoomError("duplicate_player", `${sale.playerName} is already unavailable.`);
  }

  const team = room.projection.teams.find(candidate => candidate.teamId === sale.teamId);
  if (team === undefined) {
    throw new LiveDraftRoomError("team_not_found", `Unknown team "${sale.teamId}".`);
  }
  if (team.rosterSlotsRemaining <= 0) {
    throw new LiveDraftRoomError("roster_full", `${team.ownerDisplayName} has no open roster slots.`);
  }
  if (team.maxBid !== undefined && sale.price > team.maxBid) {
    throw new LiveDraftRoomError(
      "max_bid_exceeded",
      `${team.ownerDisplayName} cannot buy ${sale.playerName} for $${sale.price}: max bid is $${team.maxBid}.`,
    );
  }

  const positionMaximum = positionMaximumsFor(room.season)[sale.position];
  if (team.positionCounts[sale.position] >= positionMaximum) {
    throw new LiveDraftRoomError(
      "position_limit",
      `${team.ownerDisplayName} cannot buy ${sale.playerName}: roster limit is ${positionMaximum} ${pluralPosition(sale.position)}.`,
    );
  }
  if (!rosterFitsDraftSlots(room.season, [...team.roster, rosterPlayerFromSale(sale)])) {
    throw new LiveDraftRoomError(
      "position_limit",
      `${team.ownerDisplayName} cannot buy ${sale.playerName}: no open roster slot accepts ${sale.position}.`,
    );
  }
};

export const buildSale = (
  room: LiveDraftRoom,
  input: LiveDraftRoomSaleCommandInput,
  saleEventId: string,
): LiveDraftRoomSale => {
  if (room.season.settings.draftFormat === "snake") {
    throw new LiveDraftRoomError("season_not_ready", "Auction sale commands cannot be logged in a snake draft.");
  }
  const parsed = parseSaleInput(input);
  const team = resolveTeam(room.season, parsed);
  const player = resolvePlayer(room.playerCatalog, parsed.playerName);
  assertPositiveWholeDollar(
    parsed.price,
    `Sale price must be a positive whole-dollar amount for ${player.name}.`,
  );
  return {
    saleEventId,
    input: sourceInputLabelFor(input),
    teamId: team.id,
    ownerId: team.ownerId,
    ownerDisplayName: team.ownerDisplayName,
    teamDisplayName: team.displayName,
    playerName: player.name,
    normalizedPlayerName: player.normalizedPlayerName,
    position: player.position,
    price: parsed.price,
    expectedPrice: player.expectedPrice,
    ...(player.teamAbbreviation === undefined ? {} : { teamAbbreviation: player.teamAbbreviation }),
    ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
  };
};
