import { Link } from "react-router-dom";
import type { OnboardingLeague } from "../../../../shared/api/onboarding/onboardingSchema";
import { leaguePath } from "../../../league/lib/leaguePaths";
import "./EmptyTeamState.css";

interface EmptyTeamStateProps {
  readonly league?: OnboardingLeague;
}

export const EmptyTeamState = ({ league }: EmptyTeamStateProps) => {
  if (league === undefined) {
    return (
      <section className="my-team-empty" aria-labelledby="my-team-empty-title">
        <h2 id="my-team-empty-title">Your team starts with a league</h2>
        <p>Create a league or join an invitation before building a team.</p>
        <div className="my-team-actions">
          <Link className="my-team-primary-link" to="/league?create=1">Create league</Link>
          <Link className="my-team-secondary-link" to="/invite">Join a league</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="my-team-empty" aria-labelledby="my-team-empty-title">
      <h2 id="my-team-empty-title">Claim your team</h2>
      <p>Select your team in {league.leagueName} to see private keeper, budget, and draft results.</p>
      <a
        className="my-team-primary-link"
        href={`${leaguePath(league, "league")}#claim-your-team`}
      >
        Choose team
      </a>
    </section>
  );
};
