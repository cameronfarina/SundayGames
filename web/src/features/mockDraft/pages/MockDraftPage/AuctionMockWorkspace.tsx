import { InlineNotice } from "../../../../shared/ui/index.js";
import type { AuctionMockResponse } from "../../api/mockDraftSchemas.js";
import { AuctionStage } from "../../components/AuctionStage/AuctionStage.js";
import { ManagerDraftProfile } from "../../components/ManagerDraftProfile/ManagerDraftProfile.js";
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

const findProfileContext = (response: AuctionMockResponse) => {
  const { managerProfiles, state } = response;
  const nomination = state.session.currentNomination;
  if (nomination === undefined) return undefined;

  const teamId = nomination.highestBidderTeamId === state.session.humanTeamId
    ? nomination.nominatedByTeamId
    : nomination.highestBidderTeamId;
  if (teamId === state.session.humanTeamId) return undefined;

  const profile = managerProfiles.find(candidate => candidate.teamId === teamId);
  if (profile === undefined) return undefined;

  const teamName = state.teams.find(team => team.id === teamId)?.name
    ?? (teamId === nomination.nominatedByTeamId
      ? nomination.nominatedByTeamName
      : nomination.highestBidderTeamName);
  return { profile, teamName };
};

export const AuctionMockWorkspace = ({
  busy,
  dispatch,
  response,
}: AuctionMockWorkspaceProps) => {
  const { state } = response;
  const humanTeam = state.teams.find(team => team.id === state.session.humanTeamId);
  const nomination = state.session.currentNomination;
  const completed = state.session.status === "completed";
  const profileContext = findProfileContext(response);

  return (
    <>
      <MockSummary state={state} />
      {!completed && (
        <div className={profileContext === undefined
          ? undefined
          : "mock-draft-page__stage-with-profile"}>
          <AuctionStage
            busy={busy}
            events={state.auctionEvents}
            humanMaxBid={humanTeam?.maxBid ?? 0}
            {...(nomination === undefined ? {} : { nomination })}
            onBuy={price => { dispatch({ type: "buy", price }); }}
            onPass={() => { dispatch({ type: "pass" }); }}
          />
          {profileContext !== undefined && <ManagerDraftProfile
            players={state.board.players}
            profile={profileContext.profile}
            teamName={profileContext.teamName}
          />}
        </div>
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
