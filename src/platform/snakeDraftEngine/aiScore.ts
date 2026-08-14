import type { SnakeDraftPlayer } from "./config.js";
import type { ResolvedAiSettings } from "./aiSettings.js";
import { deterministicFraction } from "./deterministicFraction.js";
import type { SnakeDraftBoardPick, SnakeDraftState, SnakeDraftTeamReadModel } from "./readModels.js";
import { rosterNeedFor } from "./rosterSlots.js";

interface AiScoreInput {
  state: SnakeDraftState;
  team: SnakeDraftTeamReadModel;
  pick: SnakeDraftBoardPick;
  player: SnakeDraftPlayer;
  settings: ResolvedAiSettings;
  positionalRuns: ReadonlyMap<string, number>;
}

export const aiScoreFor = ({
  state,
  team,
  pick,
  player,
  settings,
  positionalRuns,
}: AiScoreInput): number => -(player.rank * settings.rankWeight)
  - (player.adp * settings.adpWeight)
  + (rosterNeedFor(team, player.position) * settings.rosterNeedWeight)
  + ((positionalRuns.get(player.position) ?? 0) * settings.positionalRunWeight)
  + (settings.positionPreferences[player.position] ?? 0)
  + (deterministicFraction(`${state.session.seed}:${pick.overall}:${team.id}:${player.id}`)
    * settings.randomWeight);
