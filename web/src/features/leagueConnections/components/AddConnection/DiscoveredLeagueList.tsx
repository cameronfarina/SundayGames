import { Button } from "../../../../shared/ui";
import type { DiscoveredLeague } from "../../api/leagueConnectionsSchema";
import type { LeagueImportState } from "../../hooks/useAddConnectionForm";

interface DiscoveredLeagueListProps {
  readonly leagues: readonly DiscoveredLeague[];
  readonly onConnect: (league: DiscoveredLeague) => void;
  readonly onConnectAll: () => void;
  readonly pending: boolean;
  readonly states: Record<string, LeagueImportState>;
}

const keyFor = (league: DiscoveredLeague): string => `${league.providerLeagueId}:${league.season}`;
const labelFor = (state: LeagueImportState): string => {
  if (state.status === "importing") return "Importing...";
  if (state.status === "imported") return "Imported";
  if (state.status === "linked") return "Already linked";
  if (state.status === "error") return state.message ?? "Import failed";
  return "Ready to import";
};

export const DiscoveredLeagueList = ({
  leagues,
  onConnect,
  onConnectAll,
  pending,
  states,
}: DiscoveredLeagueListProps) => {
  if (leagues.length === 0) return null;

  return <>
    <ul aria-label="Leagues found" className="add-connection__results">
      {leagues.map(league => {
        const state = states[keyFor(league)] ?? { status: "idle" };
        const done = state.status === "imported" || state.status === "linked";
        return <li key={league.providerLeagueId}>
          <div>
            <p className="add-connection__result-name">{league.name}</p>
            <span>{league.season} season · {league.teamCount} teams</span>
            <span>{labelFor(state)}</span>
          </div>
          <Button
            disabled={pending || state.status === "importing" || done}
            onClick={() => { onConnect(league); }}
            variant="secondary"
          >
            {state.status === "error" ? `Retry ${league.name}` : `Import ${league.name}`}
          </Button>
        </li>;
      })}
    </ul>
    <Button disabled={pending} onClick={onConnectAll}>Import all leagues</Button>
  </>;
};
