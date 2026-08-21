import type { PlatformDraftSchedule } from "../../api/platformDraftOperationsSchema";
import "./DraftOperationsSummary.css";

export const DraftOperationsSummary = ({ schedule }: { schedule: PlatformDraftSchedule }) => (
  <dl className="draft-operations-summary">
    <div>
      <dt>Today</dt>
      <dd>{schedule.summary.scheduledToday} scheduled today</dd>
    </div>
    <div>
      <dt>Estimated peak</dt>
      <dd>Peak: {schedule.summary.peakConcurrentDrafts} concurrent</dd>
    </div>
    <div>
      <dt>Live now</dt>
      <dd>{schedule.summary.liveNow}</dd>
    </div>
    <div>
      <dt>Room readiness</dt>
      <dd>{schedule.summary.roomsNotCreated} not created</dd>
    </div>
  </dl>
);
