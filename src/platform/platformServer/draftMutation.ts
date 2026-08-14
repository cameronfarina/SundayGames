import type { LiveDraftRoomRepository } from "../liveDraftRooms.js";
import type { PlatformHttpRequest, PlatformHttpResponse } from "../platformHttp.js";
import { pathSegmentsFor } from "./requestPath.js";

export class DraftMutationResponseRollback extends Error {
  constructor(readonly response: PlatformHttpResponse) {
    super(`Draft mutation returned HTTP ${response.status}.`);
  }
}

const seasonIdFromBody = (body: unknown): string | null => {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  if (!("seasonId" in body)) return null;
  const seasonId = body.seasonId;
  return typeof seasonId === "string" && seasonId.length > 0 ? seasonId : null;
};

export const draftMutationSeasonIdFor = async (
  request: PlatformHttpRequest,
  liveDraftRoomRepository: LiveDraftRoomRepository,
): Promise<string | null> => {
  const segments = pathSegmentsFor(request);
  if (segments === null) return null;
  const method = request.method.toUpperCase();
  if (segments[0] === "seasons" && typeof segments[1] === "string" &&
      ((segments[2] === "keepers" &&
          ((method === "POST" && segments[3] === "apply") ||
            (method === "DELETE" && segments.length === 3))) ||
        (segments[2] === "live-room" && method === "POST"))) {
    return segments[1];
  }
  if (segments[0] === "historical-imports" && segments[2] === "commit" && method === "POST") {
    return seasonIdFromBody(request.body);
  }
  if (segments[0] === "live-rooms" && segments[2] === "start" && method === "POST") {
    try {
      return (await liveDraftRoomRepository.getRoom(segments[1] ?? "")).seasonId;
    } catch {
      return null;
    }
  }
  return null;
};
