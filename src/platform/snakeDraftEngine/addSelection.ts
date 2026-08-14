import type { SnakeDraftPlayer } from "./config.js";
import { SnakeDraftError } from "./error.js";
import type { SnakeDraftBoardPick, SnakeDraftSelection, SnakeDraftState } from "./readModels.js";
import { assignableSlot } from "./rosterSlots.js";

export const addSelection = (
  state: SnakeDraftState,
  pick: SnakeDraftBoardPick,
  player: SnakeDraftPlayer,
  source: SnakeDraftSelection["source"],
): SnakeDraftState => {
  const team = state.teams.find(candidate => candidate.id === pick.teamId);
  if (team === undefined) {
    throw new SnakeDraftError("invalid_config", `Unknown team "${pick.teamId}".`);
  }
  const slot = assignableSlot(team, player);
  if (slot === undefined) {
    throw new SnakeDraftError("roster_limit", `${team.name} cannot roster ${player.name}.`);
  }

  const selection: SnakeDraftSelection = {
    playerId: player.id,
    source,
    rosterSlot: slot.slot,
  };

  return {
    ...state,
    board: {
      players: state.board.players.map(candidate =>
        candidate.id === player.id ? { ...candidate, available: false } : candidate,
      ),
      picks: state.board.picks.map(candidate =>
        candidate.overall === pick.overall ? { ...candidate, selection } : candidate,
      ),
    },
    teams: state.teams.map(candidate => candidate.id === team.id ? {
      ...candidate,
      roster: [...candidate.roster, selection],
      slots: candidate.slots.map(candidateSlot =>
        candidateSlot.slot === slot.slot ? { ...candidateSlot, playerId: player.id } : candidateSlot,
      ),
    } : candidate),
  };
};
