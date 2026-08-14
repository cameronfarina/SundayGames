import type { PlatformHttpHandler, PlatformHttpRequest } from "../platformHttp.js";
import { LiveDraftRoomRevisionNotifier } from "../liveDraftRoomRealtime.js";
import { liveRoomMutationActions } from "./requestKinds.js";
import { pathSegmentsFor } from "./requestPath.js";

interface LiveDraftRevisionNotification {
  roomId: string;
  revision: number;
}

const isUnknownRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const liveDraftRoomRevisionNotificationFor = (
  request: PlatformHttpRequest,
  response: Awaited<ReturnType<PlatformHttpHandler>>,
): LiveDraftRevisionNotification | null => {
  if (response.status < 200 || response.status >= 300) return null;
  const segments = pathSegmentsFor(request);
  if (segments === null) return null;
  const method = request.method.toUpperCase();
  const liveRoomMutation = segments[0] === "live-rooms" && method === "POST" &&
    (segments.length === 1 ||
      (segments.length === 3 && liveRoomMutationActions.has(segments[2] ?? "")));
  const keeperMutation = segments[0] === "seasons" && segments[2] === "keepers" &&
    ((method === "POST" && segments.length === 4 && segments[3] === "apply") ||
      (method === "DELETE" && segments.length === 3));
  const historicalImportCommit = segments[0] === "historical-imports" &&
    segments[2] === "commit" && method === "POST";
  if (!liveRoomMutation && !keeperMutation && !historicalImportCommit) return null;
  if (!isUnknownRecord(response.body)) return null;
  const room = response.body["room"];
  if (!isUnknownRecord(room)) return null;
  const roomId = room["roomId"];
  const revision = room["revision"];
  return typeof roomId === "string" && typeof revision === "number"
    ? { roomId, revision }
    : null;
};

export const notifyLiveDraftRoomRevision = (
  notifier: LiveDraftRoomRevisionNotifier,
  request: PlatformHttpRequest,
  response: Awaited<ReturnType<PlatformHttpHandler>>,
): void => {
  const notification = liveDraftRoomRevisionNotificationFor(request, response);
  if (notification !== null) notifier.notifyRevision(notification.roomId, notification.revision);
};
