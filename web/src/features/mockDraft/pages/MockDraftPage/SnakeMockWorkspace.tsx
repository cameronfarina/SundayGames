import { InlineNotice } from "../../../../shared/ui/index.js";
import type { SnakeMockResponse } from "../../api/mockDraftSchemas.js";
import { ResultsGrid } from "../../components/ResultsGrid/ResultsGrid.js";
import { SnakeBoard } from "../../components/SnakeBoard/SnakeBoard.js";
import { SnakePlayerBoard } from "../../components/SnakePlayerBoard/SnakePlayerBoard.js";
import { SnakeRosterInspector } from "../../components/SnakeRosterInspector/SnakeRosterInspector.js";
import { SnakeSummary } from "../../components/SnakeSummary/SnakeSummary.js";
import type { MockCommandIntent } from "../../model/mockCommand.js";

interface SnakeMockWorkspaceProps {
  readonly dispatch: (intent: MockCommandIntent) => void;
  readonly response: SnakeMockResponse;
}

export const SnakeMockWorkspace = ({ dispatch, response }: SnakeMockWorkspaceProps) => {
  const { state } = response;
  const { session } = state;
  const humanTeam = state.teams.find(team => team.id === session.humanTeamId);
  const completed = session.status === "completed";
  const humanIsOnTheClock = session.status === "active"
    && session.currentPick?.teamId === session.humanTeamId;

  return (
    <>
      <SnakeSummary state={state} />
      {!completed && (
        <>
          <SnakeBoard
            currentOverall={session.currentPick?.overall}
            humanTeamId={session.humanTeamId}
            picks={state.board.picks}
            players={state.board.players}
          />
          <div className="mock-draft-page__workspace">
            <SnakePlayerBoard
              canPick={humanIsOnTheClock}
              humanTeam={humanTeam}
              onPick={playerId => { dispatch({ type: "pick", playerId }); }}
              players={state.board.players}
            />
            <SnakeRosterInspector
              humanTeamId={session.humanTeamId}
              players={state.board.players}
              teams={state.teams}
            />
          </div>
        </>
      )}
      {completed && response.results !== undefined && <ResultsGrid results={response.results} />}
      {completed && response.results === undefined && (
        <InlineNotice variant="warning">Completed results are unavailable for this mock.</InlineNotice>
      )}
    </>
  );
};
