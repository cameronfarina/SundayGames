import type { SyncedMatchup, SyncedTeam } from "../../api/leagueConnectionsSchema";
import { formatPoints } from "../../lib/connectionStatus";

interface MatchupTableProps {
  readonly matchups: readonly SyncedMatchup[];
  readonly teams: readonly SyncedTeam[];
}

export const MatchupTable = ({ matchups, teams }: MatchupTableProps) => {
  if (matchups.length === 0) {
    return <p className="league-detail__empty">No games have been scored in this league yet.</p>;
  }
  const nameFor = (teamId: string): string =>
    teams.find(team => team.providerTeamId === teamId)?.name ?? `Team ${teamId}`;

  return <table className="matchup-table">
    <caption>Weekly matchups and scores</caption>
    <thead>
      <tr><th scope="col">Week</th><th scope="col">Home</th><th scope="col">Away</th></tr>
    </thead>
    <tbody>
      {matchups.map(matchup => <tr key={matchup.matchupKey}>
        <th scope="row">{matchup.week}</th>
        <td>{nameFor(matchup.homeTeamId)} · {formatPoints(matchup.homePoints)}</td>
        <td>
          {matchup.awayTeamId === undefined || matchup.awayPoints === undefined
            ? "Bye"
            : `${nameFor(matchup.awayTeamId)} · ${formatPoints(matchup.awayPoints)}`}
        </td>
      </tr>)}
    </tbody>
  </table>;
};
