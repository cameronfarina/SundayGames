import { useDeferredValue, useMemo, useReducer } from "react";
import { Check } from "lucide-react";
import { useIncrementalRows } from "../../../../shared/hooks/useIncrementalRows";
import type { PlayerCatalog, PracticePlayer } from "../../api/playerCatalogSchema";
import type { PracticeShortlistItem } from "../../api/practiceContextSchema";
import {
  filterAndSortPlayers,
  playerKey,
  playerMyValue,
  playerSortFrom,
  rankPlayers,
  rankPlayersWithPersonalValues,
  type PlayerSort,
} from "../../model/playerBoard";
import { PracticeSelect } from "../PracticeSelect/PracticeSelect";
import { PlayerBoardRow } from "./PlayerBoardRow";
import { PositionFilters } from "./PositionFilters";
import "./PlayerBoard.css";
import "./PlayerBoardTable.css";
import "./PlayerBoardResponsive.css";
import "./positionColors.css";
interface PlayerBoardProps {
  readonly catalog: PlayerCatalog;
  readonly onSaveMyValue: (player: PracticePlayer, value: number) => void;
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

const initialFilters: FilterState = { position: "ALL", search: "", shortlistOnly: false, sort: "rank" };
const sortOptions = [
  { label: "Market value", value: "market" },
  { label: "Simulation price", value: "simulation" },
  { label: "My value", value: "mine" },
  { label: "Rank", value: "rank" },
];

export function PlayerBoard({ catalog, onSaveMyValue, onToggleTarget, shortlist, targetChangesDisabled }: PlayerBoardProps) {
  const [filters, dispatch] = useReducer(filterReducer, initialFilters);
  const draftFormat = catalog.draftFormat ?? "auction";
  const auction = draftFormat === "auction";
  const activeSort = auction ? filters.sort : "rank";
  const deferredSearch = useDeferredValue(filters.search);
  const flexKey = (catalog.flexPositions ?? []).join(",");
  const flexPositions = useMemo(() => (flexKey.length === 0 ? [] : flexKey.split(",")), [flexKey]);
  const shortlisted = useMemo(() => new Set(shortlist.map(item => playerKey(item.playerName))), [shortlist]);
  const rankedPlayers = useMemo(
    () => auction
      ? rankPlayersWithPersonalValues(catalog.players, shortlist)
      : rankPlayers(catalog.players),
    [auction, catalog.players, shortlist],
  );
  const players = useMemo(() => filterAndSortPlayers(
    rankedPlayers,
    {
      flexPositions,
      position: filters.position, search: deferredSearch,
      shortlistOnly: filters.shortlistOnly,
      sort: activeSort,
    },
    shortlisted,
  ), [activeSort, deferredSearch, filters.position, filters.shortlistOnly, flexPositions, rankedPlayers, shortlisted]);
  const { revealMore, revealRowCount, visibleRowCount } = useIncrementalRows(players.length, [
    catalog.players,
    filters.position,
    deferredSearch,
    filters.shortlistOnly ? shortlisted : undefined,
    activeSort,
  ]);
  const visiblePlayers = players.slice(0, visibleRowCount);

  return (
    <section aria-labelledby="player-board-title" className={`player-board player-board--${draftFormat}`}>
      <div className="player-board__heading">
        <div><p className="practice-eyebrow">Player board</p><h2 id="player-board-title">Available players</h2></div>
        <p aria-live="polite">{visiblePlayers.length} shown / {players.length} matching / {catalog.players.length} loaded</p>
      </div>
      <PositionFilters
        flexPositions={flexPositions}
        onSelect={position => { dispatch({ type: "position", value: position }); }}
        selected={filters.position}
      />
      <div className="player-board__controls">
        <div className="player-board__search"><input
          aria-label="Search players"
          onChange={event => { dispatch({ type: "search", value: event.currentTarget.value }); }}
          placeholder="Search players, position or NFL team"
          type="search"
          value={filters.search}
        /></div>
        {auction && <PracticeSelect
          label="Sort players"
          onValueChange={value => { dispatch({ type: "sort", value: playerSortFrom(value) }); }}
          options={sortOptions}
          value={filters.sort}
        />}
        <label className="player-board__target-filter"><input
          checked={filters.shortlistOnly}
          onChange={() => { dispatch({ type: "shortlist" }); }}
          type="checkbox"
        /><span aria-hidden="true" className="player-board__target-checkbox"><Check size={13} strokeWidth={3} /></span>
        <span>Draft targets only ({shortlist.length})</span></label>
      </div>
      <div className="player-board__table-wrap">
        <table>
          <colgroup>
            <col className="player-board__target-column" />
            <col className="player-board__rank-column" />
            <col className="player-board__player-column" />
            <col /><col /><col />
            {auction && <><col /><col /><col /></>}
          </colgroup>
          <thead><tr><th>Target</th><th>Rank</th><th>Player</th><th>Pos</th><th>NFL</th><th>Bye</th>
            {auction && <><th>Market</th><th>Simulation</th><th>My value</th></>}
          </tr></thead>
          <tbody>{visiblePlayers.map(({ player, rank }) => <PlayerBoardRow
            draftFormat={draftFormat}
            isTarget={shortlisted.has(playerKey(player.name))}
            key={`${player.name}:${auction ? String(Math.round(playerMyValue(player))) : "snake"}`}
            onSaveMyValue={onSaveMyValue}
            onToggleTarget={onToggleTarget}
            player={player}
            rank={rank}
            targetChangesDisabled={targetChangesDisabled}
          />)}</tbody>
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
