export type GenericAuctionMockCommand =
  | { type: "start"; expectedRevision: number }
  | {
    type: "nominate";
    expectedRevision: number;
    playerId: string;
    openingBid?: number | undefined;
  }
  | { type: "buy"; expectedRevision: number; price: number }
  | { type: "pass"; expectedRevision: number }
  | { type: "undo"; expectedRevision: number }
  | { type: "complete"; expectedRevision: number };
