import type { FantasyTeam } from "../leagueSeason.js";
import type {
  HistoricalImportIdentityAudit,
  HistoricalOwnerMapping,
} from "./batchContracts.js";
import type { HistoricalOwnerResolutionCandidate } from "./playerContracts.js";
import {
  identityLabelsFuzzilyMatch,
  normalizeIdentityLabel,
} from "./identityNormalizer.js";

export interface HistoricalOwnerResolution {
  team: FantasyTeam | null;
  audit: HistoricalImportIdentityAudit;
}

const ownerCandidateFor = (team: FantasyTeam): HistoricalOwnerResolutionCandidate => ({
  teamId: team.id,
  teamDisplayName: team.displayName,
  ownerDisplayName: team.ownerDisplayName,
});

const identityLabelsFor = (team: FantasyTeam): readonly string[] => [
  team.ownerDisplayName,
  team.displayName,
  ...(team.abbreviation === undefined ? [] : [team.abbreviation]),
  ...(team.managerDisplayNames ?? []),
];

const uniqueTeams = (teams: readonly FantasyTeam[]): FantasyTeam[] =>
  [...new Map(teams.map(team => [team.id, team])).values()];

const resolvedOwner = (
  team: FantasyTeam,
  sourceOwnerOrTeamLabel: string,
  resolution: "exact" | "explicit" | "fuzzy",
): HistoricalOwnerResolution => ({
  team,
  audit: {
    sourceOwnerOrTeamLabel,
    resolution,
    mappedTeamId: team.id,
    mappedCurrentOwnerDisplayName: team.ownerDisplayName,
    mappedCurrentTeamDisplayName: team.displayName,
  },
});

const unresolvedOwner = (
  sourceOwnerOrTeamLabel: string,
  candidates: readonly FantasyTeam[],
  allTeams: readonly FantasyTeam[],
): HistoricalOwnerResolution => ({
  team: null,
  audit: {
    sourceOwnerOrTeamLabel,
    resolution: candidates.length > 1 ? "ambiguous" : "unresolved",
    candidates: (candidates.length > 0 ? candidates : allTeams).map(ownerCandidateFor),
  },
});

export const teamResolutionForOwner = (
  ownerDisplayName: string | undefined,
  teams: readonly FantasyTeam[],
  mappings: readonly HistoricalOwnerMapping[],
): HistoricalOwnerResolution => {
  const sourceOwnerOrTeamLabel = ownerDisplayName?.trim() ?? "";
  const normalizedOwner = normalizeIdentityLabel(sourceOwnerOrTeamLabel);
  if (normalizedOwner.length === 0) {
    return unresolvedOwner(sourceOwnerOrTeamLabel, [], teams);
  }

  const mappedTeamIds = new Set(
    mappings
      .filter(mapping => normalizeIdentityLabel(mapping.sourceOwnerOrTeamLabel) === normalizedOwner)
      .map(mapping => mapping.teamId),
  );
  if (mappedTeamIds.size > 0) {
    const mappedTeams = uniqueTeams(teams.filter(team => mappedTeamIds.has(team.id)));
    const mappedTeam = mappedTeams.length === 1 ? mappedTeams[0] : undefined;
    return mappedTeam === undefined
      ? unresolvedOwner(sourceOwnerOrTeamLabel, mappedTeams, teams)
      : resolvedOwner(mappedTeam, sourceOwnerOrTeamLabel, "explicit");
  }

  const exactTeams = uniqueTeams(teams.filter(team =>
    identityLabelsFor(team).some(label => normalizeIdentityLabel(label) === normalizedOwner)
  ));
  const exactTeam = exactTeams.length === 1 ? exactTeams[0] : undefined;
  if (exactTeam !== undefined) return resolvedOwner(exactTeam, sourceOwnerOrTeamLabel, "exact");
  if (exactTeams.length > 1) return unresolvedOwner(sourceOwnerOrTeamLabel, exactTeams, teams);

  const fuzzyTeams = uniqueTeams(teams.filter(team =>
    identityLabelsFor(team).some(label =>
      identityLabelsFuzzilyMatch(normalizedOwner, normalizeIdentityLabel(label))
    )
  ));
  const fuzzyTeam = fuzzyTeams.length === 1 ? fuzzyTeams[0] : undefined;
  return fuzzyTeam === undefined
    ? unresolvedOwner(sourceOwnerOrTeamLabel, fuzzyTeams, teams)
    : resolvedOwner(fuzzyTeam, sourceOwnerOrTeamLabel, "fuzzy");
};
