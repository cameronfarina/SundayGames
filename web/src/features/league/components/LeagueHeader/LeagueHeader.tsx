import { Link } from "react-router-dom";
import type { OnboardingLeague } from "../../api/leagueSchemas";

const roomPath = (league: OnboardingLeague): string | undefined => {
  const roomId = league.liveDraft?.roomId;
  if (roomId === undefined) return undefined;
  const query = new URLSearchParams({ seasonId: league.seasonId, roomId });
  return `/draft-room?${query.toString()}`;
};

export function LeagueHeader({ league }: { readonly league: OnboardingLeague }) {
  const draftPath = roomPath(league);
  const setupPath = `/commissioner?${new URLSearchParams({ seasonId: league.seasonId }).toString()}`;
  const needsSetup = league.readiness.leagueSetup === "needs_attention";

  return (
    <header className="league-header">
      <div>
        <p className="league-eyebrow">League home · {league.seasonYear}</p>
        <h1>{league.leagueName}</h1>
      </div>
      <div className="league-header__actions">
        {league.canManageLeague && needsSetup ? (
          <Link className="league-button league-button--primary" to={setupPath}>Finish setup</Link>
        ) : null}
        {league.canManageLeague && !needsSetup && draftPath === undefined ? (
          <Link className="league-button" to={`${setupPath}#live-room-setup-title`}>Create draft room</Link>
        ) : null}
        {draftPath === undefined ? null : (
          <Link className="league-button league-button--primary" to={draftPath}>Enter draft</Link>
        )}
      </div>
    </header>
  );
}
