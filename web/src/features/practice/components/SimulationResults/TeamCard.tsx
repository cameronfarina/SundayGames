import type { PracticeSimulationRun } from "../../api/simulationSchema";
import "./TeamCard.css";

type SimulationTeam = PracticeSimulationRun["teams"][number];
type RosterPlayer = SimulationTeam["roster"][number];

interface TeamCardProps {
  readonly team: SimulationTeam;
}

const playerResult = (player: RosterPlayer): string => {
  if (player.price !== undefined) return `$${String(player.price)}`;
  if (player.overallPick !== undefined) return `#${String(player.overallPick)}`;
  return "-";
};

const teamBudget = (team: SimulationTeam): string => team.spent === undefined
  ? `${String(team.roster.length)} picks`
  : `$${String(team.spent)} spent · $${String(team.budgetRemaining ?? 0)} left`;

export function TeamCard({ team }: TeamCardProps) {
  return (
    <article className={`simulation-team${team.isUserTeam ? " simulation-team--user" : ""}`}>
      <header>
        <div><h3>{team.teamName}</h3><p>{teamBudget(team)}</p></div>
        <div className="simulation-team__score"><strong>{team.week1Points.toFixed(1)}</strong><span>Week 1</span></div>
      </header>
      {team.isUserTeam && <span className="simulation-team__badge">Your team</span>}
      <table>
        <thead><tr><th>Slot</th><th>Player</th><th>Result</th><th>W1</th></tr></thead>
        <tbody>{team.roster.map(player => (
          <tr className={player.starter ? "" : "simulation-team__bench"} key={`${player.rosterSlot}-${player.playerId}`}>
            <td>{player.rosterSlot}</td>
            <td>{player.playerName}{player.source === "keeper" && <span className="keeper-badge">Keeper</span>}</td>
            <td>{playerResult(player)}</td>
            <td>{player.week1Points.toFixed(1)}</td>
          </tr>
        ))}</tbody>
      </table>
    </article>
  );
}
