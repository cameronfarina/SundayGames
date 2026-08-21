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
import {
  browserTimeZone,
  dateTimeLocalToIsoInstant,
  isoInstantToDateTimeLocal,
} from "./draftDateTime";

interface LiveRoomSectionProps {
  readonly league: OnboardingLeague;
  readonly season: CommissionerSeason;
}

export function LiveRoomSection({ league, season }: LiveRoomSectionProps) {
  const queryClient = useQueryClient();
  const [localStartsAt, setLocalStartsAt] = useState(
    season.draft?.scheduledAt === undefined
      ? ""
      : isoInstantToDateTimeLocal(season.draft.scheduledAt),
  );
  const [confirmArchive, setConfirmArchive] = useState(false);
  const publish = useMutation({
    mutationFn: () => commissionerApi.publish(season.id),
    onSuccess: async () => { await invalidatePublishedSeasonConsumers(queryClient, season.id); },
  });
  const create = useMutation({
    mutationFn: () => commissionerApi.createRoom(
      season.id,
      localStartsAt === ""
        ? undefined
        : dateTimeLocalToIsoInstant(localStartsAt, season.draft?.scheduledAt),
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
  const timeZone = browserTimeZone();

  return (
    <section className="commissioner-section" id="live-room">
      <header><h2>Live draft room</h2></header>
      <p className="commissioner-help">Publish the league first. Keepers and history remain editable until the room starts.</p>
      {!published ? <Button aria-busy={publish.isPending} onClick={() => { publish.mutate(); }} disabled={publish.isPending}>
        {publish.isPending ? "Publishing league..." : "Publish reviewed league"}
      </Button> : null}
      {activeRoom === null ? <div className="commissioner-inline-form">
        <label htmlFor="draft-starts-at">Draft date and time</label>
        <p className="commissioner-help commissioner-time-zone" id="draft-starts-at-time-zone">
          Times use {timeZone}. If clocks repeat an hour, new times use the first occurrence.
        </p>
        <input aria-describedby="draft-starts-at-time-zone" className="commissioner-date-input" id="draft-starts-at" type="datetime-local" value={localStartsAt} onChange={event => { setLocalStartsAt(event.target.value); }} />
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
    </section>
  );
}
