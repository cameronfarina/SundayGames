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

  return (
    <section aria-labelledby="snake-board-heading" className="snake-board">
      <h2 id="snake-board-heading">Draft board</h2>
      <div className="snake-board__scroll">
        {rounds.map(round => (
          <div className="snake-board__round" key={round.round}>
            <span className="snake-board__round-label">Round {round.round}</span>
            <ol className="snake-board__picks">
              {round.picks.map(pick => (
                <li
                  className={cellClass(pick, humanTeamId, pick.overall === currentOverall)}
                  key={pick.overall}
                >
                  <span className="snake-board__pick-label">{pickLabel(pick)}</span>
                  <span className="snake-board__team">{pick.teamName}</span>
                  <span className="snake-board__player">
                    {pick.selection === undefined
                      ? (pick.overall === currentOverall ? "On the clock" : "-")
                      : names.get(pick.selection.playerId) ?? pick.selection.playerId}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
};
