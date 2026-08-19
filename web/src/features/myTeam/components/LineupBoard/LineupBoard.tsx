import type { InSeasonPlayer, InSeasonTeam } from "../../api/inSeasonSchema";
import {
  lineupBasisLabel,
  missingValue,
  pointsLabel,
  rankLabel,
} from "../../lib/inSeasonFormat";
import { FantasyProsCredit } from "../FantasyProsCredit/FantasyProsCredit";
import "../TeamTable/TeamTable.css";
import "./LineupBoard.css";

interface LineupBoardProps {
  readonly team: InSeasonTeam;
}

export const LineupBoard = ({ team }: LineupBoardProps) => {
  const lineup = team.lineup;
  if (lineup === undefined) {
    return (
      <section className="my-team-section" aria-labelledby="lineup-empty-heading">
        <h2 id="lineup-empty-heading">Lineup help</h2>
        <p>{team.configured
          ? "FantasyPros has not published projections for your roster yet."
          : "FantasyPros is not connected, so there are no rankings to compare."}</p>
        <FantasyProsCredit />
      </section>
    );
  }

  const weekly = lineup.basis === "weekly_projection";
  const pointsFor = (player: InSeasonPlayer): string =>
    pointsLabel(weekly ? player.weeklyProjectedPoints : player.restOfSeasonProjectedPoints);
  const concerns = lineup.slots.flatMap(slot =>
    slot.concern === undefined ? [] : [{ slot: slot.slot, message: slot.concern.message }]);

  return (
    <section className="my-team-section" aria-labelledby="lineup-heading">
      <p className="my-team-eyebrow">
        {team.week === undefined ? "This week" : `Week ${String(team.week)}`}
      </p>
      <h2 id="lineup-heading">Start these players</h2>
      <p>{lineupBasisLabel(lineup.basis)}.</p>
      {concerns.length === 0 ? (
        <p>The FantasyPros consensus agrees with every projected starter.</p>
      ) : (
        <ul className="lineup-board__concerns">
          {concerns.map(item => (
            <li key={item.slot}><strong>{item.slot}:</strong> {item.message}</li>
          ))}
        </ul>
      )}
      <div className="my-team-table-scroll">
        <table>
          <caption>Your projected lineup and the closest bench alternative</caption>
          <thead>
            <tr>
              <th>Slot</th>
              <th>Start</th>
              <th>Weekly rank</th>
              <th>{weekly ? "Week points" : "Rest-of-season points"}</th>
              <th>Bench alternative</th>
              <th>Points gained</th>
            </tr>
          </thead>
          <tbody>
            {lineup.slots.map(slot => (
              <tr key={slot.slot}>
                <th scope="row">{slot.slot}</th>
                <td>
                  {slot.start.playerName}{" "}
                  <span className={`position position-${slot.start.position.toLowerCase()}`}>
                    {slot.start.position}
                  </span>
                </td>
                <td>{rankLabel(slot.start.weekly)}</td>
                <td>{pointsFor(slot.start)}</td>
                <td>{slot.bench === undefined ? "No bench option" : slot.bench.playerName}</td>
                <td>{slot.pointEdge === undefined ? missingValue : pointsLabel(slot.pointEdge)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FantasyProsCredit updatedAt={team.updatedAt} />
    </section>
  );
};
