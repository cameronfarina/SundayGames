import type { ImportLeagueRequest } from "../api/leagueConnectionsApi";

export type ImportMode = "create" | "overwrite";

/**
 * Undefined means the choice is not finished yet: replacing a league nobody
 * picked would be a guess, and this import rewrites a whole season.
 */
export const importRequest = (
  mode: ImportMode,
  seasonId: string | undefined,
): ImportLeagueRequest | undefined => {
  if (mode === "create") return { mode: "create" };
  return seasonId === undefined ? undefined : { mode: "overwrite", seasonId };
};
