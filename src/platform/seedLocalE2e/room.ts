import type { LeagueSeason } from "../leagueSeason.js";
import type { LiveDraftRoom } from "../liveDraftRooms.js";
import {
  currentLeagueInitialRostersFor,
  loadLocalDemoPlayerCatalog,
  localDemoRoomId,
} from "../localDemoFixtures.js";
import type {
  LocalE2eSeedPlatformApp,
  SeedLocalE2eAccount,
  SeedLocalE2eOptions,
  SeedLocalE2eRoomSummary,
} from "./contracts.js";

const findSeedRoom = async (
  app: LocalE2eSeedPlatformApp,
  sessionToken: string,
): Promise<LiveDraftRoom | null> => {
  try {
    return await app.getLiveDraftRoom({ actorSessionToken: sessionToken, roomId: localDemoRoomId });
  } catch (error) {
    const code = error !== null && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
    if (code === "room_not_found") return null;
    throw error;
  }
};

export const ensureSeedRoom = async (
  app: LocalE2eSeedPlatformApp,
  season: LeagueSeason,
  commissioner: SeedLocalE2eAccount,
  options: Pick<SeedLocalE2eOptions, "initialRosters" | "playerCatalog">,
  now: Date,
): Promise<LiveDraftRoom> => {
  const existing = await findSeedRoom(app, commissioner.sessionToken);
  if (existing !== null) {
    if (existing.status === "ended") {
      throw new Error(`Local E2E room ${localDemoRoomId} has ended. Remove it before reseeding.`);
    }
    if (existing.status === "live") return existing;
    return await app.startLiveDraftRoom({
      actorSessionToken: commissioner.sessionToken,
      roomId: existing.roomId,
      expectedRevision: existing.revision,
      idempotencyKey: `${localDemoRoomId}:start`,
      now,
    });
  }
  const created = await app.createLiveDraftRoom({
    actorSessionToken: commissioner.sessionToken,
    seasonId: season.id,
    roomId: localDemoRoomId,
    viewerPasswordHashRef: "local-e2e-viewer-password",
    playerCatalog: options.playerCatalog ?? await loadLocalDemoPlayerCatalog(),
    initialRosters: options.initialRosters ?? currentLeagueInitialRostersFor(season),
    now,
  });
  return await app.startLiveDraftRoom({
    actorSessionToken: commissioner.sessionToken,
    roomId: created.roomId,
    expectedRevision: created.revision,
    idempotencyKey: `${localDemoRoomId}:start`,
    now: new Date(now.getTime() + 1_000),
  });
};

export const roomSummaryFor = (room: LiveDraftRoom): SeedLocalE2eRoomSummary => ({
  roomId: room.roomId,
  status: room.status,
  revision: room.revision,
  boardCount: room.projection.board.length,
  catalogCount: room.playerCatalog.length,
  initialRosterCount: room.initialRosters.length,
});
