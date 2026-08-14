import type { PlatformApp, PlatformHttpResponse } from "../contracts.js";
import { mockDraftModeMetadataFor, mockDraftResultReferenceFor } from "../request/domainInputs.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import { optionalNumber, optionalString, stringValue } from "../request/values.js";
import { methodNotAllowed, notFound } from "../responses.js";

export const routeMockSessions = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
): Promise<PlatformHttpResponse> => {
  const [, sessionId, action] = request.segments;
  if (request.segments.length === 1) {
    if (request.method === "GET") {
      const mockSessions = await app.listMockDraftSessions({
        actorSessionToken: request.sessionToken,
        leagueId: stringValue(request.query.leagueId),
        seasonId: stringValue(request.query.seasonId),
        ownerId: stringValue(request.query.ownerId),
        teamId: optionalString(request.query.teamId),
        now: request.now,
      });
      return { status: 200, body: { mockSessions } };
    }
    if (request.method === "POST") {
      const status = request.body.status === "setup" || request.body.status === "active"
        ? request.body.status : undefined;
      const mockSession = await app.createMockDraftSession({
        actorSessionToken: request.sessionToken,
        leagueId: stringValue(request.body.leagueId),
        seasonId: stringValue(request.body.seasonId),
        ownerId: stringValue(request.body.ownerId),
        teamId: stringValue(request.body.teamId),
        draftMode: mockDraftModeMetadataFor(request.body.draftMode),
        status,
        now: request.now,
      });
      return { status: 201, body: { mockSession } };
    }
    return methodNotAllowed();
  }
  if (request.segments.length !== 3) return notFound();
  if (request.method !== "POST") return methodNotAllowed();
  if (action === "commands" || action === "append") {
    const mockSession = await app.appendMockDraftCommand({
      actorSessionToken: request.sessionToken,
      sessionId: sessionId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision) ?? Number.NaN,
      expectedCommandCount: optionalNumber(request.body.expectedCommandCount) ?? Number.NaN,
      commandId: stringValue(request.body.commandId),
      command: stringValue(request.body.command),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      latestResultRef: mockDraftResultReferenceFor(request.body.latestResultRef),
      now: request.now,
    });
    return { status: 200, body: { mockSession } };
  }
  if (action === "reset") {
    const mockSession = await app.resetMockDraftSession({
      actorSessionToken: request.sessionToken,
      sessionId: sessionId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision) ?? Number.NaN,
      now: request.now,
    });
    return { status: 200, body: { mockSession } };
  }
  return notFound();
};
