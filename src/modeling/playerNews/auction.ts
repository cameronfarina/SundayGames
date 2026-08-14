import type { PlayerNewsAuctionLookup, PlayerNewsDraftContext } from "./internalContracts.js";
import { playerNewsKeyFor } from "./normalization.js";

export const playerNewsAuctionFor = (
  player: string,
  draftContext: PlayerNewsDraftContext,
): PlayerNewsAuctionLookup => {
  const key = playerNewsKeyFor(player);
  const target = draftContext.targetsByPlayer.get(key);
  const rosterEntry = draftContext.rosterByPlayer.get(key);
  const metadata = draftContext.metadataByPlayer.get(key);
  if (target) {
    return {
      target,
      auction: {
        status: "available",
        expectedPrice: target.expectedPrice,
        liveExpectedPrice: target.liveExpectedPrice,
        personalValue: target.personalValue,
        recommendedMaxBid: target.recommendedMaxBid,
        valueScore: target.valueScore,
        tags: [...(target.tags ?? [])],
      },
      availability: {
        status: "available",
        detail: `$${target.liveExpectedPrice} live / $${target.recommendedMaxBid} max`,
      },
    };
  }

  const event = draftContext.eventsByPlayer.get(key);
  if (event) {
    return {
      ...(rosterEntry ? { rosterPlayer: rosterEntry.player } : {}),
      ...(metadata ? { metadata } : {}),
      auction: { status: "drafted", tags: [] },
      availability: {
        status: "drafted",
        detail: `${event.owner} bought for $${event.price}`,
      },
    };
  }

  if (rosterEntry?.player.source === "keeper") {
    return {
      rosterPlayer: rosterEntry.player,
      ...(metadata ? { metadata } : {}),
      auction: { status: "keeper", tags: [] },
      availability: {
        status: "keeper",
        detail: `${rosterEntry.owner} keeper at $${rosterEntry.player.price}`,
      },
    };
  }

  return {
    ...(metadata ? { metadata } : {}),
    auction: { status: "unavailable", tags: [] },
    availability: {
      status: "unavailable",
      detail: "Outside the current auction pool",
    },
  };
};
