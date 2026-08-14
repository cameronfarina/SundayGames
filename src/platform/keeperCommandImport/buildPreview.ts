import type { ParsedKeeperCommand, ResolutionCandidate } from "./internalTypes.js";
import type {
  KeeperCommandPlayerCatalogEntry,
  KeeperCommandPreview,
  KeeperCommandTeamCatalogEntry,
  ParseKeeperCommandInput,
} from "./types.js";

export const buildPreview = (
  input: ParseKeeperCommandInput,
  parsed: ParsedKeeperCommand,
  team: ResolutionCandidate<KeeperCommandTeamCatalogEntry>,
  player: ResolutionCandidate<KeeperCommandPlayerCatalogEntry>,
): KeeperCommandPreview => ({
  kind: "preview",
  confirmationRequired: true,
  sourceCommand: parsed.sourceCommand,
  team: {
    id: team.entry.teamId,
    name: team.entry.teamName,
  },
  player: {
    id: player.entry.playerId,
    name: player.entry.name,
  },
  keeper: input.draftType === "auction"
    ? {
        draftType: "auction",
        auctionCostDollars: parsed.trailingValue,
      }
    : {
        draftType: "snake",
        keeperRound: parsed.trailingValue,
      },
});
