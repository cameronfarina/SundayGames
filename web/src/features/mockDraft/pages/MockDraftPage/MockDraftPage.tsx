import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { InlineNotice, ProgressButton, Skeleton } from "../../../../shared/ui/index.js";
import { isSnakeMockResponse } from "../../api/mockDraftSchemas.js";
import { MockDraftActions } from "../../components/MockDraftActions/MockDraftActions.js";
import { useMockDraft } from "../../hooks/useMockDraft.js";
import type { MockCommandIntent } from "../../model/mockCommand.js";
import { AuctionMockWorkspace } from "./AuctionMockWorkspace.js";
import { SnakeMockWorkspace } from "./SnakeMockWorkspace.js";
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
  const mock = useMockDraft({
    ...(fetcher === undefined ? {} : { fetcher }),
    ...(initialSessionId === undefined ? {} : { initialSessionId }),
    ...(onSessionChange === undefined ? {} : { onSessionChange }),
    seasonId,
    strategy,
  });
  const dispatch = (intent: MockCommandIntent) => {
    mock.command(intent).catch(() => undefined);
  };

  if (mock.loading) {
    return <section aria-label="Mock draft"><Skeleton height="24rem" /></section>;
  }

  if (mock.response === undefined) {
    return (
      <section aria-labelledby="mock-draft-heading" className="mock-draft-page mock-draft-page--launch">
        <span className="mock-draft-page__eyebrow">Practice</span>
        <h1 id="mock-draft-heading">Mock draft</h1>
        <p>Draft for your claimed team while we run the rest of your league.</p>
        {mock.abandoned && <InlineNotice title="Mock abandoned" variant="success">The session no longer counts toward your active mock limit.</InlineNotice>}
        {mock.error !== null && <InlineNotice variant="error">{errorMessage(mock.error)}</InlineNotice>}
        <ProgressButton
          busy={mock.busy}
          onClick={() => { mock.create().catch(() => undefined); }}
          percent={mock.busy ? 35 : 0}
        >
          Create mock draft
        </ProgressButton>
      </section>
    );
  }

  const { response } = mock;
  const snake = isSnakeMockResponse(response);

  return (
    <section aria-labelledby="mock-draft-heading" className="mock-draft-page">
      <header className="mock-draft-page__header">
        <div>
          <span className="mock-draft-page__eyebrow">Mock draft</span>
          <h1 id="mock-draft-heading">{snake ? "Snake mock draft" : "Auction mock draft"}</h1>
          <p>Draft for your claimed team while we run the rest of your league.</p>
        </div>
        <MockDraftActions
          busy={mock.busy}
          onAbandon={mock.abandon}
          onComplete={() => { dispatch({ type: "complete" }); }}
          onStart={() => { dispatch({ type: "start" }); }}
          onUndo={() => { dispatch({ type: "undo" }); }}
          state={response.state}
        />
      </header>
      {mock.error !== null && <InlineNotice variant="error">{errorMessage(mock.error)}</InlineNotice>}
      {isSnakeMockResponse(response)
        ? <SnakeMockWorkspace dispatch={dispatch} response={response} />
        : <AuctionMockWorkspace busy={mock.busy} dispatch={dispatch} response={response} />}
    </section>
  );
};
