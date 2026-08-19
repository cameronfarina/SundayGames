import { useState, type SyntheticEvent } from "react";
import {
  Button,
  InlineNotice,
  ProgressButton,
  TextField,
  type NoticeVariant,
} from "../../../../shared/ui";
import type { LiveDraftRoom } from "../../api/liveDraftSchemas";
import "./DraftCommandPanel.css";

interface DraftFeedback {
  readonly message: string;
  readonly variant: NoticeVariant;
}

interface DraftCommandPanelProps {
  readonly busy?: boolean;
  readonly command: string;
  readonly feedback?: DraftFeedback;
  readonly onCommandChange: (command: string) => void;
  readonly onEnd: () => void;
  readonly onLogPick: () => void;
  readonly onLogSale: () => void;
  readonly onPauseOrResume: () => void;
  readonly onStart: () => void;
  readonly onUndo: () => void;
  readonly room: LiveDraftRoom;
}

export const DraftCommandPanel = ({
  busy = false,
  command,
  feedback,
  onCommandChange,
  onEnd,
  onLogPick,
  onLogSale,
  onPauseOrResume,
  onStart,
  onUndo,
  room,
}: DraftCommandPanelProps) => {
  const [validation, setValidation] = useState<string>();
  const snake = room.draftFormat === "snake";
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (command.trim().length === 0) {
      setValidation(snake ? "Choose or enter a player." : "Enter an owner, player, and sale price.");
      return;
    }
    setValidation(undefined);
    if (snake) onLogPick();
    else onLogSale();
  };
  const canManage = room.canMutateRoom && room.status !== "ended";
  const live = room.status === "live";
  const paused = room.status === "paused";
  const canUndo = snake
    ? room.picks?.some(pick => pick.source === "pick") === true
    : room.salesLog.length > 0;

  return (
    <section aria-labelledby="draft-command-title" className="live-panel draft-command">
      <header className="live-panel__header">
        <h2 id="draft-command-title">Draft command</h2>
        <span>{room.role === "commissioner" ? "Commissioner" : room.role}</span>
      </header>
      <div className="draft-command__body">
        {canManage && <>
          <form className="draft-command__sale" onSubmit={submit}>
            <TextField
              {...(validation === undefined ? {} : { error: validation })}
              id={snake ? "live-pick-command" : "live-sale-command"}
              label={snake ? "Player" : "Sale command"}
              onChange={event => { onCommandChange(event.currentTarget.value); }}
              placeholder={snake ? "Puka Nacua" : "Owner11 drafted Puka Nacua for 62"}
              value={command}
            />
            <ProgressButton busy={busy} disabled={!live} percent={busy ? 60 : 0} type="submit">
              {snake ? "Draft player" : "Log sale"}
            </ProgressButton>
          </form>
          {snake && room.onTheClock !== undefined && <p className="draft-command__member-note">
            On the clock: {room.onTheClock.ownerDisplayName} — round {room.onTheClock.round}, pick {room.onTheClock.pickInRound}
          </p>}
          <div aria-label="Draft lifecycle controls" className="draft-command__actions">
            <Button disabled={busy || !["setup", "countdown"].includes(room.status)} onClick={onStart} variant="secondary">
              Start draft
            </Button>
            <Button disabled={busy || (!live && !paused)} onClick={onPauseOrResume} variant="secondary">
              {paused ? "Resume draft" : "Pause draft"}
            </Button>
            <Button disabled={busy || !live || !canUndo} onClick={onUndo} variant="secondary">
              {snake ? "Undo latest pick" : "Undo latest sale"}
            </Button>
            <Button disabled={busy || (!live && !paused)} onClick={onEnd} variant="danger">End draft</Button>
          </div>
        </>}
        {!room.canMutateRoom && <p className="draft-command__member-note">
          League members can follow the live board, rosters, and draft progress here.
        </p>}
        {feedback !== undefined && <InlineNotice variant={feedback.variant}>{feedback.message}</InlineNotice>}
      </div>
    </section>
  );
};
