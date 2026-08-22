import type { SnakeBoardPick, SnakeBoardPlayer } from "../../api/snakeStateSchemas.js";
import { pickLabel, playerNamesById, snakeRounds } from "../../model/snakeViewModel.js";
import "./SnakeBoard.css";

interface SnakeBoardProps {
  readonly currentOverall: number | undefined;
  readonly humanTeamId: string;
  readonly picks: readonly SnakeBoardPick[];
  readonly players: readonly SnakeBoardPlayer[];
}

const cellClass = (pick: SnakeBoardPick, humanTeamId: string, current: boolean): string => [
  "snake-board__cell",
  pick.teamId === humanTeamId ? "snake-board__cell--mine" : "",
  current ? "snake-board__cell--current" : "",
  pick.selection === undefined ? "" : `snake-board__cell--${pick.selection.source}`,
].filter(Boolean).join(" ");

export const SnakeBoard = ({
  currentOverall,
  humanTeamId,
  picks,
  players,
}: SnakeBoardProps) => {
  const names = playerNamesById(players);
  const rounds = snakeRounds(picks);
  const teams = rounds[0]?.picks.map(pick => ({ id: pick.teamId, name: pick.teamName })) ?? [];
  const teamIndex = new Map(teams.map((team, index) => [team.id, index]));

  return (
    <section aria-labelledby="snake-board-heading" className="snake-board">
      <h2 id="snake-board-heading">Draft board</h2>
      <div className="snake-board__scroll">
        <table aria-label="Draft board" className="snake-board__table">
          <thead>
            <tr>
              <th scope="col">Round</th>
              {teams.map(team => (
                <th
                  className={team.id === humanTeamId ? "snake-board__team-header--mine" : undefined}
                  key={team.id}
                  scope="col"
                >
                  {team.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map(round => (
              <tr key={round.round}>
                <th scope="row">Round {round.round}</th>
                {[...round.picks]
                  .sort((left, right) => (
                    (teamIndex.get(left.teamId) ?? Number.MAX_SAFE_INTEGER)
                    - (teamIndex.get(right.teamId) ?? Number.MAX_SAFE_INTEGER)
                  ))
                  .map(pick => (
                    <td
                      className={cellClass(pick, humanTeamId, pick.overall === currentOverall)}
                      key={pick.overall}
                    >
                      <span className="snake-board__pick-label">{pickLabel(pick)}</span>
                      <span className="snake-board__player">
                        {pick.selection === undefined
                          ? (pick.overall === currentOverall ? "On the clock" : "-")
                          : names.get(pick.selection.playerId) ?? pick.selection.playerId}
                      </span>
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
