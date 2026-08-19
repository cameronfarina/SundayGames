import { isSnakeLeagueSeason } from "../leagueSeason.js";
import type { LiveDraftRoomPickCommandInput, LiveDraftRoomPickSelection } from "./contracts/players.js";
import type { LiveDraftRoom } from "./contracts/room.js";
import { LiveDraftRoomError } from "./error.js";
import { positionMaximumsFor } from "./rosterCapacity.js";
import { rosterPlayerFromPick } from "./rosterPlayers.js";
import { rosterFitsDraftSlots } from "./rosterSlots.js";
import { resolvePlayer } from "./teamPlayerResolution.js";

const playerNameFor = (input: LiveDraftRoomPickCommandInput): string =>
  typeof input === "string" ? input : input.playerName;

const inputLabelFor = (input: LiveDraftRoomPickCommandInput): string =>
  typeof input === "string" ? input.trim() : input.playerName.trim();

export const buildPick = (
  room: LiveDraftRoom,
  input: LiveDraftRoomPickCommandInput,
  pickEventId: string,
): LiveDraftRoomPickSelection => {
  if (!isSnakeLeagueSeason(room.season)) {
    throw new LiveDraftRoomError("season_not_ready", "Snake picks can only be logged for a snake draft.");
  }
  const onTheClock = room.projection.onTheClock;
  if (onTheClock === undefined) {
    throw new LiveDraftRoomError("draft_complete", "Every snake draft slot has already been filled.");
  }
  const team = room.season.teams.find(candidate => candidate.id === onTheClock.teamId);
  if (team === undefined) {
    throw new LiveDraftRoomError("team_not_found", `Unknown team "${onTheClock.teamId}".`);
  }
  const player = resolvePlayer(room.projection.board, playerNameFor(input));
  return {
    pickEventId,
    input: inputLabelFor(input),
    overall: onTheClock.overall,
    round: onTheClock.round,
    pickInRound: onTheClock.pickInRound,
    teamId: team.id,
    ownerId: team.ownerId,
    ownerDisplayName: team.ownerDisplayName,
    teamDisplayName: team.displayName,
    playerName: player.name,
    normalizedPlayerName: player.normalizedPlayerName,
    position: player.position,
    expectedPrice: player.expectedPrice,
    ...(player.teamAbbreviation === undefined ? {} : { teamAbbreviation: player.teamAbbreviation }),
    ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
  };
};

export const validatePick = (room: LiveDraftRoom, pick: LiveDraftRoomPickSelection): void => {
  const team = room.projection.teams.find(candidate => candidate.teamId === pick.teamId);
  if (team === undefined) {
    throw new LiveDraftRoomError("team_not_found", `Unknown team "${pick.teamId}".`);
  }
  if (team.rosterSlotsRemaining <= 0) {
    throw new LiveDraftRoomError("roster_full", `${team.ownerDisplayName} has no open roster slots.`);
  }
  const positionMaximum = positionMaximumsFor(room.season)[pick.position];
  if (team.positionCounts[pick.position] >= positionMaximum) {
    throw new LiveDraftRoomError(
      "position_limit",
      `${team.ownerDisplayName} cannot draft ${pick.playerName}: roster limit reached for ${pick.position}.`,
    );
  }
  if (!rosterFitsDraftSlots(room.season, [...team.roster, rosterPlayerFromPick(pick)])) {
    throw new LiveDraftRoomError(
      "position_limit",
      `${team.ownerDisplayName} cannot draft ${pick.playerName}: no open roster slot accepts ${pick.position}.`,
    );
  }
};
