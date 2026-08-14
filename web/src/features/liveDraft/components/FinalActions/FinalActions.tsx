import { Link } from "react-router-dom";
import { Button, InlineNotice } from "../../../../shared/ui";
import type { LiveDraftRoom } from "../../api/liveDraftSchemas";
import "./FinalActions.css";

interface DraftDownload {
  readonly fileName: string;
  readonly href: string;
}

interface FinalActionsProps {
  readonly busy?: boolean;
  readonly download?: DraftDownload;
  readonly onExport: () => void;
  readonly onReopen: () => void;
  readonly room: LiveDraftRoom;
}

export const FinalActions = ({
  busy = false,
  download,
  onExport,
  onReopen,
  room,
}: FinalActionsProps) => {
  const incomplete = room.teamSummaries.some(team => team.rosterSlotsRemaining > 0);
  const canExport = room.exportReadiness.status === "ready";
  return (
    <section aria-labelledby="draft-complete-title" className="live-panel final-actions">
      <div><h2 id="draft-complete-title">Draft complete</h2>
        <p>Review final rosters, then export the completed draft when every spot is filled.</p></div>
      <div className="final-actions__buttons">
        {room.role !== "observer" && <Link className="final-actions__link" to={`/my-team?seasonId=${encodeURIComponent(room.seasonId)}`}>
          View My Team
        </Link>}
        {room.canMutateRoom && <Button disabled={busy || !canExport} onClick={onExport}>
          Prepare final CSV
        </Button>}
        {room.canMutateRoom && incomplete && <Button disabled={busy} onClick={onReopen} variant="secondary">
          Reopen draft
        </Button>}
        {download !== undefined && <a download={download.fileName} href={download.href}>Download final CSV</a>}
      </div>
      {room.exportReadiness.blockers.length > 0 && <InlineNotice title="Export not ready" variant="warning">
        <ul>{room.exportReadiness.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul>
      </InlineNotice>}
    </section>
  );
};
