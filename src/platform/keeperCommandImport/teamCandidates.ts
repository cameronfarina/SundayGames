import type { KeeperCommandTeamCatalogEntry } from "./types.js";
import type { ResolutionCandidate } from "./internalTypes.js";
import { namePartAliases, normalizedIdentity } from "./normalization.js";

export const teamCandidatesFor = (
  catalog: readonly KeeperCommandTeamCatalogEntry[],
): ResolutionCandidate<KeeperCommandTeamCatalogEntry>[] =>
  catalog.map(team => ({
    id: team.teamId,
    label: team.teamName,
    entry: team,
    aliases: new Set([
      normalizedIdentity(team.teamName),
      ...team.managerNames.flatMap(namePartAliases),
      ...(team.aliases ?? []).map(normalizedIdentity),
    ].filter(Boolean)),
  }));
