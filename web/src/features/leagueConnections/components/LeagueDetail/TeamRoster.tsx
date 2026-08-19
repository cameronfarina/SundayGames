import type { SyncedTeam } from "../../api/leagueConnectionsSchema";
import { formatPoints, formatRecord } from "../../lib/connectionStatus";

interface TeamRosterProps {
  readonly team: SyncedTeam;
}

const playerLine = (
  player: SyncedTeam["players"][number],
): string => [player.position, player.teamAbbreviation]
  .filter(part => part !== undefined)
  .join(" · ");

export const TeamRoster = ({ team }: TeamRosterProps) => <article className="team-roster">
  <header>
    <div>
      <h4>{team.name}</h4>
      {team.ownerNames.length === 0
        ? null
        : <p className="team-roster__owners">{team.ownerNames.join(", ")}</p>}
    </div>
    <span className="team-roster__record">
      {formatRecord(team)} · {formatPoints(team.pointsFor)} PF
    </span>
  </header>
  {team.players.length === 0
    ? <p className="team-roster__empty">This team has no players yet.</p>
    : <ul>
      {team.players.map(player => <li
        className={player.starter ? "team-roster__starter" : undefined}
        key={player.providerPlayerId}
      >
        <span className="team-roster__slot">{player.lineupSlot ?? "BN"}</span>
        <span className="team-roster__name">{player.name}</span>
        <span className="team-roster__meta">{playerLine(player)}</span>
        {player.injuryStatus === undefined
          ? null
          : <span className="team-roster__injury">{player.injuryStatus}</span>}
      </li>)}
    </ul>}
</article>;
