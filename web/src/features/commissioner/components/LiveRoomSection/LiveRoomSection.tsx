import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerSeason } from "../../api/seasonSchemas";
import type { CommissionerLeague } from "../../api/workspaceSchemas";
import { errorMessage } from "../../model/errorMessage";
import { commissionerKeys } from "../../pages/CommissionerPage/hooks/useCommissionerWorkspace";

interface LiveRoomSectionProps {
  readonly league: CommissionerLeague;
  readonly season: CommissionerSeason;
}

const roomPath = (seasonId: string, roomId: string): string => {
  const query = new URLSearchParams({ seasonId, roomId });
  return `/draft-room?${query.toString()}`;
};

export function LiveRoomSection({ league, season }: LiveRoomSectionProps) {
  const queryClient = useQueryClient();
  const [startsAt, setStartsAt] = useState(season.draft?.scheduledAt?.slice(0, 16) ?? "");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const publish = useMutation({
    mutationFn: () => commissionerApi.publish(season.id),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: commissionerKeys.season(season.id) }),
  });
  const create = useMutation({ mutationFn: () => commissionerApi.createRoom(
    season.id,
    startsAt.length === 0 ? undefined : new Date(startsAt).toISOString(),
  ) });
  const archive = useMutation({
    mutationFn: () => commissionerApi.archiveRoom(season.id),
    onSuccess: async () => {
      setConfirmArchive(false);
      await queryClient.invalidateQueries({ queryKey: commissionerKeys.onboarding });
    },
  });
  const published = publish.data?.season.setupStatus === "published" || season.setupStatus !== "draft";
  const activeRoom = archive.isSuccess ? null : create.data?.room ?? league.liveDraft;
  const auction = season.settings.draftFormat === "auction";

  return (
    <section className="commissioner-section" id="live-room">
      <header><div><span>05</span><h2>Live auction room</h2></div><strong>{activeRoom?.status ?? "Not created"}</strong></header>
      {!auction ? <p>Hosted live rooms currently support auction drafts only.</p> : <>
        <p className="commissioner-help">Publish the league first. Keepers and history remain editable until the room starts.</p>
        {!published ? <button type="button" onClick={() => { publish.mutate(); }} disabled={publish.isPending}>Publish reviewed league</button> : null}
        {activeRoom === null ? <div className="commissioner-inline-form">
          <label htmlFor="draft-starts-at">Draft date and time</label>
          <input id="draft-starts-at" type="datetime-local" value={startsAt} onChange={event => { setStartsAt(event.target.value); }} />
          <button className="commissioner-primary" type="button" onClick={() => { create.mutate(); }} disabled={!published || create.isPending}>Create room</button>
        </div> : <div className="commissioner-actions">
          <a className="commissioner-button commissioner-primary" href={roomPath(season.id, activeRoom.roomId)}>Enter draft room</a>
          {!confirmArchive ? <button type="button" onClick={() => { setConfirmArchive(true); }} disabled={!['setup', 'countdown'].includes(activeRoom.status)}>Archive room</button> : <>
            <button type="button" onClick={() => { archive.mutate(); }} disabled={archive.isPending}>Confirm archive</button>
            <button type="button" onClick={() => { setConfirmArchive(false); }}>Keep room</button>
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
