import { useState } from "react";
import { Star } from "lucide-react";
import { IconButton } from "../../../../shared/ui";
import type { PracticePlayer } from "../../api/playerCatalogSchema";
import {
  playerMarketValue,
  playerMyValue,
  playerSimulationValue,
  positionTone,
} from "../../model/playerBoard";

interface PlayerBoardRowProps {
  readonly isTarget: boolean;
  readonly onSaveMyValue: (player: PracticePlayer, value: number) => void;
  readonly onToggleTarget: (player: PracticePlayer) => void;
  readonly player: PracticePlayer;
  readonly rank: number;
  readonly targetChangesDisabled: boolean;
}

export function PlayerBoardRow({
  isTarget,
  onSaveMyValue,
  onToggleTarget,
  player,
  rank,
  targetChangesDisabled,
}: PlayerBoardRowProps) {
  const personalValue = Math.round(playerMyValue(player));
  const [draftValue, setDraftValue] = useState(String(personalValue));
  const saveMyValue = () => {
    const value = Number(draftValue);
    if (!Number.isInteger(value) || value < 1) {
      setDraftValue(String(personalValue));
      return;
    }
    if (value !== personalValue) onSaveMyValue(player, value);
  };
  const action = isTarget ? "Remove" : "Add";
  const direction = isTarget ? "from" : "to";
  const targetLabel = `${action} ${player.name} ${direction} simulation plan`;
  return (
    <tr className={`player-row player-row--${positionTone(player.position)}`}>
      <td><IconButton
        aria-pressed={isTarget}
        className="target-button"
        disabled={targetChangesDisabled}
        label={targetLabel}
        onClick={() => { onToggleTarget(player); }}
      ><Star aria-hidden="true" fill={isTarget ? "currentColor" : "none"} size={19} /></IconButton></td>
      <td>{rank}</td>
      <td className="player-row__name">{player.name}</td>
      <td><span className={`position-label position-label--${positionTone(player.position)}`}>{player.position}</span></td>
      <td>{player.teamAbbreviation ?? "FA"}</td>
      <td>{player.byeWeek ?? "-"}</td>
      <td>${Math.round(playerMarketValue(player))}</td>
      <td>${Math.round(playerSimulationValue(player))}</td>
      <td><label className="player-row__value-editor"><span aria-hidden="true">$</span><span className="sr-only">My value for {player.name}</span><input
        disabled={targetChangesDisabled}
        inputMode="numeric"
        min={1}
        onBlur={saveMyValue}
        onChange={event => { setDraftValue(event.currentTarget.value); }}
        onKeyDown={event => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraftValue(String(personalValue));
          }
        }}
        type="number"
        value={draftValue}
      /></label></td>
    </tr>
  );
}
