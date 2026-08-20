import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, IconButton, TextField } from "../../../../shared/ui";
import { useIncrementalRows } from "../../../../shared/hooks/useIncrementalRows";
import type { LiveDraftAdvisory } from "../../api/liveDraftAdvisorySchemas";
import type { LiveDraftBoardPlayer } from "../../api/liveDraftSchemas";
import { advisoryBasisLabel, advisoryByPlayerName } from "../../lib/liveDraftAdvisory";
import {
  filterBoard,
  formatDollars,
  type LiveDraftPositionFilter,
} from "../../lib/liveDraftDisplay";
import { PlayerAdvisory } from "../PlayerAdvisory/PlayerAdvisory";
import "./PlayerBoard.css";

interface PlayerBoardProps {
  readonly advisory?: LiveDraftAdvisory | undefined;
  readonly canManage: boolean;
  readonly commandNoun?: "pick" | "sale" | undefined;
  readonly onUsePlayer: (player: LiveDraftBoardPlayer) => void;
  readonly players: readonly LiveDraftBoardPlayer[];
  readonly roomIsLive: boolean;
}

const positionFilters: LiveDraftPositionFilter[] = ["ALL", "QB", "RB", "WR", "TE", "DST", "K"];
const positionLabel = (position: LiveDraftPositionFilter) => position === "ALL" ? "All" : position;

export const PlayerBoard = ({
  advisory,
  canManage,
  commandNoun = "sale",
  onUsePlayer,
  players,
  roomIsLive,
}: PlayerBoardProps) => {
  const [position, setPosition] = useState<LiveDraftPositionFilter>("ALL");
  const [search, setSearch] = useState("");
  // An advisory that matched nobody leaves the board exactly as it was.
  const overlay = advisory === undefined || advisory.players.length === 0 ? undefined : advisory;
  const advisoryFor = useMemo(() => advisoryByPlayerName(overlay), [overlay]);
  const matchingPlayers = filterBoard(players, search, position);
  const { revealMore, revealRowCount, visibleRowCount } = useIncrementalRows(
    matchingPlayers.length,
    [players, position, search],
  );
  const visiblePlayers = matchingPlayers.slice(0, visibleRowCount);

  return (
    <section aria-labelledby="live-draft-board-title" className="live-panel player-board">
      <header className="live-panel__header">
        <h2 id="live-draft-board-title">Available players</h2>
        <span aria-live="polite">
          {visiblePlayers.length} shown / {matchingPlayers.length} matching / {players.length} loaded
        </span>
      </header>
      <div aria-label="Filter available players by position" className="player-board__filters">
        {positionFilters.map(filter => (
          <Button
            aria-pressed={position === filter}
            className={`position-filter position-filter--${filter.toLowerCase()}`}
            key={filter}
            onClick={() => { setPosition(filter); }}
            variant="secondary"
          >
            {positionLabel(filter)}
          </Button>
        ))}
      </div>
      <TextField
        aria-label="Search available players"
        id="live-player-search"
        label="Search available players"
        onChange={event => { setSearch(event.currentTarget.value); }}
        placeholder="Player, position, or NFL team"
        role="searchbox"
        value={search}
      />
      <div className="player-board__table-wrap">
        <table>
          <thead><tr>
            {canManage && <th scope="col">Use</th>}
            <th scope="col">Player</th><th scope="col">Pos</th><th scope="col">NFL</th>
            <th scope="col">Bye</th>
            {overlay !== undefined && <th scope="col">FP rank</th>}
            <th scope="col">Market</th><th scope="col">Our value</th>
          </tr></thead>
          <tbody>
            {visiblePlayers.map(player => (
              <tr
                className={`player-row player-row--${player.position.toLowerCase()}`}
                key={player.normalizedPlayerName}
              >
                {canManage && <td><IconButton
                  disabled={!roomIsLive}
                  label={`Use ${player.name} in ${commandNoun} command`}
                  onClick={() => { onUsePlayer(player); }}
                ><Plus aria-hidden="true" size={18} /></IconButton></td>}
                <th className="player-board__player-name" scope="row">{player.name}</th>
                <td className={`position position--${player.position.toLowerCase()}`}>{player.position}</td>
                <td>{player.teamAbbreviation ?? "FA"}</td>
                <td>{player.byeWeek ?? "--"}</td>
                {overlay !== undefined && <td>
                  <PlayerAdvisory advisory={advisoryFor.get(player.normalizedPlayerName)} />
                </td>}
                <td>{formatDollars(player.marketPrice ?? player.expectedPrice)}</td>
                <td>{formatDollars(player.expectedPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {overlay !== undefined && <p className="player-board__attribution">
        Data by FantasyPros · {advisoryBasisLabel(overlay)}
      </p>}
      {revealRowCount > 0 && <div className="player-board__reveal">
        <Button onClick={revealMore} variant="secondary">
          Load {revealRowCount} more players
        </Button>
      </div>}
      {matchingPlayers.length === 0 && <p className="live-empty">No available players match these filters.</p>}
    </section>
  );
};
