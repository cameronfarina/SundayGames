import { Plus } from "lucide-react";
import { useState } from "react";
import { Button, IconButton, TextField } from "../../../../shared/ui";
import type { LiveDraftBoardPlayer } from "../../api/liveDraftSchemas";
import {
  filterBoard,
  formatDollars,
  type LiveDraftPositionFilter,
} from "../../lib/liveDraftDisplay";
import "./PlayerBoard.css";

interface PlayerBoardProps {
  readonly canManage: boolean;
  readonly onUsePlayer: (player: LiveDraftBoardPlayer) => void;
  readonly players: readonly LiveDraftBoardPlayer[];
  readonly roomIsLive: boolean;
}

const positionFilters: LiveDraftPositionFilter[] = ["ALL", "QB", "RB", "WR", "TE", "DST", "K"];
const positionLabel = (position: LiveDraftPositionFilter) => position === "ALL" ? "All" : position;

export const PlayerBoard = ({
  canManage,
  onUsePlayer,
  players,
  roomIsLive,
}: PlayerBoardProps) => {
  const [position, setPosition] = useState<LiveDraftPositionFilter>("ALL");
  const [search, setSearch] = useState("");
  const visiblePlayers = filterBoard(players, search, position);

  return (
    <section aria-labelledby="live-draft-board-title" className="live-panel player-board">
      <header className="live-panel__header">
        <h2 id="live-draft-board-title">Available players</h2>
        <span>{visiblePlayers.length} available / {players.length} loaded</span>
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
            <th scope="col">Bye</th><th scope="col">Market</th><th scope="col">Our value</th>
          </tr></thead>
          <tbody>
            {visiblePlayers.map(player => (
              <tr key={player.normalizedPlayerName}>
                {canManage && <td><IconButton
                  disabled={!roomIsLive}
                  label={`Use ${player.name} in sale command`}
                  onClick={() => { onUsePlayer(player); }}
                ><Plus aria-hidden="true" size={18} /></IconButton></td>}
                <th scope="row">{player.name}</th>
                <td className={`position position--${player.position.toLowerCase()}`}>{player.position}</td>
                <td>{player.teamAbbreviation ?? "FA"}</td>
                <td>{player.byeWeek ?? "--"}</td>
                <td>{formatDollars(player.marketPrice ?? player.expectedPrice)}</td>
                <td>{formatDollars(player.expectedPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visiblePlayers.length === 0 && <p className="live-empty">No available players match these filters.</p>}
    </section>
  );
};
