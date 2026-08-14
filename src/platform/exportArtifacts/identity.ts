import { draftExportFormat } from "./constants.js";

const storageSegment = (value: string): string => encodeURIComponent(value.trim());

export const draftExportArtifactId = (
  leagueId: string,
  seasonId: string,
  roomId: string,
  sourceRevision: number,
): string =>
  `draft-room-export:${leagueId}:${seasonId}:${roomId}:rev${sourceRevision}:${draftExportFormat}`;

export const draftExportStorageKey = (
  leagueId: string,
  seasonId: string,
  roomId: string,
  sourceRevision: number,
): string => [
  "exports",
  storageSegment(leagueId),
  storageSegment(seasonId),
  storageSegment(roomId),
  `rev${sourceRevision}.${draftExportFormat}`,
].join("/");
