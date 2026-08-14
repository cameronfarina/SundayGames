import { duplicateIndexes, normalizedKey } from "./normalization.js";
import type { LeagueMembersScreenshotImportInput } from "./types.js";

export interface ScreenshotDuplicates {
  positions: ReadonlySet<number>;
  teamNames: ReadonlySet<number>;
  managerNames: ReadonlySet<string>;
  teamMappings: ReadonlySet<number>;
}

const duplicatePositionsFor = (input: LeagueMembersScreenshotImportInput): ReadonlySet<number> => {
  const counts = new Map<number, number>();
  input.teams.forEach(team => counts.set(
    team.draftOrderPosition,
    (counts.get(team.draftOrderPosition) ?? 0) + 1,
  ));
  return new Set([...counts].filter(([, count]) => count > 1).map(([position]) => position));
};

const duplicateManagersFor = (input: LeagueMembersScreenshotImportInput): ReadonlySet<string> => {
  const teamIndexes = new Map<string, Set<number>>();
  input.teams.forEach((team, teamIndex) => team.managerDisplayNames.forEach(manager => {
    const key = normalizedKey(manager);
    if (key.length === 0) return;
    const indexes = teamIndexes.get(key) ?? new Set<number>();
    indexes.add(teamIndex);
    teamIndexes.set(key, indexes);
  }));
  return new Set(
    [...teamIndexes].filter(([, indexes]) => indexes.size > 1).map(([manager]) => manager),
  );
};

export const duplicatesFor = (input: LeagueMembersScreenshotImportInput): ScreenshotDuplicates => ({
  positions: duplicatePositionsFor(input),
  teamNames: duplicateIndexes(input.teams.map(team => team.teamDisplayName)),
  managerNames: duplicateManagersFor(input),
  teamMappings: duplicateIndexes(input.teams.map(team => team.targetTeamId ?? "")),
});
