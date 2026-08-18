import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  invalidateLiveRoomConsumers,
  invalidatePublishedSeasonConsumers,
} from "../../../../shared/api/queries/seasonQueryInvalidation";
import type { OnboardingLeague } from "../../../../shared/api/onboarding/onboardingSchema";
import { Button } from "../../../../shared/ui/index.js";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerSeason } from "../../api/seasonSchemas";
import { errorMessage } from "../../model/errorMessage";
import { leaguePath } from "../../../league/lib/leaguePaths";

interface LiveRoomSectionProps {
  readonly league: OnboardingLeague;
  readonly season: CommissionerSeason;
}

export function LiveRoomSection({ league, season }: LiveRoomSectionProps) {
  const queryClient = useQueryClient();
  const [startsAt, setStartsAt] = useState(season.draft?.scheduledAt?.slice(0, 16) ?? "");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const publish = useMutation({
    mutationFn: () => commissionerApi.publish(season.id),
    onSuccess: async () => { await invalidatePublishedSeasonConsumers(queryClient, season.id); },
  });
  const create = useMutation({
    mutationFn: () => commissionerApi.createRoom(
      season.id,
      startsAt.length === 0 ? undefined : new Date(startsAt).toISOString(),
    ),
    onSuccess: async () => { await invalidateLiveRoomConsumers(queryClient, season.id); },
  });
  const archive = useMutation({
    mutationFn: () => commissionerApi.archiveRoom(season.id),
    onSuccess: async () => {
      setConfirmArchive(false);
      await invalidateLiveRoomConsumers(queryClient, season.id);
    },
  });
  const published = publish.data?.season.setupStatus === "published" || season.setupStatus !== "draft";
  const activeRoom = archive.isSuccess ? null : create.data?.room ?? league.liveDraft;
  const auction = season.settings.draftFormat === "auction";

  return (
    <section className="commissioner-section" id="live-room">
      <header><h2>Live auction room</h2></header>
      {!auction ? <p>Hosted live rooms currently support auction drafts only.</p> : <>
        <p className="commissioner-help">Publish the league first. Keepers and history remain editable until the room starts.</p>
        {!published ? <Button aria-busy={publish.isPending} onClick={() => { publish.mutate(); }} disabled={publish.isPending}>
          {publish.isPending ? "Publishing league..." : "Publish reviewed league"}
        </Button> : null}
        {activeRoom === null ? <div className="commissioner-inline-form">
          <label htmlFor="draft-starts-at">Draft date and time</label>
          <input className="commissioner-date-input" id="draft-starts-at" type="datetime-local" value={startsAt} onChange={event => { setStartsAt(event.target.value); }} />
          <Button aria-busy={create.isPending} onClick={() => { create.mutate(); }} disabled={!published || create.isPending}>
            {create.isPending ? "Creating room..." : "Create room"}
          </Button>
        </div> : <div className="commissioner-actions">
          <Link className="commissioner-button commissioner-primary" to={leaguePath(league, "draft")}>Enter draft room</Link>
          {!confirmArchive ? <Button variant="danger" onClick={() => { setConfirmArchive(true); }} disabled={!['setup', 'countdown'].includes(activeRoom.status)}>Archive room</Button> : <>
            <Button aria-busy={archive.isPending} variant="danger" onClick={() => { archive.mutate(); }} disabled={archive.isPending}>
              {archive.isPending ? "Archiving room..." : "Confirm archive"}
            </Button>
            <Button variant="secondary" onClick={() => { setConfirmArchive(false); }}>Keep room</Button>
          </>}
        </div>}
        {publish.isPending ? <p role="status">Publishing league...</p> : null}
        {create.isPending ? <p role="status">Creating live room...</p> : null}
        {archive.isPending ? <p role="status">Archiving live room...</p> : null}
        {publish.isError ? <p role="alert">{errorMessage(publish.error)}</p> : null}
        {create.isError ? <p role="alert">{errorMessage(create.error)}</p> : null}
        {archive.isError ? <p role="alert">{errorMessage(archive.error)}</p> : null}
      </>}
    </section>
  );
}
