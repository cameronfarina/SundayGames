import { useState } from "react";
import { Button } from "../../../../shared/ui/index.js";
import type { AuctionPlayer, AuctionTeam } from "../../api/auctionBoardSchemas.js";
import {
  filterAuctionPlayers,
  positionAccent,
  positionFilters,
  teamCanRoster,
  type PositionFilter,
} from "../../model/auctionViewModel.js";
import "./PlayerBoard.css";

interface PlayerBoardProps {
  readonly canNominate: boolean;
  readonly humanTeam: AuctionTeam | undefined;
  readonly onNominate: (playerId: string) => void;
  readonly players: readonly AuctionPlayer[];
}

const money = (value: number): string => `$${String(Math.round(value))}`;

export const PlayerBoard = ({
  canNominate,
  humanTeam,
  onNominate,
  players,
}: PlayerBoardProps) => {
  const [position, setPosition] = useState<PositionFilter>("ALL");
  const [search, setSearch] = useState("");
  const visiblePlayers = filterAuctionPlayers(players, search, position);

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
              <th>Market value</th>
              <th>Our value</th>
              <th>Player</th>
              <th>Pos</th>
              <th>NFL</th>
              <th>Bye</th>
              <th>Status</th>
              <th><span className="player-board__action-label">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {visiblePlayers.map(player => {
              const canRoster = teamCanRoster(humanTeam, player.position);
              return (
                <tr className={positionAccent(player.position)} key={player.id}>
                  <td>{money(player.expectedPrice)}</td>
                  <td>{money(player.humanValue ?? player.expectedPrice)}</td>
                  <th scope="row">{player.name}</th>
                  <td className={positionAccent(player.position)}>{player.position}</td>
                  <td>{player.teamAbbreviation ?? "-"}</td>
                  <td>{player.byeWeek ?? "-"}</td>
                  <td>{player.status === "nominated" ? "Nominated" : "Available"}</td>
                  <td>
                    <Button
                      aria-label={`Nominate ${player.name}`}
                      disabled={!canNominate || !canRoster || player.status !== "available"}
                      onClick={() => { onNominate(player.id); }}
                      variant="secondary"
                    >
                      Nominate
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visiblePlayers.length === 0 && (
        <p className="player-board__empty">No available players match these filters.</p>
      )}
    </section>
  );
};
