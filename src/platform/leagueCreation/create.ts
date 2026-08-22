import { randomUUID } from "node:crypto";
import { assessLeagueSeasonReadiness, type AnyLeagueSeason } from "../leagueSeason.js";
import { LeagueCreationError } from "./errors.js";
import { settingsFor } from "./settings.js";
import { createTeams } from "./teams.js";
import type { ConfirmedLeagueCreationInput } from "./types.js";
import { positiveInteger, requiredText } from "./validation.js";

export const createLeagueSeasonFromConfirmedSetup = (
  input: ConfirmedLeagueCreationInput,
  createId: () => string = randomUUID,
): AnyLeagueSeason => {
  const leagueName = requiredText(input.leagueName, "League name");
  const externalLeagueId = requiredText(input.externalLeagueId, "External league ID");
  const expectedTeamCount = positiveInteger(input.expectedTeamCount, "Team count");
  const seasonYear = positiveInteger(input.seasonYear, "Season");
  if (input.teams.length !== expectedTeamCount) {
    throw new LeagueCreationError(`Expected ${expectedTeamCount} teams, but received ${input.teams.length}.`);
  }

  const leagueId = `league-${createId()}`;
  const seasonId = `season-${createId()}`;
  const createdTeams = createTeams(input.teams, input.draft, seasonId, createId);
  const season: AnyLeagueSeason = {
    id: seasonId,
    league: {
      id: leagueId,
      externalLeagueId,
      name: leagueName,
      provider: input.provider,
    },
    leagueId,
    seasonYear,
    teams: createdTeams.teams,
    settings: settingsFor(input, createdTeams.teamIdByExternalId),
    setupStatus: "draft",
  };
  const readiness = assessLeagueSeasonReadiness(season);
  if (readiness.blockers.length > 0) {
    throw new LeagueCreationError(readiness.blockers[0] ?? "League setup is invalid.");
  }
  return season;
};
