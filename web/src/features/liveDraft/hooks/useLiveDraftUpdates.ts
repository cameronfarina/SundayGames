import { useEffect, useState } from "react";
import { getLiveDraftEvents } from "../api/liveDraftApi";

export type LiveDraftConnection =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline"
  | "polling"
  | "unavailable";

interface LiveDraftUpdateOptions {
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

const roomEventNames = [
  "room.snapshot",
  "room.sale",
  "room.started",
  "room.paused",
  "room.resumed",
  "room.ended",
  "room.error",
];

export const useLiveDraftUpdates = ({
  pollEvents = getLiveDraftEvents,
  refresh,
  revision,
  roomId,
}: LiveDraftUpdateOptions): LiveDraftConnection => {
  const [connection, setConnection] = useState<LiveDraftConnection>(() =>
    initialConnection(roomId, revision));

  useEffect(() => {
    if (roomId === undefined || revision === undefined) return;
    const refreshRoom = () => { void refresh(); };
    const offline = () => { setConnection("offline"); };
    const online = () => {
      setConnection("reconnecting");
      refreshRoom();
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);

    if (typeof EventSource !== "function") {
      const timer = window.setInterval(() => {
        void pollEvents(roomId, revision, {}).then(events => {
          if (events.requiresSnapshot || events.currentRevision > revision || events.events.length > 0) {
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

    const url = `/live-rooms/${encodeURIComponent(roomId)}/event-stream?afterRevision=${String(revision)}`;
    const source = new EventSource(url);
    source.onopen = () => { setConnection("connected"); };
    source.onerror = () => { setConnection(navigator.onLine ? "reconnecting" : "offline"); };
    for (const eventName of roomEventNames) source.addEventListener(eventName, refreshRoom);
    return () => {
      source.close();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [pollEvents, refresh, revision, roomId]);

  return connection;
};
