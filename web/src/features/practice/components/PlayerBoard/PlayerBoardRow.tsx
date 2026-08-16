import { Star } from "lucide-react";
import { IconButton } from "../../../../shared/ui";
import type { PracticePlayer } from "../../api/playerCatalogSchema";
import {
  playerMarketValue,
  playerMyValue,
  positionTone,
} from "../../model/playerBoard";

interface PlayerBoardRowProps {
  readonly isTarget: boolean;
  readonly onToggleTarget: (player: PracticePlayer) => void;
  readonly player: PracticePlayer;
  readonly rank: number;
  readonly targetChangesDisabled: boolean;
}

export function PlayerBoardRow({
  isTarget,
  onToggleTarget,
  player,
  rank,
  targetChangesDisabled,
}: PlayerBoardRowProps) {
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
      <td className="player-row__name">{player.name}{player.isKeeper === true && <span className="keeper-badge">
        Keeper{player.keeperPrice === undefined ? "" : ` · $${String(player.keeperPrice)}`}
      </span>}</td>
      <td><span className={`position-label position-label--${positionTone(player.position)}`}>{player.position}</span></td>
      <td>{player.teamAbbreviation ?? "FA"}</td>
      <td>{player.byeWeek ?? "-"}</td>
      <td>${Math.round(playerMarketValue(player))}</td>
      <td>${Math.round(playerMyValue(player))}</td>
    </tr>
  );
}
