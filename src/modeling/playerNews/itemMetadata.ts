import type { PlayerNewsItem } from "./feedContracts.js";
import type { PlayerNewsAuctionLookup } from "./internalContracts.js";

export const playerNewsItemMetadataFor = (
  market: Pick<PlayerNewsAuctionLookup, "target" | "rosterPlayer" | "metadata">,
): Pick<PlayerNewsItem, "position" | "teamAbbreviation"> => {
  const metadata = market.target ?? market.rosterPlayer ?? market.metadata;
  return {
    ...(metadata?.position ? { position: metadata.position } : {}),
    ...(metadata?.teamAbbreviation ? { teamAbbreviation: metadata.teamAbbreviation } : {}),
  };
};
