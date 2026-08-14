import type { LeagueSeason } from "../leagueSeason.js";
import type { LiveDraftRoomSetup, SaveLiveDraftRoomSetupInput } from "../liveDraftRoomSetups.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../liveDraftRooms.js";
import type { KeeperCommandErrorResult, KeeperCommandPreview } from "../keeperCommandImport.js";

export interface SeasonKeeperCommandPreview extends KeeperCommandPreview {
  player: KeeperCommandPreview["player"] & {
    position: LiveDraftRoomPlayerCatalogEntry["position"];
    expectedPrice: number;
  };
}

export type SeasonKeeperCommandResult = SeasonKeeperCommandPreview | KeeperCommandErrorResult;

export interface PreviewSeasonKeeperCommandInput {
  season: LeagueSeason;
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
  command: string;
}

export interface ApplySeasonKeeperCommandInput {
  season: LeagueSeason;
  setup: LiveDraftRoomSetup | SaveLiveDraftRoomSetupInput;
  preview: SeasonKeeperCommandPreview;
  now?: Date | undefined;
}
