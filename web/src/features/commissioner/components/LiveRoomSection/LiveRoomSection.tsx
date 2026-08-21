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
  formatDraftTime,
  roomStatusLabel,
  scheduledLeagues,
} from "./liveRoomDisplay";
import { type CreatedLiveRoom, LiveRoomWizard } from "./LiveRoomWizard";

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
  const upcomingDrafts = scheduledLeagues(manageableLeagues);

  return (
    <section className="commissioner-section" id="live-room">
      <header><h2>Live draft room</h2></header>
      <p className="commissioner-help">Publish the league first. Keepers and history remain editable until the room starts.</p>
      <div aria-label="Selected league draft details" className="commissioner-facts">
        <div><span>Status</span><strong>{roomStatusLabel(activeRoom, published)}</strong></div>
        <div>
          <span>Draft time</span>
          <strong>{selectedDraftAt === undefined
            ? "Not scheduled"
            : <time dateTime={selectedDraftAt}>
              {formatDraftTime(selectedDraftAt, timeZone)}
            </time>}</strong>
        </div>
        <div><span>Time zone</span><strong>{timeZone}</strong></div>
      </div>
      {upcomingDrafts.length > 0 ? <div>
        <h3>Upcoming drafts</h3>
        <p className="commissioner-help">Times use {timeZone}.</p>
        <ol aria-label="Upcoming scheduled drafts">
          {upcomingDrafts.map(candidate => <li key={candidate.seasonId}>
            <Link to={`${leaguePath(candidate, "commissioner")}?section=live-draft`}>
              {candidate.leagueName}
            </Link>
            {" · "}
            <time dateTime={candidate.nextDraftAt}>
              {formatDraftTime(candidate.nextDraftAt, timeZone)}
            </time>
          </li>)}
        </ol>
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
        <Link className="commissioner-button commissioner-primary" to={leaguePath(league, "draft")}>Enter draft room</Link>
        {!confirmArchive ? <Button variant="danger" onClick={() => { setConfirmArchive(true); }} disabled={!['setup', 'countdown'].includes(activeRoom.status)}>Archive room</Button> : <>
          <Button aria-busy={archive.isPending} variant="danger" onClick={() => { archive.mutate(); }} disabled={archive.isPending}>
            {archive.isPending ? "Archiving room..." : "Confirm archive"}
          </Button>
          <Button variant="secondary" onClick={() => { setConfirmArchive(false); }}>Keep room</Button>
        </>}
      </div>}
      {archive.isPending ? <p role="status">Archiving live room...</p> : null}
      {archive.isError ? <p role="alert">{errorMessage(archive.error)}</p> : null}
    </section>
  );
}
