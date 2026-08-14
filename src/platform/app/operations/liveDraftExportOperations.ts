import { generateDraftExport, type DraftExportResult } from "../../draftExport.js";
import {
  createDraftExportArtifact,
  type DraftExportArtifactResult,
} from "../../exportArtifacts.js";
import type {
  CreatePlatformLiveDraftExportArtifactInput,
  ExportPlatformLiveDraftRoomInput,
} from "../contracts/liveDraft.js";
import type { PlatformAppContext } from "../context.js";
import { PlatformAppError } from "../errors.js";
import { exportTeamStateFor } from "../liveDraftHelpers.js";
import { cloneForRead } from "../shared.js";

const draftExportFor = (
  room: Awaited<ReturnType<PlatformAppContext["liveDraftRooms"]["getRoom"]>>,
  exportedAt: Date,
): DraftExportResult => generateDraftExport({
  leagueName: room.season.league.name,
  seasonYear: room.season.seasonYear,
  draftRoomId: room.roomId,
  exportedAt,
  status: room.status,
  revision: room.revision,
  teams: exportTeamStateFor(room),
});

export const createLiveDraftExportOperations = (context: PlatformAppContext) => ({
  exportLiveDraftRoom: async (input: ExportPlatformLiveDraftRoomInput): Promise<DraftExportResult> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoom(input.roomId);
    await context.requireSharedRead(account, room.leagueId);
    return draftExportFor(room, input.exportedAt);
  },

  createLiveDraftRoomExportArtifact: async (
    input: CreatePlatformLiveDraftExportArtifactInput,
  ): Promise<DraftExportArtifactResult> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoom(input.roomId);
    await context.requireSharedMutation(account, room.leagueId);
    if (room.status !== "ended") {
      throw new PlatformAppError(
        "draft_room_not_final",
        "Draft room must be ended before creating a final export artifact.",
      );
    }
    if (room.projection.teams.some(team => team.rosterSlotsRemaining > 0)) {
      throw new PlatformAppError(
        "draft_room_not_final",
        "Final export requires every team to fill every roster slot.",
      );
    }
    const existing = await context.exportArtifacts.findByRoomRevision(room.roomId, room.revision);
    if (existing !== undefined) {
      return { artifact: cloneForRead(existing.artifact), content: Buffer.from(existing.content) };
    }
    const artifact = createDraftExportArtifact({
      draftExport: draftExportFor(room, input.exportedAt),
      leagueId: room.leagueId,
      seasonId: room.seasonId,
      roomId: room.roomId,
      sourceRevision: room.revision,
      createdAt: input.exportedAt,
    });
    const saved = await context.exportArtifacts.save(artifact, { createdByUserId: account.id });
    return { artifact: cloneForRead(saved.artifact), content: Buffer.from(saved.content) };
  },
});
