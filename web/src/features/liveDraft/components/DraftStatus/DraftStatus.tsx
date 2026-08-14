import type { LiveDraftRoom } from "../../api/liveDraftSchemas";
import type { LiveDraftConnection } from "../../hooks/useLiveDraftUpdates";
import {
  draftProgress,
  formatDollars,
  liveDraftStatusLabel,
} from "../../lib/liveDraftDisplay";
import "./DraftStatus.css";

interface DraftStatusProps {
  readonly connection: LiveDraftConnection;
  readonly room: LiveDraftRoom;
}

const connectionLabels: Record<LiveDraftConnection, string> = {
  connected: "Connected",
  connecting: "Connecting",
  offline: "Offline",
  polling: "Polling",
  reconnecting: "Reconnecting",
  unavailable: "Unavailable",
};

export const DraftStatus = ({ connection, room }: DraftStatusProps) => {
  const latestSale = room.salesLog.at(-1);
  return (
    <section aria-label="Draft status" className="live-panel draft-status">
      <div><span>Status</span><strong>{liveDraftStatusLabel(room.status)}</strong></div>
      <div><span>Connection</span><strong>{connectionLabels[connection]}</strong></div>
      <div><span>Draft progress</span><strong>{draftProgress(room)}</strong></div>
      <div><span>Players available</span><strong>{room.board.length}</strong></div>
      <div className="draft-status__latest"><span>Latest sale</span><strong>{latestSale === undefined
        ? "No sales yet"
        : `${latestSale.playerName} to ${latestSale.ownerDisplayName} for ${formatDollars(latestSale.price)}`}
      </strong></div>
      <p>Revision {room.revision}</p>
    </section>
  );
};
