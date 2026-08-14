import {
  applySeasonKeeperCommand,
  listSeasonKeepers,
  previewSeasonKeeperCommand,
  removeSeasonKeeper,
} from "../../../seasonKeeperSetup.js";
import { liveDraftRoomSetupContentHash } from "../../../liveDraftRoomSetups.js";
import { requireSeasonManager } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { stringValue } from "../../request/values.js";
import { isPlatformHttpResponse, knownError, methodNotAllowed, notFound } from "../../responses.js";
import { persistKeeperSetupChange } from "./keeperPersistence.js";
import { seasonDraftSetupForKeeperEditing } from "./keeperSetup.js";

const proposedSetupFor = (
  input: ReturnType<typeof applySeasonKeeperCommand> | ReturnType<typeof removeSeasonKeeper>,
  request: ParsedPlatformHttpRequest,
) => ({
  ...input,
  contentHash: liveDraftRoomSetupContentHash(input),
  updatedAt: input.updatedAt ?? request.now ?? new Date(),
});

export const routeSeasonKeepers = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [, seasonId, , action] = request.segments;
  if (request.segments.length !== 3 && request.segments.length !== 4) return notFound();
  const season = await app.getLeagueSeason({ actorSessionToken: request.sessionToken, seasonId: seasonId ?? "", now: request.now });
  const editableSetup = await seasonDraftSetupForKeeperEditing(season, request, services);
  if (isPlatformHttpResponse(editableSetup)) return editableSetup;
  const { setup, expectedContentHash } = editableSetup;
  const repository = services.liveDraftRoomSetupRepository;
  if (repository === undefined) return knownError(503, "keeper_setup_unavailable", "Keeper setup is unavailable.");
  if (request.segments.length === 3 && request.method === "GET") {
    return { status: 200, body: { keepers: listSeasonKeepers(setup) } };
  }
  await requireSeasonManager(app, request, season.id);
  if (await app.hasStartedLiveDraftRoomForSeason(season.id)) {
    return knownError(409, "keeper_setup_locked", "Keepers are locked after the live draft starts.");
  }
  if (request.segments.length === 4 && action === "preview") {
    if (request.method !== "POST") return methodNotAllowed();
    const result = previewSeasonKeeperCommand({ season, playerCatalog: setup.playerCatalog, command: stringValue(request.body.command) });
    return { status: result.kind === "preview" ? 200 : 422, body: result };
  }
  if (request.segments.length === 4 && action === "apply") {
    if (request.method !== "POST") return methodNotAllowed();
    if (request.body.confirmed !== true) {
      return knownError(400, "keeper_confirmation_required", "Review and confirm this keeper before applying it.");
    }
    const preview = previewSeasonKeeperCommand({ season, playerCatalog: setup.playerCatalog, command: stringValue(request.body.command) });
    if (preview.kind === "error") return { status: 422, body: preview };
    const proposed = proposedSetupFor(applySeasonKeeperCommand({ season, setup, preview, now: request.now }), request);
    const { saved, room, pricing } = await persistKeeperSetupChange(
      app, request, season, repository, setup, proposed, expectedContentHash,
    );
    return {
      status: 200,
      body: {
        preview,
        keepers: listSeasonKeepers(saved),
        ...(room === null ? {} : { room }),
        ...(pricing === undefined ? {} : { pricing }),
      },
    };
  }
  if (request.segments.length === 3 && request.method === "DELETE") {
    const proposed = proposedSetupFor(removeSeasonKeeper(setup, {
      teamId: stringValue(request.body.teamId),
      playerId: stringValue(request.body.playerId),
      now: request.now,
    }), request);
    const { saved, room, pricing } = await persistKeeperSetupChange(
      app, request, season, repository, setup, proposed, expectedContentHash,
    );
    return {
      status: 200,
      body: {
        keepers: listSeasonKeepers(saved),
        ...(room === null ? {} : { room }),
        ...(pricing === undefined ? {} : { pricing }),
      },
    };
  }
  return methodNotAllowed();
};
