import { Link } from "react-router-dom";
import type { AccountDashboardLeague } from "../../api/accountDashboardSchema";
import { formatDraftDate, upcomingDrafts } from "../../model/accountDashboardDisplay";
import { leaguePath } from "../../../league/lib/leaguePaths";

interface AccountUpcomingDraftsProps {
  readonly leagues: readonly AccountDashboardLeague[];
}

export const AccountUpcomingDrafts = ({ leagues }: AccountUpcomingDraftsProps) => {
  const scheduled = upcomingDrafts(leagues);
  return (
    <section aria-labelledby="upcoming-drafts-heading" className="account-dashboard__upcoming">
      <div>
        <p>Schedule</p>
        <h2 id="upcoming-drafts-heading">Upcoming drafts</h2>
      </div>
      {scheduled.length === 0
        ? <span className="account-dashboard__quiet">No drafts are scheduled yet.</span>
        : (
          <ol aria-label="Upcoming drafts">
            {scheduled.map(league => (
              <li key={league.seasonId}>
                <Link to={leaguePath(league, "league")}>{league.leagueName}</Link>
                <time dateTime={league.draft.startsAt}>{formatDraftDate(league.draft.startsAt)}</time>
              </li>
            ))}
          </ol>
        )}
    </section>
  );
};
