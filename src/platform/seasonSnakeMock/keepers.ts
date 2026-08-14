import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type { LiveDraftRoomSetup } from "../liveDraftRoomSetups/contracts.js";
import type { SnakeDraftConfig, SnakeDraftKeeperPlacement } from "../snakeDraftEngine/config.js";
import { createSnakeDraftState } from "../snakeDraftEngine/stateFactory.js";
import { SeasonSnakeMockError } from "./errors.js";

export const snakeKeepersFor = (
  config: SnakeDraftConfig,
  setup: LiveDraftRoomSetup,
): readonly SnakeDraftKeeperPlacement[] => {
  const scheduledPicks = createSnakeDraftState(config).board.picks;
  return setup.initialRosters
    .filter(player => player.source === "keeper")
    .map(keeper => {
      const keeperRound = keeper.keeperRound;
      if (keeperRound === undefined || !Number.isInteger(keeperRound) || keeperRound <= 0) {
        throw new SeasonSnakeMockError(
          "keeper_round_missing",
          `${keeper.playerName} needs a keeper round before starting this snake mock.`,
        );
      }
      const pick = scheduledPicks.find(candidate =>
        candidate.round === keeperRound && candidate.teamId === keeper.teamId
      );
      if (pick === undefined) {
        throw new SeasonSnakeMockError(
          "keeper_round_missing",
          `${keeper.playerName} does not have a valid keeper pick in round ${keeperRound}.`,
        );
      }
      return {
        teamId: keeper.teamId,
        playerId: keeper.playerId ?? canonicalPlayerIdentityKey(keeper.playerName),
        round: keeperRound,
        pickInRound: pick.pickInRound,
      };
    });
};
