import type { LeagueSeason } from "../../../leagueSeason.js";
import type { LiveDraftRoom } from "../../../liveDraftRooms.js";
import type { LiveDraftRoomSetup, LiveDraftRoomSetupRepository } from "../../../liveDraftRoomSetups.js";
import type { RebuildLeaguePricingWorkflowResult } from "../../../platformPricingWorkflow.js";
import type { PlatformApp } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import {
  liveRoomCatalogForSeason,
  playerCatalogWithPricingSnapshot,
  rebuildPricingAfterKeeperChange,
  synchronizeUnopenedLiveRoomAfterKeeperChange,
} from "./pricingOrchestration.js";

const saveKeeperSetupAndSynchronizeLiveRoom = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  season: LeagueSeason,
  repository: LiveDraftRoomSetupRepository,
  previous: LiveDraftRoomSetup,
  proposed: LiveDraftRoomSetup,
  expectedContentHash: string | null,
  proposedRoomCatalog: Parameters<typeof synchronizeUnopenedLiveRoomAfterKeeperChange>[4],
): Promise<{ saved: LiveDraftRoomSetup; room: LiveDraftRoom | null }> => {
  const saved = await repository.save(proposed, { expectedContentHash });
  try {
    return {
      saved,
      room: await synchronizeUnopenedLiveRoomAfterKeeperChange(
        app,
        request,
        season,
        saved,
        proposedRoomCatalog,
      ),
    };
  } catch (error) {
    await repository.save(previous, { expectedContentHash: saved.contentHash });
    throw error;
  }
};

export const persistKeeperSetupChange = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  season: LeagueSeason,
  repository: LiveDraftRoomSetupRepository,
  previous: LiveDraftRoomSetup,
  proposed: LiveDraftRoomSetup,
  expectedContentHash: string | null,
): Promise<{
  saved: LiveDraftRoomSetup;
  room: LiveDraftRoom | null;
  pricing: RebuildLeaguePricingWorkflowResult | undefined;
}> => {
  const previousRoomCatalog = await liveRoomCatalogForSeason(app, request, season, previous);
  const pricingPreflight = await rebuildPricingAfterKeeperChange(app, request, season, proposed, { preflight: true });
  const proposedRoomCatalog = playerCatalogWithPricingSnapshot(proposed.playerCatalog, pricingPreflight?.snapshots.at(-1));
  const { saved, room } = await saveKeeperSetupAndSynchronizeLiveRoom(
    app,
    request,
    season,
    repository,
    previous,
    proposed,
    expectedContentHash,
    proposedRoomCatalog,
  );
  try {
    const pricingResult = await rebuildPricingAfterKeeperChange(app, request, season, saved);
    if (pricingResult !== undefined && !("savedSnapshotIds" in pricingResult)) {
      throw new Error("Keeper pricing rebuild returned an uncommitted preview.");
    }
    return { saved, room, pricing: pricingResult };
  } catch (error) {
    if (room !== null) {
      await synchronizeUnopenedLiveRoomAfterKeeperChange(
        app,
        request,
        season,
        previous,
        previousRoomCatalog,
        `keepers-rollback:${saved.contentHash}:${previous.contentHash}`,
        room.revision,
      );
    }
    await repository.save(previous, { expectedContentHash: saved.contentHash });
    throw error;
  }
};
