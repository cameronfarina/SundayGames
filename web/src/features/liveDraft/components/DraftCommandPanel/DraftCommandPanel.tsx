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
  onLogSale,
  onPauseOrResume,
  onStart,
  onUndo,
  room,
}: DraftCommandPanelProps) => {
  const [validation, setValidation] = useState<string>();
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (command.trim().length === 0) {
      setValidation("Enter an owner, player, and sale price.");
      return;
    }
    setValidation(undefined);
    onLogSale();
  };
  const canManage = room.canMutateRoom && room.status !== "ended";
  const live = room.status === "live";
  const paused = room.status === "paused";

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
              id="live-sale-command"
              label="Sale command"
              onChange={event => { onCommandChange(event.currentTarget.value); }}
              placeholder="Cam drafted Puka Nacua for 62"
              value={command}
            />
            <ProgressButton busy={busy} disabled={!live} percent={busy ? 60 : 0} type="submit">
              Log sale
            </ProgressButton>
          </form>
          <div aria-label="Draft lifecycle controls" className="draft-command__actions">
            <Button disabled={busy || !["setup", "countdown"].includes(room.status)} onClick={onStart} variant="secondary">
              Start draft
            </Button>
            <Button disabled={busy || (!live && !paused)} onClick={onPauseOrResume} variant="secondary">
              {paused ? "Resume draft" : "Pause draft"}
            </Button>
            <Button disabled={busy || !live || room.salesLog.length === 0} onClick={onUndo} variant="secondary">
              Undo latest sale
            </Button>
            <Button disabled={busy || (!live && !paused)} onClick={onEnd} variant="danger">End draft</Button>
          </div>
        </>}
        {!room.canMutateRoom && <p className="draft-command__member-note">
          League members can follow the live board, sales, budgets, and rosters here.
        </p>}
        {feedback !== undefined && <InlineNotice variant={feedback.variant}>{feedback.message}</InlineNotice>}
      </div>
    </section>
  );
};
