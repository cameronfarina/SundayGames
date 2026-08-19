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

/**
 * A snake pick belongs to whoever is on the clock. A commissioner correcting the
 * board is allowed past this, because the room is a record of a draft happening
 * in the world rather than the draft itself.
 */
const assertSnakeTurn = (room: LiveDraftRoom, sale: LiveDraftRoomSale): void => {
  if (room.season.settings.draftFormat !== "snake") return;
  const onTheClock = room.projection.onTheClock;
  if (onTheClock === undefined) {
    throw new LiveDraftRoomError("draft_complete", "Every pick in this draft is already made.");
  }
  if (onTheClock.teamId !== sale.teamId) {
    throw new LiveDraftRoomError(
      "out_of_turn",
      `${onTheClock.ownerDisplayName} is on the clock at pick ${onTheClock.round}.${String(onTheClock.pickInRound).padStart(2, "0")}.`,
    );
  }
};

export const validateSale = (room: LiveDraftRoom, sale: LiveDraftRoomSale): void => {
  assertSnakeTurn(room, sale);
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
  if (team.maxBid !== undefined && sale.price !== undefined && sale.price > team.maxBid) {
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
  const parsed = parseSaleInput(input);
  const team = resolveTeam(room.season, parsed);
  const player = resolvePlayer(room.playerCatalog, parsed.playerName);
  const snake = room.season.settings.draftFormat === "snake";
  if (!snake) {
    assertPositiveWholeDollar(
      parsed.price ?? 0,
      `Sale price must be a positive whole-dollar amount for ${player.name}.`,
    );
  }
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
    ...(snake || parsed.price === undefined ? {} : { price: parsed.price }),
    expectedPrice: player.expectedPrice,
    ...(player.teamAbbreviation === undefined ? {} : { teamAbbreviation: player.teamAbbreviation }),
    ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
  };
};
