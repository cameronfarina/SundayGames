import { liveDraftStrategies, parseLiveDraftStrategyKey } from "../../../../modeling/liveDraftStrategies.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalNumber, optionalString, stringValue } from "../../request/values.js";
import { isPlatformHttpResponse, methodNotAllowed, notFound } from "../../responses.js";
import { seasonMockConfigurationSnapshotFor } from "./configuration.js";
import {
  findSeasonMockDraftSession,
  seasonMockDraftIdentityContextFor,
  seasonMockDraftSetupFor,
} from "./context.js";
import type { SeasonMockDraftContext } from "./context.js";
import { seasonMockResponseBody, serializedSeasonMockCommand, stateForSeasonMock } from "./state.js";

export const routeSeasonMockDrafts = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [, sessionId, action] = request.segments;
  const seasonId = request.segments.length === 1
    ? stringValue(request.body.seasonId)
    : request.method === "GET" ? stringValue(request.query.seasonId) : stringValue(request.body.seasonId);
  if (request.segments.length === 1) {
    if (request.method !== "POST") return methodNotAllowed();
    const identityContext = await seasonMockDraftIdentityContextFor(app, request, seasonId);
    await app.assertMockDraftSessionCreationAllowed({
      actorSessionToken: request.sessionToken,
      leagueId: identityContext.season.leagueId,
      seasonId: identityContext.season.id,
      ownerId: identityContext.membership.ownerId,
      teamId: identityContext.membership.teamId,
      now: request.now,
    });
    const setup = await seasonMockDraftSetupFor(identityContext.season, request, services);
    if (isPlatformHttpResponse(setup)) return setup;
    const context: SeasonMockDraftContext = { ...identityContext, setup };
    const strategyKey = parseLiveDraftStrategyKey(optionalString(request.body.strategy) ?? "balanced");
    const strategy = liveDraftStrategies[strategyKey];
    const mockSession = await app.createMockDraftSession({
      actorSessionToken: request.sessionToken,
      leagueId: context.season.leagueId,
      seasonId: context.season.id,
      ownerId: context.membership.ownerId,
      teamId: context.membership.teamId,
      draftMode: {
        format: context.season.settings.draftFormat,
        mockCount: 1,
        label: `${context.season.league.name} ${strategy.label} mock draft`,
      },
      configurationSnapshot: await seasonMockConfigurationSnapshotFor(app, request, context),
      status: "setup",
      now: request.now,
    });
    return { status: 201, body: seasonMockResponseBody(mockSession, await stateForSeasonMock(context, mockSession)) };
  }
  const identityContext = await seasonMockDraftIdentityContextFor(app, request, seasonId);
  if (request.segments.length === 3 && action === "abandon") {
    if (request.method !== "POST") return methodNotAllowed();
    const mockSession = await findSeasonMockDraftSession(app, request, identityContext, sessionId ?? "");
    const abandonedMockSession = await app.abandonMockDraftSession({
      actorSessionToken: request.sessionToken,
      sessionId: mockSession.id,
      expectedRevision: optionalNumber(request.body.expectedRevision) ?? Number.NaN,
      now: request.now,
    });
    return { status: 200, body: { mockSession: abandonedMockSession } };
  }
  const setup = await seasonMockDraftSetupFor(identityContext.season, request, services);
  if (isPlatformHttpResponse(setup)) return setup;
  const context: SeasonMockDraftContext = { ...identityContext, setup };
  const mockSession = await findSeasonMockDraftSession(app, request, identityContext, sessionId ?? "");
  if (request.segments.length === 2) {
    if (request.method !== "GET") return methodNotAllowed();
    return { status: 200, body: seasonMockResponseBody(mockSession, await stateForSeasonMock(context, mockSession)) };
  }
  if (request.segments.length === 3 && action === "commands") {
    if (request.method !== "POST") return methodNotAllowed();
    const command = serializedSeasonMockCommand(request.body.command);
    const commandId = stringValue(request.body.commandId).trim();
    const idempotencyKey = optionalString(request.body.idempotencyKey)?.trim() || commandId;
    const storedRetry = await app.findStoredMockDraftCommandForRetry({
      actorSessionToken: request.sessionToken,
      sessionId: mockSession.id,
      commandId,
      command,
      idempotencyKey,
      now: request.now,
    });
    if (storedRetry !== undefined) {
      return { status: 200, body: seasonMockResponseBody(storedRetry.session, await stateForSeasonMock(context, storedRetry.session)) };
    }
    const state = await stateForSeasonMock(context, mockSession, command);
    let updatedMockSession = await app.appendMockDraftCommand({
      actorSessionToken: request.sessionToken,
      sessionId: mockSession.id,
      expectedRevision: mockSession.revision,
      expectedCommandCount: mockSession.commandLog.length,
      commandId,
      command,
      idempotencyKey,
      now: request.now,
    });
    if (state.session.status === "completed") {
      updatedMockSession = await app.completeMockDraftSession({
        actorSessionToken: request.sessionToken,
        sessionId: updatedMockSession.id,
        expectedRevision: updatedMockSession.revision,
        now: request.now,
      });
    }
    return { status: 200, body: seasonMockResponseBody(updatedMockSession, state) };
  }
  return notFound();
};
