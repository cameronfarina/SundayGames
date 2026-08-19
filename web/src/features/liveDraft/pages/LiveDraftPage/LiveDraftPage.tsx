import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { InlineNotice, Skeleton } from "../../../../shared/ui";
import { PlatformApiError } from "../../../../shared/api/http/PlatformApiError";
import { onboardingQueryOptions } from "../../../../shared/api/onboarding/onboardingQuery";
import { selectLeagueForRoute } from "../../../league/lib/leaguePaths";
import { useLiveDraftAdvisory } from "../../hooks/useLiveDraftAdvisory";
import { useLiveDraftRoom } from "../../hooks/useLiveDraftRoom";
import { readLiveDraftLocation, type LiveDraftLocation } from "../../lib/liveDraftLocation";
import { LiveDraftWorkspace } from "./LiveDraftWorkspace";
import "./LiveDraftPage.css";

interface RoomContentProps {
  readonly roomId: string;
  readonly seasonId: string;
}

const RoomContent = ({ roomId, seasonId }: RoomContentProps) => {
  const location = useLocation();
  const controller = useLiveDraftRoom(roomId);
  const advisory = useLiveDraftAdvisory(roomId);
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
    {...(advisory === undefined ? {} : { advisory })}
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
  const { leagueSlug } = useParams<{ leagueSlug: string }>();
  const onboarding = useQuery({ ...onboardingQueryOptions(), enabled: leagueSlug !== undefined });
  const league = selectLeagueForRoute(
    onboarding.data?.leagues ?? [],
    leagueSlug,
    searchParams.get("seasonId"),
  );
  const legacyLocation = readLiveDraftLocation(searchParams);
  const roomLocation: LiveDraftLocation = league?.liveDraft === null || league?.liveDraft === undefined
    ? legacyLocation
    : { ok: true, roomId: league.liveDraft.roomId, seasonId: league.seasonId };
  if (leagueSlug !== undefined && onboarding.isPending) {
    return <section aria-label="Live draft" className="live-draft"><p role="status">Opening draft room...</p></section>;
  }
  return (
    <section aria-labelledby="live-draft-title" className="live-draft">
      <header className="live-draft__heading">
        <p>Draft room</p>
        <h1 id="live-draft-title">Live draft</h1>
      </header>
      {!roomLocation.ok
        ? <InlineNotice title="Draft link incomplete" variant="error">{roomLocation.message}</InlineNotice>
        : <RoomContent roomId={roomLocation.roomId} seasonId={roomLocation.seasonId} />}
    </section>
  );
};
