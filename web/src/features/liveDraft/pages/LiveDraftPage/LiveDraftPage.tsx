import { useLocation, useSearchParams } from "react-router-dom";
import { InlineNotice, Skeleton } from "../../../../shared/ui";
import { PlatformApiError } from "../../../../shared/api/http/PlatformApiError";
import { useLiveDraftRoom } from "../../hooks/useLiveDraftRoom";
import { readLiveDraftLocation } from "../../lib/liveDraftLocation";
import { LiveDraftWorkspace } from "./LiveDraftWorkspace";
import "./LiveDraftPage.css";

interface RoomContentProps {
  readonly roomId: string;
  readonly seasonId: string;
}

const RoomContent = ({ roomId, seasonId }: RoomContentProps) => {
  const location = useLocation();
  const controller = useLiveDraftRoom(roomId);
  if (controller.loading) {
    return <div aria-label="Opening draft room" className="live-draft__loading">
      <Skeleton height="5rem" /><Skeleton height="18rem" /><Skeleton height="24rem" />
    </div>;
  }
  if (controller.error !== null) {
    const message = controller.error.message;
    const signIn = controller.error instanceof PlatformApiError && controller.error.code === "auth_required";
    return <InlineNotice title="Draft room unavailable" variant="error">
      <p>{message}</p>
      {signIn && <a href={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}>Sign in</a>}
    </InlineNotice>;
  }
  if (controller.room === undefined) {
    return <InlineNotice variant="error">The draft room returned no data.</InlineNotice>;
  }
  if (controller.room.seasonId !== seasonId) {
    return <InlineNotice title="Draft room unavailable" variant="error">
      This draft room does not belong to the requested league season.
    </InlineNotice>;
  }
  return <LiveDraftWorkspace
    busy={controller.busy}
    connection={controller.connection}
    createExport={controller.createExport}
    onAction={controller.runAction}
    onRefresh={controller.refresh}
    room={controller.room}
  />;
};

export const LiveDraftPage = () => {
  const [searchParams] = useSearchParams();
  const roomLocation = readLiveDraftLocation(searchParams);
  return (
    <section aria-labelledby="live-draft-title" className="live-draft">
      <header className="live-draft__heading">
        <p>Live draft room</p>
        <h1 id="live-draft-title">Live auction draft</h1>
      </header>
      {!roomLocation.ok
        ? <InlineNotice title="Draft link incomplete" variant="error">{roomLocation.message}</InlineNotice>
        : <RoomContent roomId={roomLocation.roomId} seasonId={roomLocation.seasonId} />}
    </section>
  );
};
