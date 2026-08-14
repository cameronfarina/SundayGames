import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { InlineNotice, ProgressButton, Skeleton } from "../../../../shared/ui/index.js";
import { AuctionStage } from "../../components/AuctionStage/AuctionStage.js";
import { MockDraftActions } from "../../components/MockDraftActions/MockDraftActions.js";
import { MockSummary } from "../../components/MockSummary/MockSummary.js";
import { PlayerBoard } from "../../components/PlayerBoard/PlayerBoard.js";
import { ResultsGrid } from "../../components/ResultsGrid/ResultsGrid.js";
import { RosterInspector } from "../../components/RosterInspector/RosterInspector.js";
import { useAuctionMockDraft } from "../../hooks/useAuctionMockDraft.js";
import type { AuctionCommandIntent } from "../../model/auctionCommand.js";
import "./MockDraftPage.css";

export interface MockDraftPageProps {
  readonly fetcher?: PlatformFetch;
  readonly initialSessionId?: string;
  readonly onSessionChange?: (sessionId: string | undefined) => void;
  readonly seasonId: string;
  readonly strategy?: string;
}

const errorMessage = (error: unknown): string => error instanceof Error
  ? error.message
  : "The mock draft could not be updated.";

export const MockDraftPage = ({
  fetcher,
  initialSessionId,
  onSessionChange,
  seasonId,
  strategy = "balanced",
}: MockDraftPageProps) => {
  const mock = useAuctionMockDraft({
    ...(fetcher === undefined ? {} : { fetcher }),
    ...(initialSessionId === undefined ? {} : { initialSessionId }),
    ...(onSessionChange === undefined ? {} : { onSessionChange }),
    seasonId,
    strategy,
  });
  const dispatch = (intent: AuctionCommandIntent) => {
    mock.command(intent).catch(() => undefined);
  };

  if (mock.loading) {
    return <section aria-label="Auction mock draft"><Skeleton height="24rem" /></section>;
  }

  if (mock.response === undefined) {
    return (
      <section aria-labelledby="mock-draft-heading" className="mock-draft-page mock-draft-page--launch">
        <span className="mock-draft-page__eyebrow">Practice</span>
        <h1 id="mock-draft-heading">Auction mock draft</h1>
        <p>Draft for your claimed team while Mockd runs the rest of your league.</p>
        {mock.abandoned && <InlineNotice title="Mock abandoned" variant="success">The session no longer counts toward your active mock limit.</InlineNotice>}
        {mock.error !== null && <InlineNotice variant="error">{errorMessage(mock.error)}</InlineNotice>}
        <ProgressButton
          busy={mock.busy}
          onClick={() => { mock.create().catch(() => undefined); }}
          percent={mock.busy ? 35 : 0}
        >
          Create auction mock
        </ProgressButton>
      </section>
    );
  }

  const { response } = mock;
  const { state } = response;
  const humanTeam = state.teams.find(team => team.id === state.session.humanTeamId);
  const nomination = state.session.currentNomination;
  const completed = state.session.status === "completed";

  return (
    <section aria-labelledby="mock-draft-heading" className="mock-draft-page">
      <header className="mock-draft-page__header">
        <div>
          <span className="mock-draft-page__eyebrow">Mock draft</span>
          <h1 id="mock-draft-heading">Auction mock draft</h1>
          <p>Draft for your claimed team while Mockd runs the rest of your league.</p>
        </div>
        <MockDraftActions
          busy={mock.busy}
          onAbandon={mock.abandon}
          onComplete={() => { dispatch({ type: "complete" }); }}
          onStart={() => { dispatch({ type: "start" }); }}
          onUndo={() => { dispatch({ type: "undo" }); }}
          state={state}
        />
      </header>
      {mock.error !== null && <InlineNotice variant="error">{errorMessage(mock.error)}</InlineNotice>}
      <MockSummary state={state} />
      {!completed && (
        <AuctionStage
          busy={mock.busy}
          events={state.auctionEvents}
          humanMaxBid={humanTeam?.maxBid ?? 0}
          {...(nomination === undefined ? {} : { nomination })}
          onBuy={price => { dispatch({ type: "buy", price }); }}
          onPass={() => { dispatch({ type: "pass" }); }}
        />
      )}
      {!completed && (
        <div className="mock-draft-page__workspace">
          <PlayerBoard
            canNominate={state.session.status === "active" && state.session.phase === "awaiting_human_nomination"}
            humanTeam={humanTeam}
            onNominate={playerId => { dispatch({ type: "nominate", playerId }); }}
            players={state.board.players}
          />
          <RosterInspector humanTeamId={state.session.humanTeamId} teams={state.teams} />
        </div>
      )}
      {completed && response.results !== undefined && <ResultsGrid results={response.results} />}
      {completed && response.results === undefined && (
        <InlineNotice variant="warning">Completed results are unavailable for this mock.</InlineNotice>
      )}
    </section>
  );
};
