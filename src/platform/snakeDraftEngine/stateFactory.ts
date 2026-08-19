import type { SnakeDraftConfig } from "./config.js";
import { assertConfiguration } from "./configuration.js";
import { buildPicks } from "./draftOrder.js";
import type { SnakeDraftState } from "./readModels.js";
import { buildRosterSlots } from "./rosterSlots.js";

export const createSnakeDraftState = (config: SnakeDraftConfig): SnakeDraftState => {
  assertConfiguration(config);

  return {
    configuration: config,
    session: {
      id: config.sessionId,
      status: "setup",
      revision: 0,
      seed: config.seed,
      rounds: config.rounds,
      teamOrder: [...config.teamOrder],
      humanTeamId: config.humanTeamId,
      currentPick: undefined,
      canUndo: false,
      canComplete: false,
      commandLog: [],
    },
    board: {
      picks: buildPicks(config),
      players: config.players.map(player => ({
        ...player,
        leagueExpectedPick: player.leagueExpectedPick ?? player.adp,
        personalRank: player.personalRank,
        reachLimit: player.reachLimit,
        available: true,
      })),
    },
    teams: config.teams.map(team => ({
      id: team.id,
      name: team.name,
      roster: [],
      slots: buildRosterSlots(config.rosterSlots),
    })),
  };
};
