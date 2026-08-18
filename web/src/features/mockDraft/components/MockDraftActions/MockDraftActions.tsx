import { useState } from "react";
import { Button, Dialog, ProgressButton } from "../../../../shared/ui/index.js";

/** Both draft formats expose the same three session flags, so this takes only those. */
interface MockDraftSessionFlags {
  readonly session: {
    readonly canComplete: boolean;
    readonly canUndo: boolean;
    readonly status: "setup" | "active" | "completed";
  };
}

interface MockDraftActionsProps {
  readonly busy: boolean;
  readonly onAbandon: () => Promise<unknown>;
  readonly onComplete: () => void;
  readonly onStart: () => void;
  readonly onUndo: () => void;
  readonly state: MockDraftSessionFlags;
}

export const MockDraftActions = ({
  busy,
  onAbandon,
  onComplete,
  onStart,
  onUndo,
  state,
}: MockDraftActionsProps) => {
  const [confirmingAbandon, setConfirmingAbandon] = useState(false);
  const completed = state.session.status === "completed";
  const abandon = () => {
    onAbandon()
      .then(() => { setConfirmingAbandon(false); })
      .catch(() => undefined);
  };

  return (
    <div className="mock-draft-actions">
      {state.session.status === "setup" && (
        <ProgressButton busy={busy} onClick={onStart} percent={busy ? 55 : 0}>Start draft</ProgressButton>
      )}
      {!completed && state.session.status !== "setup" && (
        <>
          <Button disabled={busy || !state.session.canUndo} onClick={onUndo} variant="secondary">
            Undo pick
          </Button>
          <Button disabled={busy || !state.session.canComplete} onClick={onComplete} variant="secondary">
            Finish mock
          </Button>
        </>
      )}
      {!completed && (
        <Dialog
          description="This discards every pick in this mock and cannot be undone."
          footer={<Button disabled={busy} onClick={abandon} variant="danger">Abandon mock</Button>}
          onOpenChange={setConfirmingAbandon}
          open={confirmingAbandon}
          title="Abandon this mock?"
          trigger={<Button variant="danger">Abandon mock</Button>}
        >
          Your completed simulations and other mock drafts will not be affected.
        </Dialog>
      )}
    </div>
  );
};
