import type { ResolutionCandidate } from "./internalTypes.js";
import type { KeeperCommandErrorResult } from "./types.js";

export const resolutionError = <T>(
  entity: "team" | "player",
  mention: string,
  matches: readonly ResolutionCandidate<T>[],
): KeeperCommandErrorResult => {
  if (matches.length === 0) {
    return {
      kind: "error",
      error: {
        code: entity === "team" ? "unknown_team" : "unknown_player",
        message: entity === "team"
          ? `No team or manager matched "${mention}".`
          : `No player matched "${mention}".`,
        mention,
      },
    };
  }

  return {
    kind: "error",
    error: {
      code: entity === "team" ? "ambiguous_team" : "ambiguous_player",
      message: entity === "team"
        ? `"${mention}" matched multiple teams or managers.`
        : `"${mention}" matched multiple players.`,
      mention,
      candidates: matches.map(match => match.label),
    },
  };
};
