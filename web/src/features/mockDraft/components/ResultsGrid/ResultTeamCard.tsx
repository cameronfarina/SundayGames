import type { MockResultTeam } from "../../api/mockDraftSchemas.js";
import { positionAccent } from "../../model/auctionViewModel.js";

interface ResultTeamCardProps {
  readonly team: MockResultTeam;
}

const acquisition = (price: number | undefined, source: string): string => {
  if (price === undefined) return source === "keeper" ? "Keeper" : "-";
  return `$${String(price)}`;
};

export const ResultTeamCard = ({ team }: ResultTeamCardProps) => (
  <article aria-label={`${String(team.rank)}. ${team.teamName}`} className="result-team-card">
    <header>
      <div>
        <span className="result-team-card__rank">#{String(team.rank)}</span>
        <h3>{team.teamName}</h3>
        {team.isUserTeam && <strong className="result-team-card__you">Your team</strong>}
        {team.spent !== undefined && team.budgetRemaining !== undefined && (
          <p>${String(team.spent)} spent · ${String(team.budgetRemaining)} left</p>
        )}
      </div>
      <div className="result-team-card__score">
        <strong>{String(team.week1Points)} Week 1</strong>
      </div>
    </header>
    <table>
      <thead><tr><th>Slot</th><th>Player</th><th>Result</th><th>W1</th></tr></thead>
      <tbody>
        {team.roster.map(player => (
          <tr className={positionAccent(player.position)} key={`${player.rosterSlot}:${player.playerId}`}>
            <td>{player.rosterSlot}</td>
            <th scope="row">
              {player.playerName}
              {player.source === "keeper" && <span className="result-team-card__keeper">Keeper</span>}
            </th>
            <td>{acquisition(player.price, player.source)}</td>
            <td>{String(player.week1Points)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </article>
);
