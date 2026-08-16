import { Link } from "react-router-dom";
import type { SimulationHistoryItem } from "../../../practice/api/simulationSchema";
import { useDraftPlanQuery, useSimulationHistoryQuery } from "../../hooks/useDraftPrepQueries";
import "./DraftPrep.css";

interface DraftPrepProps {
  readonly seasonId: string;
}

const practiceLink = (seasonId: string, historyId?: string, runNumber?: number): string => {
  const search = new URLSearchParams({ seasonId });
  if (historyId !== undefined) search.set("runId", historyId);
  if (runNumber !== undefined) search.set("simulationRun", String(runNumber));
  return `/practice?${search.toString()}`;
};

const historyLabel = (item: SimulationHistoryItem): string =>
  item.note ?? item.simulation.strategy.summary;

export const DraftPrep = ({ seasonId }: DraftPrepProps) => {
  const plan = useDraftPlanQuery(seasonId);
  const history = useSimulationHistoryQuery(seasonId);
  const favorites = (history.data ?? []).flatMap(item => item.simulation.outcomes
    .filter(outcome => outcome.favorite)
    .map(outcome => ({ historyId: item.id, label: historyLabel(item), outcome })));

  if (plan.isPending || history.isPending) return <p role="status">Loading draft prep...</p>;
  if (plan.isError) return <p className="my-team-error" role="alert">{plan.error.message}</p>;
  if (history.isError) return <p className="my-team-error" role="alert">{history.error.message}</p>;

  return <div className="draft-prep">
    <section aria-labelledby="active-plan-title" className="my-team-section">
      <div className="draft-prep__heading">
        <div><p className="my-team-eyebrow">Active plan</p><h2 id="active-plan-title">Draft targets</h2></div>
        <Link to={practiceLink(seasonId)}>Edit in Practice</Link>
      </div>
      {plan.data.length === 0
        ? <p>No targets yet. Add players from the Practice board to build a plan.</p>
        : <ol className="draft-prep__targets">{plan.data.map(target => <li key={target.id}>
          <span>{String(target.priority).padStart(2, "0")}</span>
          <strong>{target.playerName}</strong>
          <small>{target.position} · {target.maxBid === undefined ? "No max bid" : `$${String(target.maxBid)} max`}</small>
        </li>)}</ol>}
    </section>
    <section aria-labelledby="favorite-outcomes-title" className="my-team-section">
      <p className="my-team-eyebrow">Saved outcomes</p>
      <h2 id="favorite-outcomes-title">Favorite simulation teams</h2>
      {favorites.length === 0
        ? <p>Favorite a result in Practice to keep the roster here.</p>
        : <ul className="draft-prep__favorites">{favorites.map(favorite => <li key={`${favorite.historyId}-${String(favorite.outcome.runNumber)}`}>
          <div><strong>{favorite.label}</strong><span>Run {String(favorite.outcome.runNumber)} · {favorite.outcome.userWeek1Points.toFixed(1)} projected Week 1 points</span></div>
          <Link to={practiceLink(seasonId, favorite.historyId, favorite.outcome.runNumber)}>Open</Link>
        </li>)}</ul>}
    </section>
    <section aria-labelledby="simulation-history-title" className="my-team-section">
      <p className="my-team-eyebrow">History</p>
      <h2 id="simulation-history-title">Simulation runs</h2>
      {history.data.length === 0
        ? <p>No simulation history yet.</p>
        : <ul className="draft-prep__history">{history.data.map(item => {
          const best = item.simulation.outcomes[0];
          return <li key={item.id}>
            <div><strong>{historyLabel(item)}</strong><span>{String(item.simulation.completedCount)} drafts{best === undefined ? "" : ` · Best ${best.userWeek1Points.toFixed(1)} points`}</span></div>
            <Link to={practiceLink(seasonId, item.id, best?.runNumber ?? 1)}>Open</Link>
          </li>;
        })}</ul>}
    </section>
  </div>;
};
