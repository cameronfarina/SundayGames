import { InMemoryJobQueue } from "../../src/platform/jobs.js";
import { enqueueDraftRoomExportJob } from "../../src/platform/platformJobOrchestrator.js";

export const now = new Date("2026-08-09T12:00:00.000Z");

export const enqueueExportJob = (
  repository: InMemoryJobQueue,
  maxAttempts?: number,
) => enqueueDraftRoomExportJob({
  repository,
  userId: "user_cam",
  leagueId: "league_100001",
  seasonId: "season_2026",
  draftRoomId: "room_final",
  format: "csv",
  sourceRevision: 9,
  now,
  ...(maxAttempts === undefined ? {} : { maxAttempts }),
});
