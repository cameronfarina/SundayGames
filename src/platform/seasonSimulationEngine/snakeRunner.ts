import {
  applySnakeDraftCommand,
  type SnakeDraftBoardPlayer,
  type SnakeDraftState,
  type SnakeDraftTeamReadModel,
} from "../snakeDraftEngine.js";
import {
  buildSeasonSnakeMockConfig,
  replaySeasonSnakeMockCommands,
} from "../seasonSnakeMock.js";
import {
  activePositionPreferenceFor,
  type ResolvedSeasonSimulationPreference,
} from "../seasonSimulationPreferences.js";
import type { SeasonSimulationTargetConstraint } from "../seasonSimulationTargets.js";
import { SeasonSimulationError } from "./contracts.js";
import { deterministicFraction, maximumDecisionsPerRun } from "./constants.js";

const snakeRosterNeedFor = (
  team: SnakeDraftTeamReadModel,
  position: string,
): number => team.slots
  .filter(slot => slot.playerId === undefined && slot.eligiblePositions.includes(position))
  .reduce((total, slot) => total + (1 / slot.eligiblePositions.length), 0);

const selectSnakePlayer = (
  state: SnakeDraftState,
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>,
  pairPlayerId: string | undefined,
  preferences: readonly ResolvedSeasonSimulationPreference[],
  seed: string,
): SnakeDraftBoardPlayer => {
  const humanTeam = state.teams.find(team => team.id === state.configuration.humanTeamId);
  const currentPick = state.session.currentPick;
  if (humanTeam === undefined) {
    throw new SeasonSimulationError("human_team_missing", "Claim a team before running simulations.");
  }
  if (currentPick === undefined) {
    throw new SeasonSimulationError("simulation_failed", "The snake engine did not expose a human pick.");
  }
  const selected = state.board.players
    .filter(player => player.available && humanTeam.slots.some(slot =>
      slot.playerId === undefined && slot.eligiblePositions.includes(player.position)
    ))
    .map(player => {
      const target = targetsByPlayerId.get(player.id);
      const targetDeadlineAllowsPick = target !== undefined
        && (target.maxSnakeRound === undefined || currentPick.round <= target.maxSnakeRound)
        && (target.maxSnakeOverallPick === undefined || currentPick.overall <= target.maxSnakeOverallPick);
      return {
        player,
        score: (targetDeadlineAllowsPick ? 1_000_000 : 0)
          + (player.id === pairPlayerId ? 100_000 : 0)
          + (activePositionPreferenceFor(
            preferences,
            humanTeam.roster,
            player,
            pairPlayerId,
          ) ? 10_000 : 0)
          + snakeRosterNeedFor(humanTeam, player.position) * 100
          - (player.personalRank ?? player.leagueExpectedPick ?? player.rank)
          + deterministicFraction(`${seed}:pick:${currentPick.overall}:${player.id}`) * 0.001,
      };
    })
    .sort((left, right) =>
      right.score - left.score || left.player.id.localeCompare(right.player.id)
    )[0]?.player;
  if (selected === undefined) {
    throw new SeasonSimulationError(
      "simulation_failed",
      "The claimed team cannot fill its remaining snake roster from the available players.",
    );
  }

  return selected;
};
export const runSnakeSimulation = (input: {
  config: ReturnType<typeof buildSeasonSnakeMockConfig>;
  preferences: readonly ResolvedSeasonSimulationPreference[];
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>;
  pairPlayerId: string | undefined;
  seed: string;
}): SnakeDraftState => {
  let state = replaySeasonSnakeMockCommands(input.config, []);
  state = applySnakeDraftCommand(state, { type: "start", expectedRevision: 0 });

  for (let decisions = 0; decisions < maximumDecisionsPerRun; decisions += 1) {
    if (state.session.status === "completed") return state;
    if (state.session.canComplete) {
      state = applySnakeDraftCommand(state, {
        type: "complete",
        expectedRevision: state.session.revision,
      });
      continue;
    }
    const player = selectSnakePlayer(
      state,
      input.targetsByPlayerId,
      input.pairPlayerId,
      input.preferences,
      input.seed,
    );
    state = applySnakeDraftCommand(state, {
      type: "pick",
      expectedRevision: state.session.revision,
      playerId: player.id,
    });
  }

  throw new SeasonSimulationError(
    "simulation_failed",
    "The snake simulation exceeded its deterministic decision limit.",
  );
};
