import type { LeagueSeason } from "../leagueSeason.js";
import { normalizedKey } from "./normalization.js";
import type {
  ExistingScreenshotTeam,
  LeagueMembersScreenshotImportInput,
  LeagueMembersScreenshotTeamInput,
} from "./types.js";

const profileCandidatesFor = (
  team: LeagueMembersScreenshotTeamInput,
  existingTeams: readonly ExistingScreenshotTeam[],
): readonly string[] => {
  const managerKeys = team.managerDisplayNames.map(normalizedKey);
  const managerTokens = new Set(managerKeys.flatMap(manager => manager.split(/\s+/u)));
  const abbreviationKey = normalizedKey(team.abbreviation);
  const teamNameKey = normalizedKey(team.teamDisplayName);

  return existingTeams.filter(existingTeam => {
    const ownerKey = normalizedKey(existingTeam.ownerDisplayName);
    const existingAbbreviationKey = normalizedKey(existingTeam.abbreviation ?? "");
    const existingTeamNameKey = normalizedKey(existingTeam.displayName);
    return managerKeys.includes(ownerKey)
      || (!ownerKey.includes(" ") && managerTokens.has(ownerKey))
      || (abbreviationKey.length > 0 && abbreviationKey === existingAbbreviationKey)
      || (teamNameKey.length > 0 && teamNameKey === existingTeamNameKey);
  }).map(existingTeam => existingTeam.id);
};

export const suggestLeagueMembersScreenshotTeamMappings = (
  input: LeagueMembersScreenshotImportInput,
  season: Pick<LeagueSeason, "teams">,
): LeagueMembersScreenshotImportInput => {
  const candidates = input.teams.map(team => profileCandidatesFor(team, season.teams));
  const singleCandidateCounts = new Map<string, number>();
  candidates.forEach(teamCandidates => {
    if (teamCandidates.length !== 1) return;
    const candidate = teamCandidates[0] ?? "";
    singleCandidateCounts.set(candidate, (singleCandidateCounts.get(candidate) ?? 0) + 1);
  });

  return {
    ...input,
    teams: input.teams.map((team, index) => {
      const teamCandidates = candidates[index] ?? [];
      const candidate = teamCandidates.length === 1 ? teamCandidates[0] : undefined;
      return {
        ...team,
        targetTeamId: candidate !== undefined && singleCandidateCounts.get(candidate) === 1
          ? candidate
          : null,
      };
    }),
  };
};
