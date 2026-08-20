import type { FantasyTeam } from "../../../leagueSeason.js";
import type { StoredLeagueSnapshot } from "../../../leagueConnections.js";
import type { PlatformLeagueMembership } from "../../../leagueSetup.js";

interface ImportTeamMappingInput {
  existingTeams: readonly FantasyTeam[];
  generatedTeams: readonly FantasyTeam[];
  memberships: readonly PlatformLeagueMembership[];
  previousSnapshot: StoredLeagueSnapshot | null;
  snapshot: StoredLeagueSnapshot;
}

export type ImportTeamMappingResult =
  | { status: "ready"; existingByGeneratedIndex: readonly FantasyTeam[] }
  | { status: "needs_attention"; message: string };

const orderedTeams = (teams: readonly FantasyTeam[]): FantasyTeam[] =>
  [...teams].sort((left, right) =>
    left.draftOrderPosition - right.draftOrderPosition || left.id.localeCompare(right.id));

const normalized = (value: string): string => value.trim().toLowerCase().replace(/\s+/gu, " ");

const managerNames = (team: FantasyTeam): ReadonlySet<string> => new Set(
  [team.ownerDisplayName, ...(team.managerDisplayNames ?? [])].map(normalized).filter(Boolean),
);

const priorMapping = (
  existing: readonly FantasyTeam[],
  snapshot: StoredLeagueSnapshot,
  previousSnapshot: StoredLeagueSnapshot,
): readonly FantasyTeam[] | null => {
  const priorPosition = new Map(
    previousSnapshot.teams.map((team, index) => [team.providerTeamId, index]),
  );
  const mapped = snapshot.teams.map(team => {
    const index = priorPosition.get(team.providerTeamId);
    return index === undefined ? undefined : existing[index];
  });
  return mapped.some(team => team === undefined)
    ? null
    : mapped as readonly FantasyTeam[];
};

export const existingTeamsForImport = ({
  existingTeams,
  generatedTeams,
  memberships,
  previousSnapshot,
  snapshot,
}: ImportTeamMappingInput): ImportTeamMappingResult => {
  if (existingTeams.length !== generatedTeams.length || snapshot.teams.length !== generatedTeams.length) {
    return { status: "needs_attention", message: "The selected league has a different number of teams." };
  }

  const existing = orderedTeams(existingTeams);
  if (previousSnapshot !== null) {
    const mapped = priorMapping(existing, snapshot, previousSnapshot);
    return mapped === null
      ? { status: "needs_attention", message: "The provider team list changed. Review team assignments before overwriting this league." }
      : { status: "ready", existingByGeneratedIndex: mapped };
  }

  const claimedIds = new Set(memberships.flatMap(membership =>
    membership.teamId === undefined ? [] : [membership.teamId]));
  if (claimedIds.size === 0) return { status: "ready", existingByGeneratedIndex: existing };

  const mapped: Array<FantasyTeam | undefined> = Array.from({ length: generatedTeams.length });
  const used = new Set<string>();
  const matchUnique = (index: number, candidates: readonly FantasyTeam[]): void => {
    const available = candidates.filter(team => !used.has(team.id));
    if (available.length !== 1) return;
    const matched = available[0];
    if (matched === undefined) return;
    mapped[index] = matched;
    used.add(matched.id);
  };

  snapshot.teams.forEach((team, index) => {
    const name = normalized(team.name);
    matchUnique(index, existing.filter(candidate => normalized(candidate.displayName) === name));
  });
  snapshot.teams.forEach((team, index) => {
    if (mapped[index] !== undefined) return;
    const owners = new Set(team.ownerNames.map(normalized).filter(Boolean));
    if (owners.size === 0) return;
    matchUnique(index, existing.filter(candidate =>
      [...managerNames(candidate)].some(name => owners.has(name))));
  });

  const unmatchedClaim = existing.find(team => claimedIds.has(team.id) && !used.has(team.id));
  if (unmatchedClaim !== undefined) {
    return {
      status: "needs_attention",
      message: `Sunday Games could not safely match the claimed team “${unmatchedClaim.displayName}”. Rename it to match the provider league or import into a new league.`,
    };
  }

  const remainingExisting = existing.filter(team => !used.has(team.id));
  let cursor = 0;
  for (let index = 0; index < mapped.length; index += 1) {
    if (mapped[index] !== undefined) continue;
    mapped[index] = remainingExisting[cursor];
    cursor += 1;
  }
  return { status: "ready", existingByGeneratedIndex: mapped as readonly FantasyTeam[] };
};
