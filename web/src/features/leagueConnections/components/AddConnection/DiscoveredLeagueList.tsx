import { Button } from "../../../../shared/ui";
import type { DiscoveredLeague } from "../../api/leagueConnectionsSchema";
import type { LeagueImportState } from "../../hooks/useAddConnectionForm";

interface DiscoveredLeagueListProps {
  readonly leagues: readonly DiscoveredLeague[];
  readonly onConnect: (league: DiscoveredLeague) => void;
  readonly onConnectAll: () => void;
  readonly states: Record<string, LeagueImportState>;
  readonly pending: boolean;
}

const leagueStateKey = (league: DiscoveredLeague): string => `${league.providerLeagueId}:${league.season}`;

const stateLabel = (state: LeagueImportState): string => {
  switch (state.status) {
    case "importing": return "Importing...";
    case "imported": return "Imported";
    case "linked": return "Linked";
    case "error": return state.message ?? "Unable to import this league.";
    case "idle": return "Ready";
  }
};

export const DiscoveredLeagueList = ({
  leagues,
  onConnect,
  onConnectAll,
  states,
  pending,
}: DiscoveredLeagueListProps) => {
  if (leagues.length === 0) return null;

  return <>
    <ul aria-label="Leagues found" className="add-connection__results">
      {leagues.map(league => {
        const state = states[leagueStateKey(league)] ?? { status: "idle" };
        const connecting = pending || state.status === "importing";
        const buttonLabel = state.status === "importing"
          ? "Importing..."
          : state.status === "error"
            ? `Retry ${league.name}`
            : `Connect ${league.name}`;
        return <li key={league.providerLeagueId}>
          <div>
            <p className="add-connection__result-name">{league.name}</p>
            <span>{league.season} season · {league.teamCount} teams</span>
            <span className="add-connection__result-state">{stateLabel(state)}</span>
          </div>
          <Button
            disabled={connecting}
            onClick={() => { onConnect(league); }}
            variant="secondary"
          >
            {buttonLabel}
          </Button>
        </li>;
      })}
    </ul>
    <button
      className="add-connection__import-all button button--secondary"
      disabled={pending}
      onClick={onConnectAll}
      type="button"
    >
      Import all discovered leagues
    </button>
  </>;
};
