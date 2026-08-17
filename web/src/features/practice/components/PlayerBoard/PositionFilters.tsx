import { useMemo } from "react";
import { FLEX_FILTER, positionTone } from "../../model/playerBoard";

interface PositionFiltersProps {
  readonly flexPositions: readonly string[];
  readonly onSelect: (position: string) => void;
  readonly selected: string;
}

// A league without a flexible starting slot has nothing for FLEX to show, so
// the button only appears when the league actually uses one.
const positionsFor = (flexPositions: readonly string[]): readonly string[] => [
  "ALL", "QB", "RB", "WR", "TE",
  ...(flexPositions.length > 0 ? [FLEX_FILTER] : []),
  "DST", "K",
];

export function PositionFilters({ flexPositions, onSelect, selected }: PositionFiltersProps) {
  const positions = useMemo(() => positionsFor(flexPositions), [flexPositions]);

  return (
    <div aria-label="Filter by position" className="player-board__positions" role="group">
      {positions.map(position => (
        <button
          aria-pressed={selected === position}
          className={`position-filter position-filter--${positionTone(position)}`}
          key={position}
          onClick={() => { onSelect(position); }}
          type="button"
        >{position === "ALL" ? "All" : position}</button>
      ))}
    </div>
  );
}
