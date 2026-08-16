import type { PlayerCatalog, PracticePlayer } from "../../api/playerCatalogSchema";
import type { PracticeShortlistItem } from "../../api/practiceContextSchema";
import { PlayerBoard } from "../PlayerBoard/PlayerBoard";

interface PracticePlayerBoardProps {
  readonly catalog: PlayerCatalog | undefined;
  readonly error: Error | null;
  readonly isPending: boolean;
  readonly onRetry: () => void;
  readonly onToggleTarget: (player: PracticePlayer) => void;
  readonly shortlist: readonly PracticeShortlistItem[];
  readonly targetChangesDisabled: boolean;
}

export function PracticePlayerBoard(props: PracticePlayerBoardProps) {
  if (props.isPending) return <p role="status">Loading the player board…</p>;
  if (props.error !== null) return <section className="practice-page__error">
    <p>{props.error.message}</p>
    <button onClick={props.onRetry} type="button">Retry board</button>
  </section>;
  if (props.catalog === undefined || props.catalog.players.length === 0) {
    return <p className="practice-empty">No players are available for this board yet.</p>;
  }
  return <PlayerBoard
    catalog={props.catalog}
    onToggleTarget={props.onToggleTarget}
    shortlist={props.shortlist}
    targetChangesDisabled={props.targetChangesDisabled}
  />;
}
