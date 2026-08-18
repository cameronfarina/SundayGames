import { useState } from "react";
import { Button } from "../../../../shared/ui/index.js";
import type { SnakeBoardPlayer, SnakeTeam } from "../../api/snakeStateSchemas.js";
import { positionAccent, positionFilters, type PositionFilter } from "../../model/auctionViewModel.js";
import { filterSnakePlayers, snakeTeamCanRoster } from "../../model/snakeViewModel.js";
import "../PlayerBoard/PlayerBoard.css";

interface SnakePlayerBoardProps {
  readonly canPick: boolean;
  readonly humanTeam: SnakeTeam | undefined;
  readonly onPick: (playerId: string) => void;
  readonly players: readonly SnakeBoardPlayer[];
}

const rounded = (value: number): string => String(Math.round(value));

export const SnakePlayerBoard = ({
  canPick,
  humanTeam,
  onPick,
  players,
}: SnakePlayerBoardProps) => {
  const [position, setPosition] = useState<PositionFilter>("ALL");
  const [search, setSearch] = useState("");
  const visiblePlayers = filterSnakePlayers(players, search, position);

  return (
    <section aria-labelledby="available-player-heading" className="player-board">
      <div className="player-board__heading-row">
        <h2 id="available-player-heading">Available players</h2>
        <span>{String(visiblePlayers.length)} shown</span>
      </div>
      <div aria-label="Filter by position" className="player-board__filters" role="group">
        {positionFilters.map(filter => (
          <Button
            aria-pressed={position === filter}
            className={positionAccent(filter)}
            key={filter}
            onClick={() => { setPosition(filter); }}
            variant="secondary"
          >
            {filter}
          </Button>
        ))}
      </div>
      <label className="player-board__search-label" htmlFor="mock-player-search">
        Search available players
      </label>
      <input
        className="player-board__search"
        id="mock-player-search"
        onChange={event => { setSearch(event.currentTarget.value); }}
        placeholder="Player, position, or NFL team"
        type="search"
        value={search}
      />
      <div className="player-board__table-wrap">
        <table aria-label="Available players">
          <thead>
            <tr>
              <th>Rank</th>
              <th>ADP</th>
              <th>Player</th>
              <th>Pos</th>
              <th>NFL</th>
              <th>Bye</th>
              <th><span className="player-board__action-label">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {visiblePlayers.map(player => (
              <tr className={positionAccent(player.position)} key={player.id}>
                <td>{rounded(player.personalRank ?? player.rank)}</td>
                <td>{rounded(player.adp)}</td>
                <th scope="row">{player.name}</th>
                <td className={positionAccent(player.position)}>{player.position}</td>
                <td>{player.teamAbbreviation ?? "-"}</td>
                <td>{player.byeWeek ?? "-"}</td>
                <td>
                  <Button
                    aria-label={`Draft ${player.name}`}
                    disabled={!canPick || !snakeTeamCanRoster(humanTeam, player.position)}
                    onClick={() => { onPick(player.id); }}
                    variant="secondary"
                  >
                    Draft
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visiblePlayers.length === 0 && (
        <p className="player-board__empty">No available players match these filters.</p>
      )}
    </section>
  );
};
