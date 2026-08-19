import type { InSeasonTeam } from "../../api/inSeasonSchema";
import {
  byeLabel,
  momentumLabel,
  pointsLabel,
  positionRankLabel,
  rankLabel,
  spreadLabel,
  tierLabel,
} from "../../lib/inSeasonFormat";
import { FantasyProsCredit } from "../FantasyProsCredit/FantasyProsCredit";
import { PlayerNewsBlurb } from "../PlayerNewsBlurb/PlayerNewsBlurb";
import "../TeamTable/TeamTable.css";
import "./RosterRanks.css";

interface RosterRanksProps {
  readonly team: InSeasonTeam;
}

export const RosterRanks = ({ team }: RosterRanksProps) => {
  const unmatched = team.players.filter(player => player.fantasyProsPlayerId === undefined);

  return (
    <section className="my-team-section" aria-labelledby="roster-ranks-heading">
      <h2 id="roster-ranks-heading">Every player you roster</h2>
      <div className="my-team-table-scroll">
        <table>
          <caption>FantasyPros consensus ranks and projections for your roster</caption>
          <thead>
            <tr>
              <th>Player</th>
              <th>Bye</th>
              <th>Weekly rank</th>
              <th>Rest-of-season rank</th>
              <th>Position rank</th>
              <th>Tier</th>
              <th>Expert range</th>
              <th>Momentum</th>
              <th>Week points</th>
              <th>Rest-of-season points</th>
            </tr>
          </thead>
          <tbody>
            {team.players.map(player => (
              <tr key={player.playerId}>
                <th scope="row">
                  {player.playerName}{" "}
                  <span className={`position position-${player.position.toLowerCase()}`}>
                    {player.position}
                  </span>
                  <PlayerNewsBlurb news={player.news} />
                </th>
                <td>{byeLabel(player.byeWeek)}</td>
                <td>{rankLabel(player.weekly)}</td>
                <td>{rankLabel(player.restOfSeason)}</td>
                <td>{positionRankLabel(player.restOfSeason ?? player.weekly)}</td>
                <td>{tierLabel(player.restOfSeason)}</td>
                <td>{spreadLabel(player.weekly ?? player.restOfSeason)}</td>
                <td>{momentumLabel(player.restOfSeason ?? player.weekly)}</td>
                <td>{pointsLabel(player.weeklyProjectedPoints)}</td>
                <td>{pointsLabel(player.restOfSeasonProjectedPoints)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {unmatched.length > 0 && (
        <p className="roster-ranks__unmatched">
          FantasyPros has no record for {unmatched.map(player => player.playerName).join(", ")}.
        </p>
      )}
      <FantasyProsCredit updatedAt={team.updatedAt} />
    </section>
  );
};
