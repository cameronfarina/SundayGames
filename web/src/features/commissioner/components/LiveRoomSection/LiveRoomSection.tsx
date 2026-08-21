import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { OnboardingLeague } from "../../../../shared/api/onboarding/onboardingSchema";
import { invalidateLiveRoomConsumers } from "../../../../shared/api/queries/seasonQueryInvalidation";
import { Button } from "../../../../shared/ui/index.js";
import { leaguePath } from "../../../league/lib/leaguePaths";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerSeason } from "../../api/seasonSchemas";
import { errorMessage } from "../../model/errorMessage";
import { browserTimeZone } from "./draftDateTime";
import {
  draftDetailsLabel,
  formatDraftTime,
  roomStatusLabel,
  scheduledLeagues,
} from "./liveRoomDisplay";
import { type CreatedLiveRoom, LiveRoomWizard } from "./LiveRoomWizard";
import "./LiveRoomSection.css";

interface LiveRoomSectionProps {
  readonly league: OnboardingLeague;
  readonly manageableLeagues: readonly OnboardingLeague[];
  readonly season: CommissionerSeason;
}

export function LiveRoomSection({ league, manageableLeagues, season }: LiveRoomSectionProps) {
  const queryClient = useQueryClient();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<CreatedLiveRoom | null>(null);
  const [published, setPublished] = useState(season.setupStatus !== "draft");
  const archive = useMutation({
    mutationFn: () => commissionerApi.archiveRoom(season.id),
    onSuccess: async () => {
      setConfirmArchive(false);
      setCreatedRoom(null);
      await invalidateLiveRoomConsumers(queryClient, season.id);
    },
  });
  const activeRoom = createdRoom ?? (archive.isSuccess ? null : league.liveDraft);
  const timeZone = browserTimeZone();
  const selectedDraftAt = createdRoom?.startsAt ?? league.nextDraftAt ?? season.draft?.scheduledAt;
  const detailsLabel = draftDetailsLabel(activeRoom, selectedDraftAt);
  const otherUpcomingDrafts = scheduledLeagues(manageableLeagues)
    .filter(candidate => candidate.seasonId !== league.seasonId);

  return (
    <section className="commissioner-section" id="live-room">
      <header><h2>Live draft room</h2></header>
      <p className="commissioner-help">Publish the league first. Keepers and history remain editable until the room starts.</p>
      <p aria-label="Selected league draft details" className="live-room-schedule">
        <strong>{detailsLabel}</strong>{" "}
        {detailsLabel !== "Draft status:" && selectedDraftAt !== undefined
          ? <><time dateTime={selectedDraftAt}>{formatDraftTime(selectedDraftAt, timeZone)}</time>{" "}
            <span>{timeZone}</span></>
          : roomStatusLabel(activeRoom, published)}
      </p>
      {otherUpcomingDrafts.length > 0 ? <div className="live-room-other-drafts">
        <h3>Other upcoming drafts</h3>
        <ul aria-label="Other upcoming drafts">
          {otherUpcomingDrafts.map(candidate => <li key={candidate.seasonId}>
            <Link to={`${leaguePath(candidate, "commissioner")}?section=live-draft`}>
              {candidate.leagueName}
            </Link>
            {" · "}
            <time dateTime={candidate.nextDraftAt}>
              {formatDraftTime(candidate.nextDraftAt, timeZone)}
            </time>
            {" "}{timeZone}
          </li>)}
        </ul>
      </div> : null}
      {activeRoom === null ? <LiveRoomWizard
        initialStartsAt={season.draft?.scheduledAt}
        leagueName={league.leagueName}
        onPublished={() => { setPublished(true); }}
        onRoomCreated={setCreatedRoom}
        published={published}
        season={season}
        timeZone={timeZone}
      /> : <div className="commissioner-actions">
        <Link className="commissioner-button commissioner-primary" to={leaguePath(league, "draft")}>Enter draft</Link>
        {!confirmArchive ? <Button variant="danger" onClick={() => { setConfirmArchive(true); }} disabled={!['setup', 'countdown'].includes(activeRoom.status)}>Delete draft</Button> : <>
          <Button aria-busy={archive.isPending} variant="danger" onClick={() => { archive.mutate(); }} disabled={archive.isPending}>
            {archive.isPending ? "Deleting draft..." : "Confirm delete"}
          </Button>
          <Button variant="secondary" onClick={() => { setConfirmArchive(false); }}>Keep draft</Button>
        </>}
      </div>}
      {archive.isPending ? <p role="status">Deleting live draft...</p> : null}
      {archive.isError ? <p role="alert">{errorMessage(archive.error)}</p> : null}
    </section>
  );
}
