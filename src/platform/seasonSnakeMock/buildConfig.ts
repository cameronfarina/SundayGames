import type { SnakeDraftConfig } from "../snakeDraftEngine/config.js";
import type { BuildSeasonSnakeMockConfigInput } from "./contracts.js";
import { SeasonSnakeMockError } from "./errors.js";
import { snakeKeepersFor } from "./keepers.js";
import { snakePlayersFor } from "./players.js";
import { snakeRosterSlotsFor } from "./rosterConfig.js";

export const buildSeasonSnakeMockConfig = ({
  season,
  setup,
  humanTeamId,
  sessionId,
  seed,
}: BuildSeasonSnakeMockConfigInput): SnakeDraftConfig => {
  if (season.settings.draftFormat !== "snake") {
    throw new SeasonSnakeMockError("wrong_draft_format", "This mock session is not a snake draft.");
  }
  if (setup.seasonId !== season.id) {
    throw new SeasonSnakeMockError("setup_mismatch", "Snake mock setup does not belong to this season.");
  }
  if (!season.teams.some(team => team.id === humanTeamId)) {
    throw new SeasonSnakeMockError(
      "human_team_missing",
      "Claim a team before starting a snake mock draft.",
    );
  }

  const snake = season.settings.snake;
  // The commissioner edits draft order on the team rows, so the teams carry the
  // current order. settings.snake.order only holds the order set at creation.
  const teamOrder = [...season.teams]
    .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition)
    .map(team => team.id);
  const baseConfig: SnakeDraftConfig = {
    sessionId,
    seed,
    rounds: snake.rounds,
    orderType: snake.reversal === "third-round" ? "third_round_reversal" : "standard",
    teamOrder,
    humanTeamId,
    teams: season.teams.map(team => ({ id: team.id, name: team.displayName })),
    rosterSlots: snakeRosterSlotsFor(season, snake),
    players: snakePlayersFor(setup),
  };
  return { ...baseConfig, keepers: snakeKeepersFor(baseConfig, setup) };
};
