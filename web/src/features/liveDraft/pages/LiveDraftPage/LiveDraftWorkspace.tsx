import { useState } from "react";
import { PlatformApiError } from "../../../../shared/api/http/PlatformApiError";
import { InlineNotice } from "../../../../shared/ui";
import type { LiveDraftAdvisory } from "../../api/liveDraftAdvisorySchemas";
import type { LiveDraftBoardPlayer, LiveDraftExport, LiveDraftRoom } from "../../api/liveDraftSchemas";
import type { LiveDraftConnection } from "../../hooks/useLiveDraftUpdates";
import { saleCommandFor, selectedTeamId } from "../../lib/liveDraftDisplay";
import { liveDraftErrorMessage } from "../../lib/liveDraftError";
import type { LiveDraftAction } from "../../lib/liveDraftMutation";
import { DraftCommandPanel } from "../../components/DraftCommandPanel/DraftCommandPanel";
import { DraftStatus } from "../../components/DraftStatus/DraftStatus";
import { FinalActions } from "../../components/FinalActions/FinalActions";
import { PickBoard } from "../../components/PickBoard/PickBoard";
import { PlayerBoard } from "../../components/PlayerBoard/PlayerBoard";
import { SaleLedger } from "../../components/SaleLedger/SaleLedger";
import { TeamRoster } from "../../components/TeamRoster/TeamRoster";

export interface WorkspaceProps {
  readonly advisory?: LiveDraftAdvisory | undefined;
  readonly busy: boolean;
  readonly connection: LiveDraftConnection;
  readonly createExport: () => Promise<LiveDraftExport>;
  readonly onAction: (action: LiveDraftAction) => Promise<LiveDraftRoom>;
  readonly onRefresh: () => Promise<void>;
  readonly room: LiveDraftRoom;
}

interface Feedback { readonly message: string; readonly variant: "info" | "success" | "error" }
interface Download { readonly fileName: string; readonly href: string }

export const LiveDraftWorkspace = ({
  advisory,
  busy,
  connection,
  createExport,
  onAction,
  onRefresh,
  room,
}: WorkspaceProps) => {
  const [command, setCommand] = useState("");
  const [download, setDownload] = useState<Download>();
  const [feedback, setFeedback] = useState<Feedback>();
  const [viewedTeamId, setViewedTeamId] = useState(() => selectedTeamId(room));
  const latestSale = room.salesLog.at(-1);
  const snake = room.picks !== undefined;
  const transactionNoun = snake ? "pick" : "sale";
  const undoMessage = latestSale === undefined
    ? `Undo the latest ${transactionNoun}?`
    : `Undo the latest ${transactionNoun} of ${latestSale.playerName}?`;
  const perform = async (action: LiveDraftAction, pendingMessage: string) => {
    setFeedback({ message: pendingMessage, variant: "info" });
    try {
      const updatedRoom = await onAction(action);
      setFeedback({ message: "Draft room updated.", variant: "success" });
      return updatedRoom;
    } catch (error) {
      if (error instanceof PlatformApiError && error.code === "stale_revision") {
        await onRefresh();
        setFeedback({
          message: "The room changed first. Review the latest state and try again.",
          variant: "error",
        });
      } else setFeedback({ message: liveDraftErrorMessage(error), variant: "error" });
      throw error;
    }
  };
  const run = (action: LiveDraftAction, pendingMessage: string) => {
    void perform(action, pendingMessage).catch(() => undefined);
  };
  const logSale = () => {
    void perform(
      { action: "sales", command: command.trim() },
      snake ? "Recording pick..." : "Logging sale...",
    )
      .then(() => { setCommand(""); }).catch(() => undefined);
  };
  const endDraft = () => {
    if (!window.confirm("End and lock the completed draft now?")) return;
    void perform({ action: "end" }, "Checking draft rosters...").catch((error: unknown) => {
      if (!(error instanceof PlatformApiError) || error.code !== "draft_incomplete") return;
      const confirmed = window.confirm(
        `${error.message}\n\nEnd this incomplete draft anyway? You can reopen it later.`,
      );
      if (confirmed) run({ action: "end", allowIncomplete: true }, "Ending incomplete draft...");
      else setFeedback({ message: "Draft remains open.", variant: "info" });
    });
  };
  const usePlayer = (player: LiveDraftBoardPlayer) => {
    setCommand(saleCommandFor(room, viewedTeamId, player.name));
  };
  const exportDraft = () => {
    void createExport().then(result => {
      setDownload({
        fileName: result.artifact.storageKey.split("/")
          .filter(segment => segment.length > 0).at(-1) ?? "mockd-draft.csv",
        href: `data:${encodeURIComponent(result.artifact.contentType)},${encodeURIComponent(result.content)}`,
      });
      setFeedback({ message: "Final CSV is ready to download.", variant: "success" });
    }).catch((error: unknown) => {
      setFeedback({ message: liveDraftErrorMessage(error), variant: "error" });
    });
  };

  return <>
    {room.status === "ended" ? <FinalActions
      busy={busy} {...(download === undefined ? {} : { download })} onExport={exportDraft}
      onReopen={() => {
        if (window.confirm("Reopen this draft in a paused state?")) {
          run({ action: "reopen" }, "Reopening draft...");
        }
      }} room={room}
    /> : <DraftCommandPanel
      busy={busy} command={command} {...(feedback === undefined ? {} : { feedback })}
      onCommandChange={setCommand} onEnd={endDraft} onLogSale={logSale}
      onPauseOrResume={() => { run({ action: room.status === "paused" ? "resume" : "pause" },
        room.status === "paused" ? "Resuming draft..." : "Pausing draft..."); }}
      onStart={() => { run({ action: "start" }, "Starting draft..."); }}
      onUndo={() => {
        if (window.confirm(undoMessage)) {
          run({ action: "undo" }, `Undoing latest ${transactionNoun}...`);
        }
      }} room={room}
    />}
    {room.status === "ended" && feedback !== undefined &&
      <InlineNotice variant={feedback.variant}>{feedback.message}</InlineNotice>}
    <DraftStatus connection={connection} room={room} />
    {room.picks !== undefined
      && <PickBoard onTheClock={room.onTheClock} picks={room.picks} viewedTeamId={viewedTeamId} />}
    <div className="live-draft__grid">
      <PlayerBoard {...(advisory === undefined ? {} : { advisory })}
        canManage={room.canMutateRoom || room.canLogPick}
        commandNoun={snake ? "pick" : "sale"} onUsePlayer={usePlayer}
        players={room.board} roomIsLive={room.status === "live"} />
      <TeamRoster onTeamChange={setViewedTeamId}
        {...(viewedTeamId === undefined ? {} : { selectedTeamId: viewedTeamId })}
        teams={room.teamSummaries} />
      <SaleLedger canCorrect={room.canMutateRoom && room.status === "live" && !busy}
        draftMode={snake ? "snake" : "auction"}
        onCorrect={(saleEventId, replacementSale) => {
          if (!window.confirm("Apply this correction to the selected sale?")) return false;
          run({
          action: "corrections", replacementSale, saleEventId,
          }, "Applying correction...");
          return true;
        }} sales={room.salesLog} />
    </div>
  </>;
};
