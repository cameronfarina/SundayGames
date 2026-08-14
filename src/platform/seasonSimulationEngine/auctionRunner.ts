import {
  applyGenericAuctionMockCommand,
  type GenericAuctionMockState,
} from "../genericAuctionMockEngine.js";
import {
  buildSeasonAuctionMockConfig,
  replaySeasonAuctionMockCommands,
} from "../seasonAuctionMock.js";
import type { ResolvedSeasonSimulationPreference } from "../seasonSimulationPreferences.js";
import type { SeasonSimulationTargetConstraint } from "../seasonSimulationTargets.js";
import type { ParsedSeasonSimulationStrategy } from "./contracts.js";
import { SeasonSimulationError } from "./contracts.js";
import { maximumDecisionsPerRun } from "./constants.js";
import { selectAuctionNomination } from "./auctionNomination.js";
import { auctionWillingnessFor } from "./auctionWillingness.js";

export const runAuctionSimulation = (input: {
  config: ReturnType<typeof buildSeasonAuctionMockConfig>;
  strategy: ParsedSeasonSimulationStrategy;
  preferences: readonly ResolvedSeasonSimulationPreference[];
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>;
  pairPlayerId: string | undefined;
  seed: string;
}): GenericAuctionMockState => {
  const config = {
    ...input.config,
    ai: {
      ...input.config.ai,
      spendPacingExcludedPlayerIds: [...input.targetsByPlayerId.keys()].filter(playerId =>
        input.config.players.some(player => player.id === playerId)
      ),
    },
  };
  let state = replaySeasonAuctionMockCommands(config, []);
  state = applyGenericAuctionMockCommand(state, { type: "start", expectedRevision: 0 });

  for (let decisions = 0; decisions < maximumDecisionsPerRun; decisions += 1) {
    if (state.session.status === "completed") return state;
    if (state.session.phase === "ready_to_complete") {
      state = applyGenericAuctionMockCommand(state, {
        type: "complete",
        expectedRevision: state.session.revision,
      });
      continue;
    }
    if (state.session.phase === "awaiting_human_nomination") {
      const player = selectAuctionNomination(
        state,
        input.targetsByPlayerId,
        input.pairPlayerId,
        input.preferences,
        input.seed,
      );
      const humanTeam = state.teams.find(team => team.id === state.configuration.humanTeamId);
      if (humanTeam === undefined) {
        throw new SeasonSimulationError("human_team_missing", "Claim a team before running simulations.");
      }
      state = applyGenericAuctionMockCommand(state, {
        type: "nominate",
        expectedRevision: state.session.revision,
        playerId: player.id,
        openingBid: state.configuration.minimumBidDollars,
      });
      continue;
    }
    const nomination = state.session.currentNomination;
    const humanTeam = state.teams.find(team => team.id === state.configuration.humanTeamId);
    const player = nomination === undefined
      ? undefined
      : state.board.players.find(candidate => candidate.id === nomination.playerId);
    if (nomination === undefined || humanTeam === undefined || player === undefined) {
      throw new SeasonSimulationError(
        "simulation_failed",
        "The auction engine did not expose a valid human decision.",
      );
    }
    const willingness = auctionWillingnessFor(
      state,
      humanTeam,
      player,
      input.targetsByPlayerId,
      input.pairPlayerId,
      input.strategy,
      input.preferences,
    );
    state = applyGenericAuctionMockCommand(state, nomination.nextBid <= willingness
      ? { type: "buy", expectedRevision: state.session.revision, price: nomination.nextBid }
      : { type: "pass", expectedRevision: state.session.revision });
  }

  throw new SeasonSimulationError(
    "simulation_failed",
    "The auction simulation exceeded its deterministic decision limit.",
  );
};
