import { Link } from "react-router-dom";
import type { OnboardingLeague } from "../../../../shared/api/onboarding/onboardingSchema";
import { leaguePath } from "../../lib/leaguePaths";

const roomPath = (league: OnboardingLeague): string | undefined => {
  if (league.liveDraft === null) return undefined;
  return leaguePath(league, "draft");
};

export function LeagueHeader({ league }: { readonly league: OnboardingLeague }) {
  const draftPath = roomPath(league);
  const setupPath = leaguePath(league, "commissioner");
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
          <Link className="league-button" to={`${setupPath}#live-room`}>Create draft room</Link>
        ) : null}
        {draftPath === undefined ? null : (
          <Link className="league-button league-button--primary" to={draftPath}>Enter draft</Link>
        )}
      </div>
    </header>
  );
}
