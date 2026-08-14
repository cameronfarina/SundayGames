import type { PlatformApp, PlatformHttpResponse } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalNumber, optionalString, requestDate } from "../../request/values.js";
import { methodNotAllowed } from "../../responses.js";

export const routeLiveRoomState = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  roomId: string,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "GET") return methodNotAllowed();
  const state = await app.getLiveDraftRoomState({
    actorSessionToken: request.sessionToken,
    roomId,
    selectedTeamId: optionalString(request.query.selectedTeamId),
    viewedTeamId: optionalString(request.query.viewedTeamId),
    now: request.now,
  });
  return { status: 200, body: { state } };
};

export const routeLiveRoomExport = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  roomId: string,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "GET" && request.method !== "POST") return methodNotAllowed();
  const draftExport = await app.exportLiveDraftRoom({
    actorSessionToken: request.sessionToken,
    roomId,
    exportedAt: requestDate(request.body, request.query, "exportedAt") ?? new Date(),
    now: request.now,
  });
  return { status: 200, body: { draftExport } };
};

export const routeLiveRoomExportArtifact = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  roomId: string,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "POST") return methodNotAllowed();
  const result = await app.createLiveDraftRoomExportArtifact({
    actorSessionToken: request.sessionToken,
    roomId,
    exportedAt: requestDate(request.body, request.query, "exportedAt") ?? new Date(),
    now: request.now,
  });
  return { status: 201, body: { artifact: result.artifact, content: result.content.toString("utf8") } };
};

export const routeLiveRoomEvents = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  roomId: string,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "GET") return methodNotAllowed();
  const events = await app.getLiveDraftRoomEvents({
    actorSessionToken: request.sessionToken,
    roomId,
    afterRevision: optionalNumber(request.query.afterRevision) ?? 0,
    now: request.now,
  });
  return { status: 200, body: { events } };
};
