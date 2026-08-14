import { useEffect, useRef, useState } from "react";
import { getLiveDraftEvents } from "../api/liveDraftApi";
import { liveDraftRoomSchema, type LiveDraftRoom } from "../api/liveDraftSchemas";
import {
  liveDraftRoomEventNames,
  type LiveDraftRoomEventName,
} from "../api/liveDraftRoomCache";

export type { LiveDraftRoomEventName } from "../api/liveDraftRoomCache";

export type LiveDraftConnection =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline"
  | "polling"
  | "unavailable";

interface LiveDraftUpdateOptions {
  readonly applyRoomUpdate: (event: LiveDraftRoomEventName, room: LiveDraftRoom) => boolean;
  readonly pollEvents?: typeof getLiveDraftEvents;
  readonly refresh: () => Promise<unknown>;
  readonly revision?: number;
  readonly roomId?: string;
}

const initialConnection = (
  roomId: string | undefined,
  revision: number | undefined,
): LiveDraftConnection => {
  if (roomId === undefined || revision === undefined) return "unavailable";
  return typeof EventSource === "function" ? "connecting" : "polling";
};

const roomFromEvent = (event: Event): LiveDraftRoom | undefined => {
  if (!("data" in event) || typeof event.data !== "string") return undefined;

  try {
    const data: unknown = JSON.parse(event.data);
    const result = liveDraftRoomSchema.safeParse(data);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
};

export const useLiveDraftUpdates = ({
  applyRoomUpdate,
  pollEvents = getLiveDraftEvents,
  refresh,
  revision,
  roomId,
}: LiveDraftUpdateOptions): LiveDraftConnection => {
  const [connection, setConnection] = useState<LiveDraftConnection>(() =>
    initialConnection(roomId, revision));
  const revisionRef = useRef(0);
  const subscriptionReady = roomId !== undefined && revision !== undefined;

  useEffect(() => {
    if (revision !== undefined) revisionRef.current = revision;
  }, [revision]);

  useEffect(() => {
    if (roomId === undefined || !subscriptionReady) return;
    const initialRevision = revisionRef.current;
    const refreshRoom = () => { void refresh(); };
    const offline = () => { setConnection("offline"); };
    const online = () => {
      setConnection("reconnecting");
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);

    if (typeof EventSource !== "function") {
      const timer = window.setInterval(() => {
        const afterRevision = revisionRef.current;
        void pollEvents(roomId, afterRevision, {}).then(events => {
          if (
            events.requiresSnapshot ||
            events.currentRevision > afterRevision ||
            events.events.length > 0
          ) {
            refreshRoom();
          }
        }).catch(() => { setConnection(navigator.onLine ? "reconnecting" : "offline"); });
      }, 5000);
      return () => {
        window.clearInterval(timer);
        window.removeEventListener("offline", offline);
        window.removeEventListener("online", online);
      };
    }

    const url = `/live-rooms/${encodeURIComponent(roomId)}/event-stream?afterRevision=${String(initialRevision)}`;
    const source = new EventSource(url);
    source.onopen = () => { setConnection("connected"); };
    source.onerror = () => { setConnection(navigator.onLine ? "reconnecting" : "offline"); };
    for (const eventName of liveDraftRoomEventNames) {
      source.addEventListener(eventName, event => {
        const room = roomFromEvent(event);
        if (room === undefined || !applyRoomUpdate(eventName, room)) refreshRoom();
      });
    }
    return () => {
      source.close();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [applyRoomUpdate, pollEvents, refresh, roomId, subscriptionReady]);

  return connection;
};
