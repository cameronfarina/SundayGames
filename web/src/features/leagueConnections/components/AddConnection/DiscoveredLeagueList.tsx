import { Link } from "react-router-dom";
import { Button } from "../../../../shared/ui";
import type { DiscoveredLeague } from "../../api/leagueConnectionsSchema";
import {
  discoveredLeagueKey,
  importStateLabel,
  isImportRunning,
  type LeagueImportState,
  type LeagueImportStates,
} from "../../lib/discoveredLeagueState";

interface DiscoveredLeagueListProps {
  readonly leagues: readonly DiscoveredLeague[];
  readonly onImport: (league: DiscoveredLeague) => void;
  readonly onImportAll: () => void;
  readonly running: boolean;
  readonly states: LeagueImportStates;
}

const actionLabel = (state: LeagueImportState, league: DiscoveredLeague): string => {
  if (isImportRunning(state)) return "Importing...";
  return state.status === "error"
    ? `Retry ${league.name}`
    : `Connect and import ${league.name}`;
};

export const DiscoveredLeagueList = ({
  leagues,
  onImport,
  onImportAll,
  running,
  states,
}: DiscoveredLeagueListProps) => {
  if (leagues.length === 0) return null;

  return <>
    <Button disabled={running} onClick={onImportAll}>Import all</Button>
    <ul aria-label="Leagues found" className="add-connection__results">
      {leagues.map(league => {
        const state = states[discoveredLeagueKey(league)] ?? { status: "idle" };
        const issues = state.issues ?? [];
        return <li key={discoveredLeagueKey(league)}>
          <div>
            <p className="add-connection__result-name">{league.name}</p>
            <span>{league.season} season · {league.teamCount} teams</span>
            <span className="add-connection__result-state">{importStateLabel(state)}</span>
            {issues.length === 0
              ? null
              : <ul className="add-connection__result-issues">
                {issues.map(issue => <li key={issue}>{issue}</li>)}
              </ul>}
          </div>
          {state.leagueSlug === undefined
            ? <Button
              disabled={running || isImportRunning(state)}
              onClick={() => { onImport(league); }}
              variant="secondary"
            >{actionLabel(state, league)}</Button>
            : <Link className="add-connection__open-link" to={`/leagues/${state.leagueSlug}`}>
              Open in Sunday Games
            </Link>}
        </li>;
      })}
    </ul>
  </>;
};
