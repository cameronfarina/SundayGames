import { Link } from "react-router-dom";
import { leaguePath } from "../../../league/lib/leaguePaths";
import type { AccountDashboardLeague } from "../../api/accountDashboardSchema";
import {
  draftStatus,
  formatCount,
  providerLabel,
  readinessStatus,
  roleLabel,
} from "../../model/accountDashboardDisplay";

interface LeagueDashboardCardProps {
  readonly league: AccountDashboardLeague;
}

export const LeagueDashboardCard = ({ league }: LeagueDashboardCardProps) => {
  const canEnterDraft = league.draft.roomId !== undefined && league.draft.status !== "ended";
  return (
    <article aria-label={`${league.leagueName} ${String(league.seasonYear)}`} className="league-dashboard-card">
      <header>
        <div>
          <span>{providerLabel(league.provider)} · {String(league.seasonYear)}</span>
          <h2>{league.leagueName}</h2>
          <p>{roleLabel(league.membershipRole)} · {league.teamDisplayName ?? "No team claimed"}</p>
        </div>
        <strong>{league.draftFormat === "auction" ? "Auction" : "Snake"} · {formatCount(league.teamCount, "team")}</strong>
      </header>
      <dl className="league-dashboard-card__status">
        <div><dt>League setup</dt><dd>{readinessStatus(league.readiness.leagueSetup)}</dd></div>
        <div><dt>Live draft</dt><dd>{draftStatus(league.draft)}</dd></div>
        <div><dt>Your team</dt><dd>{readinessStatus(league.readiness.teamClaim)}</dd></div>
      </dl>
      <dl className="league-dashboard-card__metrics">
        <div><dt>History imported</dt><dd>{formatCount(league.metrics.historicalImportSeasons, "season")}</dd></div>
        <div><dt>Mocks completed (24h)</dt><dd>{formatCount(league.metrics.completedMocks, "mock")}</dd></div>
        <div><dt>Simulation batches (latest 25)</dt><dd>{formatCount(league.metrics.simulationRuns, "batch", "batches")}</dd></div>
        <div><dt>Simulations in latest batches</dt><dd>{formatCount(league.metrics.simulationsCompleted, "simulation")}</dd></div>
        <div><dt>Saved outcomes (latest 25)</dt><dd>{formatCount(league.metrics.savedSimulationOutcomes, "saved", "saved")}</dd></div>
      </dl>
      <footer>
        <Link to={leaguePath(league, "league")}>Open league</Link>
        {canEnterDraft ? <Link to={leaguePath(league, "draft")}>Enter draft</Link> : null}
      </footer>
    </article>
  );
};
