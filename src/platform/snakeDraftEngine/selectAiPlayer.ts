import type { SnakeDraftPlayer } from "./config.js";
import { aiScoreFor } from "./aiScore.js";
import { aiSettingsFor } from "./aiSettings.js";
import { SnakeDraftError } from "./error.js";
import { positionalRunsFor } from "./positionalRuns.js";
import type { SnakeDraftBoardPick, SnakeDraftState } from "./readModels.js";
import { assignableSlot } from "./rosterSlots.js";

export const selectAiPlayer = (
  state: SnakeDraftState,
  pick: SnakeDraftBoardPick,
): SnakeDraftPlayer => {
  const team = state.teams.find(candidate => candidate.id === pick.teamId);
  if (team === undefined) {
    throw new SnakeDraftError("invalid_config", `Unknown team "${pick.teamId}".`);
  }

  const availablePlayerIds = new Set(
    state.board.players.filter(player => player.available).map(player => player.id),
  );
  const settings = aiSettingsFor(state, team);
  const positionalRuns = positionalRunsFor(state, pick, settings.positionalRunWindow);
  const selected = state.configuration.players
    .filter(player => availablePlayerIds.has(player.id) && assignableSlot(team, player) !== undefined)
    .map(player => ({
      player,
      score: aiScoreFor({ state, team, pick, player, settings, positionalRuns }),
    }))
    .sort((left, right) =>
      right.score - left.score
      || left.player.rank - right.player.rank
      || left.player.id.localeCompare(right.player.id)
    )[0]?.player;

  if (selected === undefined) {
    throw new SnakeDraftError("roster_limit", `${team.name} has no eligible player for an open roster slot.`);
  }

  return selected;
};
