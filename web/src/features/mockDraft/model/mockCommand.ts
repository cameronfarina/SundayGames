import type { AuctionCommand } from "../api/auctionStateSchemas.js";
import type { SnakeCommand } from "../api/snakeStateSchemas.js";

export type MockCommandIntent =
  | { readonly type: "start" }
  | { readonly type: "nominate"; readonly playerId: string; readonly openingBid?: number }
  | { readonly type: "buy"; readonly price: number }
  | { readonly type: "pass" }
  | { readonly type: "pick"; readonly playerId: string }
  | { readonly type: "undo" }
  | { readonly type: "complete" };

export const mockCommand = (
  intent: MockCommandIntent,
  expectedRevision: number,
): AuctionCommand | SnakeCommand => {
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
    case "pick": return { type: "pick", expectedRevision, playerId: intent.playerId };
    case "undo": return { type: "undo", expectedRevision };
    case "complete": return { type: "complete", expectedRevision };
  }
};
