import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type { ResolutionCandidate } from "./internalTypes.js";
import type { KeeperCommandPlayerCatalogEntry } from "./types.js";

export const playerCandidatesFor = (
  catalog: readonly KeeperCommandPlayerCatalogEntry[],
): ResolutionCandidate<KeeperCommandPlayerCatalogEntry>[] =>
  catalog.map(player => {
    const normalizedName = canonicalPlayerIdentityKey(player.name);
    const nameParts = normalizedName.split(" ").filter(Boolean);
    const firstName = nameParts[0];
    const surname = nameParts[nameParts.length - 1];

    return {
      id: player.playerId,
      label: player.name,
      entry: player,
      aliases: new Set([
        normalizedName,
        ...(firstName === undefined ? [] : [firstName]),
        ...(surname === undefined ? [] : [surname]),
        ...(player.aliases ?? []).map(canonicalPlayerIdentityKey),
      ].filter(Boolean)),
    };
  });
