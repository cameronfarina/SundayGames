import type { LiveDraftPick } from "../../api/liveDraftSchemas";
import "./SnakePickBoard.css";

interface SnakePickBoardProps {
  readonly canCorrect: boolean;
  readonly onCorrect: (pickEventId: string, playerName: string) => void;
  readonly onTheClock?: LiveDraftPick | undefined;
  readonly picks: readonly LiveDraftPick[];
}

export const SnakePickBoard = ({
  canCorrect,
  onCorrect,
  onTheClock,
  picks,
}: SnakePickBoardProps) => {
  const rounds = [...new Set(picks.map(pick => pick.round))];

  return (
    <section aria-labelledby="live-snake-board-title" className="live-panel snake-pick-board">
      <header className="live-panel__header">
        <h2 id="live-snake-board-title">Draft board</h2>
        <span>{onTheClock === undefined ? "Complete" : `Pick ${onTheClock.overall}`}</span>
      </header>
      <div className="snake-pick-board__scroll">
        {rounds.map(round => (
          <div className="snake-pick-board__round" key={round}>
            <strong>Round {round}</strong>
            <ol className="snake-pick-board__picks">
              {picks.filter(pick => pick.round === round).map(pick => {
                const current = pick.overall === onTheClock?.overall;
                return <li className={current ? "snake-pick-board__pick snake-pick-board__pick--current" : "snake-pick-board__pick"} key={pick.overall}>
                  <span className="snake-pick-board__number">{pick.overall}</span>
                  <span className="snake-pick-board__team">{pick.ownerDisplayName}</span>
                  <span className="snake-pick-board__player">
                    {pick.playerName ?? (current ? "On the clock" : "—")}
                  </span>
                  {canCorrect && pick.pickEventId !== undefined && <button
                    className="snake-pick-board__correct"
                    onClick={() => {
                      const playerName = window.prompt("Replace this pick with which player?", pick.playerName ?? "");
                      if (playerName !== null && playerName.trim().length > 0) onCorrect(pick.pickEventId!, playerName.trim());
                    }}
                    type="button"
                  >Correct</button>}
                </li>;
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
};
