import type {
  PostgresNotificationClient,
  PostgresNotificationSubscription,
} from "../postgresClient.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { LiveDraftRoomRevisionNotifier } from "./notifier.js";

export const liveDraftRoomRevisionChannel = "sunday_games_live_draft_room_revision";

export interface LiveDraftRoomRevisionNotification {
  roomId: string;
  revision: number;
}

export const decodeLiveDraftRoomRevisionNotification = (
  payload: string,
): LiveDraftRoomRevisionNotification | undefined => {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    return undefined;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (!("roomId" in value) || !("revision" in value)) return undefined;
  return typeof value.roomId === "string" && value.roomId.length > 0
      && typeof value.revision === "number" && Number.isSafeInteger(value.revision)
      && value.revision > 0
    ? { roomId: value.roomId, revision: value.revision }
    : undefined;
};

export const publishLiveDraftRoomRevision = async (
  client: PostgresQueryClient,
  roomId: string,
  revision: number,
): Promise<void> => {
  await client.query("SELECT pg_notify($1, $2)", [
    liveDraftRoomRevisionChannel,
    JSON.stringify({ roomId, revision }),
  ]);
};

export const startPostgresLiveDraftRoomRevisionListener = async (
  client: PostgresNotificationClient,
  notifier: LiveDraftRoomRevisionNotifier,
): Promise<PostgresNotificationSubscription> => await client.listen(
  liveDraftRoomRevisionChannel,
  payload => {
    const notification = decodeLiveDraftRoomRevisionNotification(payload);
    if (notification !== undefined) {
      notifier.notifyRevision(notification.roomId, notification.revision);
    }
  },
);

export const isPostgresNotificationClient = (
  client: unknown,
): client is PostgresNotificationClient => client !== null
  && typeof client === "object"
  && "listen" in client
  && typeof client.listen === "function";
