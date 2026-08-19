import { Button } from "../../../../shared/ui";
import type { DiscoveredLeague } from "../../api/leagueConnectionsSchema";

interface DiscoveredLeagueListProps {
  readonly leagues: readonly DiscoveredLeague[];
  readonly onConnect: (league: DiscoveredLeague) => void;
  readonly pending: boolean;
}

export const DiscoveredLeagueList = ({
  leagues,
  onConnect,
  pending,
}: DiscoveredLeagueListProps) => {
  if (leagues.length === 0) return null;

  return <ul aria-label="Leagues found" className="add-connection__results">
    {leagues.map(league => <li key={league.providerLeagueId}>
      <div>
        <p className="add-connection__result-name">{league.name}</p>
        <span>{league.season} season · {league.teamCount} teams</span>
      </div>
      <Button
        disabled={pending}
        onClick={() => { onConnect(league); }}
        variant="secondary"
      >Connect {league.name}</Button>
    </li>)}
  </ul>;
};
