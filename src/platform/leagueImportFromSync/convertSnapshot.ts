import type { ConfirmedLeagueTeamInput } from "../leagueCreation.js";
import {
  providerLabelFor,
  type LeagueImportConversion,
  type LeagueImportSource,
} from "./contracts.js";
import { importedDraft } from "./draft.js";
import { importedRosterSlots } from "./rosterSlots.js";
import { importedScoring } from "./scoring.js";

const minimumTeamCount = 4;
const maximumTeamCount = 20;
const seasonYearPattern = /^\d{4}$/u;

const seasonYearFor = (season: string, label: string, issues: string[]): number => {
  if (seasonYearPattern.test(season.trim())) return Number(season.trim());
  issues.push(`${label} did not name the season this league plays in.`);
  return 0;
};

const teamCountFor = (teamCount: number, issues: string[]): number => {
  if (Number.isInteger(teamCount) && teamCount >= minimumTeamCount && teamCount <= maximumTeamCount) {
    return teamCount;
  }
  issues.push(
    `This league has ${teamCount} teams, and Sunday Games leagues run ` +
    `${minimumTeamCount} to ${maximumTeamCount}.`,
  );
  return teamCount;
};

const importedTeams = (source: LeagueImportSource): readonly ConfirmedLeagueTeamInput[] =>
  source.teams.map(team => ({
    externalTeamId: team.providerTeamId,
    displayName: team.name,
    ...(team.ownerNames.length === 0 ? {} : { managerNames: [...team.ownerNames] }),
  }));

/**
 * Turns a stored snapshot into the same confirmed setup the league wizard
 * submits, so an imported league is an ordinary Sunday Games league. Every
 * check that fails adds an issue and the rest still run: the owner sees
 * everything they have to settle, not just the first thing.
 */
export const leagueImportConversion = (source: LeagueImportSource): LeagueImportConversion => {
  const label = providerLabelFor(source.provider);
  const roster = importedRosterSlots(source.settings.rosterPositions, source.provider);
  const draft = importedDraft(source, roster.draftCapacity);
  const scoring = importedScoring(source.settings.scoring);
  const issues = [...roster.issues, ...draft.issues, ...scoring.issues];
  const seasonYear = seasonYearFor(source.settings.season, label, issues);
  const expectedTeamCount = teamCountFor(source.settings.teamCount, issues);
  const keeperCount = source.settings.keeperCount;

  if (issues.length > 0 || draft.draft === null) return { status: "blocked", issues };

  return {
    status: "ready",
    input: {
      provider: source.provider,
      externalLeagueId: source.providerLeagueId,
      leagueName: source.settings.name,
      seasonYear,
      expectedTeamCount,
      keeperLeague: keeperCount !== undefined && keeperCount > 0,
      teams: importedTeams(source),
      draft: draft.draft,
      scoring: scoring.scoring,
      rosterSlots: roster.rosterSlots,
    },
  };
};
