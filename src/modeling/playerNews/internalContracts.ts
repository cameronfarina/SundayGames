import type {
  PlayerNewsAuctionSnapshot,
  PlayerNewsAvailability,
  PlayerNewsDraftEvent,
  PlayerNewsDraftTarget,
  PlayerNewsPlayerMetadata,
  PlayerNewsRosterPlayer,
} from "./draftContracts.js";

export interface PlayerNewsDraftContext {
  targetsByPlayer: Map<string, PlayerNewsDraftTarget>;
  eventsByPlayer: Map<string, PlayerNewsDraftEvent>;
  rosterByPlayer: Map<string, { owner: string; player: PlayerNewsRosterPlayer }>;
  metadataByPlayer: Map<string, PlayerNewsPlayerMetadata>;
}

export interface PlayerNewsAuctionLookup {
  auction: PlayerNewsAuctionSnapshot;
  availability: PlayerNewsAvailability;
  target?: PlayerNewsDraftTarget;
  rosterPlayer?: PlayerNewsRosterPlayer;
  metadata?: PlayerNewsPlayerMetadata;
}
