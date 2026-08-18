import { InlineNotice } from "../../../../shared/ui/index.js";
import type { AuctionMockResponse } from "../../api/mockDraftSchemas.js";
import { AuctionStage } from "../../components/AuctionStage/AuctionStage.js";
import { MockSummary } from "../../components/MockSummary/MockSummary.js";
import { PlayerBoard } from "../../components/PlayerBoard/PlayerBoard.js";
import { ResultsGrid } from "../../components/ResultsGrid/ResultsGrid.js";
import { RosterInspector } from "../../components/RosterInspector/RosterInspector.js";
import type { MockCommandIntent } from "../../model/mockCommand.js";

interface AuctionMockWorkspaceProps {
  readonly busy: boolean;
  readonly dispatch: (intent: MockCommandIntent) => void;
  readonly response: AuctionMockResponse;
}

export const AuctionMockWorkspace = ({
  busy,
  dispatch,
  response,
}: AuctionMockWorkspaceProps) => {
  const { state } = response;
  const humanTeam = state.teams.find(team => team.id === state.session.humanTeamId);
  const nomination = state.session.currentNomination;
  const completed = state.session.status === "completed";

  return (
    <>
      <MockSummary state={state} />
      {!completed && (
        <AuctionStage
          busy={busy}
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
    </>
  );
};
