import { TextField } from "../../../../shared/ui/TextField/TextField";
import type { LeagueDraftAction } from "../../model/createLeagueDraft";
import type { LeagueTeamDraft } from "../../model/createLeagueTypes";

interface TeamFieldsProps {
  readonly dispatch: (action: LeagueDraftAction) => void;
  readonly index: number;
  readonly showError: boolean;
  readonly team: LeagueTeamDraft;
}

export const TeamFields = ({ dispatch, index, showError, team }: TeamFieldsProps) => (
  <fieldset className="team-fields">
    <legend>Team {String(index + 1)}</legend>
    <TextField
      {...(showError && team.displayName.trim().length === 0 ? { error: "Enter a team name." } : {})}
      id={`team-${String(index + 1)}-name`}
      label="Team name"
      required
      onChange={event => {
        dispatch({ type: "set-team-field", index, field: "displayName", value: event.currentTarget.value });
      }}
      value={team.displayName}
    />
    <TextField
      hint="Optional. Separate multiple managers with commas."
      id={`team-${String(index + 1)}-managers`}
      label="Managers"
      onChange={event => {
        dispatch({ type: "set-team-field", index, field: "managerNames", value: event.currentTarget.value });
      }}
      value={team.managerNames}
    />
    <TextField
      id={`team-${String(index + 1)}-abbreviation`}
      label="Abbreviation"
      maxLength={8}
      onChange={event => {
        dispatch({ type: "set-team-field", index, field: "abbreviation", value: event.currentTarget.value });
      }}
      value={team.abbreviation}
    />
  </fieldset>
);
