import type { AuctionCommand } from "../api/auctionStateSchemas.js";

export type AuctionCommandIntent =
  | { readonly type: "start" }
  | { readonly type: "nominate"; readonly playerId: string; readonly openingBid?: number }
  | { readonly type: "buy"; readonly price: number }
  | { readonly type: "pass" }
  | { readonly type: "undo" }
  | { readonly type: "complete" };

export const auctionCommand = (
  intent: AuctionCommandIntent,
  expectedRevision: number,
): AuctionCommand => {
  switch (intent.type) {
    case "start": return { type: "start", expectedRevision };
    case "nominate": return {
      type: "nominate",
      expectedRevision,
      playerId: intent.playerId,
      ...(intent.openingBid === undefined ? {} : { openingBid: intent.openingBid }),
    };
    case "buy": return { type: "buy", expectedRevision, price: intent.price };
    case "pass": return { type: "pass", expectedRevision };
    case "undo": return { type: "undo", expectedRevision };
    case "complete": return { type: "complete", expectedRevision };
  }
};
