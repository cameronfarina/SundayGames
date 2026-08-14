import { useDeferredValue, useMemo, useReducer } from "react";
import { Star } from "lucide-react";
import type { PlayerCatalog, PracticePlayer } from "../../api/playerCatalogSchema";
import type { PracticeShortlistItem } from "../../api/practiceContextSchema";
import {
  filterAndSortPlayers,
  playerKey,
  playerMarketValue,
  playerMyValue,
  positionTone,
  rankPlayers,
  type PlayerSort,
} from "../../model/playerBoard";
import { PracticeSelect } from "../PracticeSelect/PracticeSelect";
import { useIncrementalRows } from "./hooks/useIncrementalRows";
import "./PlayerBoard.css";
import "./PlayerBoardTable.css";
import "./PlayerBoardResponsive.css";
import "./positionColors.css";

interface PlayerBoardProps {
  readonly catalog: PlayerCatalog;
  readonly onToggleTarget: (player: PracticePlayer) => void;
  readonly shortlist: readonly PracticeShortlistItem[];
  readonly targetChangesDisabled: boolean;
}

interface FilterState {
  readonly position: string;
  readonly search: string;
  readonly shortlistOnly: boolean;
  readonly sort: PlayerSort;
}

type FilterAction =
  | { readonly type: "position"; readonly value: string }
  | { readonly type: "search"; readonly value: string }
  | { readonly type: "shortlist" }
  | { readonly type: "sort"; readonly value: PlayerSort };

const filterReducer = (state: FilterState, action: FilterAction): FilterState => {
  if (action.type === "position") return { ...state, position: action.value };
  if (action.type === "search") return { ...state, search: action.value };
  if (action.type === "shortlist") return { ...state, shortlistOnly: !state.shortlistOnly };
  return { ...state, sort: action.value };
};

const initialFilters: FilterState = { position: "ALL", search: "", shortlistOnly: false, sort: "market" };
const positions = ["ALL", "QB", "RB", "WR", "TE", "FLEX", "DST", "K"];
const sortOptions = [
  { label: "Market value", value: "market" },
  { label: "My value", value: "mine" },
  { label: "Rank", value: "rank" },
];

const sortValue = (value: string): PlayerSort => {
  if (value === "mine") return "mine";
  if (value === "rank") return "rank";
  return "market";
};

export function PlayerBoard({ catalog, onToggleTarget, shortlist, targetChangesDisabled }: PlayerBoardProps) {
  const [filters, dispatch] = useReducer(filterReducer, initialFilters);
  const deferredSearch = useDeferredValue(filters.search);
  const shortlisted = useMemo(() => new Set(shortlist.map(item => playerKey(item.playerName))), [shortlist]);
  const rankedPlayers = useMemo(() => rankPlayers(catalog.players), [catalog.players]);
  const players = useMemo(() => filterAndSortPlayers(
    rankedPlayers,
    {
      position: filters.position, search: deferredSearch,
      shortlistOnly: filters.shortlistOnly,
      sort: filters.sort,
    },
    shortlisted,
  ), [deferredSearch, filters.position, filters.shortlistOnly, filters.sort, rankedPlayers, shortlisted]);
  const { revealMore, revealRowCount, visibleRowCount } = useIncrementalRows(players.length, [
    catalog.players,
    filters.position,
    deferredSearch,
    filters.shortlistOnly ? shortlisted : undefined,
    filters.sort,
  ]);
  const visiblePlayers = players.slice(0, visibleRowCount);

  return (
    <section aria-labelledby="player-board-title" className="player-board">
      <div className="player-board__heading">
        <div><p className="practice-eyebrow">Player board</p><h2 id="player-board-title">Available players</h2></div>
        <p aria-live="polite">{visiblePlayers.length} shown / {players.length} matching / {catalog.players.length} loaded</p>
      </div>
      <div aria-label="Filter by position" className="player-board__positions" role="group">
        {positions.map(position => (
          <button
            aria-pressed={filters.position === position}
            className={`position-filter position-filter--${positionTone(position)}`}
            key={position}
            onClick={() => { dispatch({ type: "position", value: position }); }}
            type="button"
          >{position === "ALL" ? "All" : position}</button>
        ))}
      </div>
      <div className="player-board__controls">
        <label className="player-board__search"><span>Search players</span><input
          onChange={event => { dispatch({ type: "search", value: event.currentTarget.value }); }}
          placeholder="Player, position, or NFL team"
          type="search"
          value={filters.search}
        /></label>
        <PracticeSelect
          label="Sort players"
          onValueChange={value => { dispatch({ type: "sort", value: sortValue(value) }); }}
          options={sortOptions}
          value={filters.sort}
        />
        <label className="player-board__target-filter"><input
          checked={filters.shortlistOnly}
          onChange={() => { dispatch({ type: "shortlist" }); }}
          type="checkbox"
        />Draft targets only ({shortlist.length})</label>
      </div>
      <div className="player-board__table-wrap">
        <table><thead><tr><th>Target</th><th>Rank</th><th>Player</th><th>Pos</th><th>NFL</th><th>Bye</th><th>Market</th><th>My value</th></tr></thead>
          <tbody>{visiblePlayers.map(({ player, rank }) => {
            const isTarget = shortlisted.has(playerKey(player.name));
            return <tr className={`player-row player-row--${positionTone(player.position)}`} key={player.name}>
              <td><button
                aria-label={`${isTarget ? "Remove" : "Add"} ${player.name} ${isTarget ? "from" : "to"} draft targets`}
                aria-pressed={isTarget}
                className="target-button"
                disabled={targetChangesDisabled}
                onClick={() => { onToggleTarget(player); }}
                type="button"
              ><Star aria-hidden="true" fill={isTarget ? "currentColor" : "none"} size={19} /></button></td>
              <td>{rank}</td><td className="player-row__name">{player.name}{player.isKeeper === true && <span className="keeper-badge">Keeper{player.keeperPrice === undefined ? "" : ` · $${String(player.keeperPrice)}`}</span>}</td>
              <td><span className={`position-label position-label--${positionTone(player.position)}`}>{player.position}</span></td>
              <td>{player.teamAbbreviation ?? "FA"}</td><td>{player.byeWeek ?? "-"}</td>
              <td>${Math.round(playerMarketValue(player))}</td><td>${Math.round(playerMyValue(player))}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {revealRowCount > 0 && <div className="player-board__reveal"><button
        className="position-filter"
        onClick={revealMore}
        type="button"
      >Show {revealRowCount} more players</button></div>}
      {players.length === 0 && <p className="practice-empty">No players match these filters.</p>}
    </section>
  );
}
