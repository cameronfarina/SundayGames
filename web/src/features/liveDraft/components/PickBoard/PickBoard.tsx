import type { LiveDraftPick } from "../../api/liveDraftSchemas";
import type { PickBoardCell } from "../../lib/pickGrid";
import { pickBoardColumns, pickBoardRows } from "../../lib/pickGrid";
import { pickLabel } from "../../lib/pickLabel";
import "./PickBoard.css";

interface PickBoardProps {
  readonly onTheClock?: LiveDraftPick | undefined;
  readonly picks: readonly LiveDraftPick[];
  readonly viewedTeamId?: string | undefined;
}

interface BoardCellProps {
  readonly cell: PickBoardCell;
  readonly onTheClock: LiveDraftPick | undefined;
  readonly viewedTeamId: string | undefined;
}

const cellClass = (pick: LiveDraftPick, viewedTeamId: string | undefined, current: boolean): string => [
  "pick-board__cell",
  pick.teamId === viewedTeamId ? "pick-board__cell--mine" : "",
  current ? "pick-board__cell--current" : "",
  pick.source === "keeper" ? "pick-board__cell--keeper" : "",
].filter(Boolean).join(" ");

const BoardCell = ({ cell, onTheClock, viewedTeamId }: BoardCellProps) => {
  const pick = cell.pick;
  if (pick === undefined) return <td className="pick-board__cell" />;
  const current = pick.overall === onTheClock?.overall;

  return (
    <td className={cellClass(pick, viewedTeamId, current)}>
      <span className="pick-board__pick-label">{pickLabel(pick)}</span>
      <span className="pick-board__player">
        {pick.playerName ?? (current ? "On the clock" : "-")}
      </span>
    </td>
  );
};

export const PickBoard = ({ onTheClock, picks, viewedTeamId }: PickBoardProps) => {
  const columns = pickBoardColumns(picks);
  const rows = pickBoardRows(picks, columns);

  return (
    <section aria-labelledby="pick-board-heading" className="pick-board">
      <h2 id="pick-board-heading">Draft board</h2>
      <div className="pick-board__scroll">
        <table className="pick-board__table">
          <thead>
            <tr>
              <th className="pick-board__corner" scope="col">Round</th>
              {columns.map(column => (
                <th
                  className={column.teamId === viewedTeamId
                    ? "pick-board__team pick-board__team--mine"
                    : "pick-board__team"}
                  key={column.teamId}
                  scope="col"
                >{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.round}>
                <th className="pick-board__round" scope="row">{row.round}</th>
                {row.cells.map(cell => (
                  <BoardCell cell={cell} key={cell.teamId} onTheClock={onTheClock} viewedTeamId={viewedTeamId} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
