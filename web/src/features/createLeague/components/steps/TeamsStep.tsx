import type { SyntheticEvent } from "react";
import type { LeagueDraftAction } from "../../model/createLeagueDraft";
import type { LeagueDraft } from "../../model/createLeagueTypes";
import { TeamFields } from "./TeamFields";

interface TeamsStepProps {
  readonly dispatch: (action: LeagueDraftAction) => void;
  readonly draft: LeagueDraft;
  readonly formId: string;
  readonly onSubmit: () => void;
  readonly showErrors: boolean;
}

export const TeamsStep = ({ dispatch, draft, formId, onSubmit, showErrors }: TeamsStepProps) => {
  const entered = draft.teams.filter(team => team.displayName.trim().length > 0).length;
  const submit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form aria-label="League team setup" className="create-league-step" id={formId} onSubmit={submit}>
      <h2>League teams</h2>
      <p>Team names are required. Manager names and abbreviations are optional.</p>
      <p aria-live="polite">{String(entered)} of {String(draft.teamCount)} team names entered</p>
      <div className="create-league-teams">
        {draft.teams.map((team, index) => (
          <TeamFields
            dispatch={dispatch}
            index={index}
            key={team.externalTeamId}
            showError={showErrors}
            team={team}
          />
        ))}
      </div>
    </form>
  );
};
