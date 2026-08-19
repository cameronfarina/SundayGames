import type { LiveDraftPick } from "../../api/liveDraftSchemas";
import { pickLabel } from "../../lib/pickLabel";
import "./PickBoard.css";

interface PickBoardProps {
  readonly onTheClock?: LiveDraftPick | undefined;
  readonly picks: readonly LiveDraftPick[];
  readonly viewedTeamId?: string | undefined;
}

interface PickRound {
  readonly round: number;
  readonly picks: readonly LiveDraftPick[];
}

const roundsOf = (picks: readonly LiveDraftPick[]): readonly PickRound[] => {
  const byRound = new Map<number, LiveDraftPick[]>();
  for (const pick of picks) byRound.set(pick.round, [...(byRound.get(pick.round) ?? []), pick]);
  return [...byRound.entries()]
    .sort(([left], [right]) => left - right)
    .map(([round, roundPicks]) => ({ round, picks: roundPicks }));
};

const cellClass = (pick: LiveDraftPick, viewedTeamId: string | undefined, current: boolean): string => [
  "pick-board__cell",
  pick.teamId === viewedTeamId ? "pick-board__cell--mine" : "",
  current ? "pick-board__cell--current" : "",
  pick.source === "keeper" ? "pick-board__cell--keeper" : "",
].filter(Boolean).join(" ");

export const PickBoard = ({ onTheClock, picks, viewedTeamId }: PickBoardProps) => (
  <section aria-labelledby="pick-board-heading" className="pick-board">
    <h2 id="pick-board-heading">Draft board</h2>
    <div className="pick-board__scroll">
      {roundsOf(picks).map(pickRound => (
        <div className="pick-board__round" key={pickRound.round}>
          <span className="pick-board__round-label">Round {pickRound.round}</span>
          <ol className="pick-board__picks">
            {pickRound.picks.map(pick => (
              <li
                className={cellClass(pick, viewedTeamId, pick.overall === onTheClock?.overall)}
                key={pick.overall}
              >
                <span className="pick-board__pick-label">{pickLabel(pick)}</span>
                <span className="pick-board__team">{pick.ownerDisplayName}</span>
                <span className="pick-board__player">
                  {pick.playerName ?? (pick.overall === onTheClock?.overall ? "On the clock" : "-")}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  </section>
);
