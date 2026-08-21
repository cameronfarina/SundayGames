import type { PlatformDraftOperationsItem } from "../../api/platformDraftOperationsSchema";
import "./DraftOperationsTable.css";

const formatName = (format: PlatformDraftOperationsItem["draftFormat"]) =>
  format === "auction" ? "Auction" : "Snake";

const scheduledTime = (startsAt: string, timezone: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(startsAt));

const roomLabel = (draft: PlatformDraftOperationsItem) => {
  if (draft.readiness === "room_not_created") return "Room not created";
  if (draft.roomStatus === null) return "Room ready";
  return {
    countdown: "Countdown",
    ended: "Ended",
    live: "Live",
    paused: "Paused",
    setup: "Setup",
  }[draft.roomStatus];
};

export const DraftOperationsTable = (props: {
  drafts: readonly PlatformDraftOperationsItem[];
  emptyMessage: string;
  timezone: string;
}) => {
  if (props.drafts.length === 0) return <p>{props.emptyMessage}</p>;
  return (
    <div className="draft-operations-table-wrap">
      <table className="draft-operations-table">
        <thead>
          <tr><th>League</th><th>Scheduled</th><th>Format</th><th>Status</th></tr>
        </thead>
        <tbody>
          {props.drafts.map(draft => (
            <tr key={draft.seasonId}>
              <td><strong>{draft.leagueName}</strong><span>{draft.seasonName}</span></td>
              <td>{scheduledTime(draft.startsAt, props.timezone)}</td>
              <td>{draft.teamCount} teams · {formatName(draft.draftFormat)}</td>
              <td>{roomLabel(draft)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
