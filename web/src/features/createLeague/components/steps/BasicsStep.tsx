import type { SyntheticEvent } from "react";
import { z } from "zod";
import { NumberField } from "../../../../shared/ui/NumberField/NumberField";
import { Select } from "../../../../shared/ui/Select/Select";
import { TextField } from "../../../../shared/ui/TextField/TextField";
import type { LeagueDraftAction } from "../../model/createLeagueDraft";
import type { LeagueDraft } from "../../model/createLeagueTypes";

interface BasicsStepProps {
  readonly dispatch: (action: LeagueDraftAction) => void;
  readonly draft: LeagueDraft;
  readonly errors: Readonly<Record<string, string>>;
  readonly formId: string;
  readonly onSubmit: () => void;
}

const draftTypeSchema = z.enum(["auction", "snake"]);

export const BasicsStep = ({ dispatch, draft, errors, formId, onSubmit }: BasicsStepProps) => {
  const submit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form className="create-league-step" id={formId} onSubmit={submit}>
      <h2>League basics</h2>
      <p>Name the league and choose the draft format you actually use.</p>
      <div className="create-league-grid create-league-grid--three">
        <TextField
          {...(errors["leagueName"] === undefined ? {} : { error: errors["leagueName"] })}
          id="league-name"
          label="League name"
          onChange={event => { dispatch({ type: "set-league-name", value: event.currentTarget.value }); }}
          value={draft.leagueName}
        />
        <NumberField
          {...(errors["seasonYear"] === undefined ? {} : { error: errors["seasonYear"] })}
          id="league-season"
          label="Season"
          min={2020}
          onChange={event => { dispatch({ type: "set-season", value: event.currentTarget.valueAsNumber }); }}
          value={Number.isFinite(draft.seasonYear) ? draft.seasonYear : ""}
        />
        <NumberField
          {...(errors["teamCount"] === undefined ? {} : { error: errors["teamCount"] })}
          id="league-team-count"
          label="Number of teams"
          max={20}
          min={2}
          onChange={event => { dispatch({ type: "set-team-count", value: event.currentTarget.valueAsNumber }); }}
          value={Number.isFinite(draft.teamCount) ? draft.teamCount : ""}
        />
      </div>
      <div className="create-league-grid create-league-grid--two">
        <Select
          id="draft-type"
          label="Draft format"
          onValueChange={value => {
            dispatch({ type: "set-draft-type", value: draftTypeSchema.parse(value) });
          }}
          options={[{ label: "Auction", value: "auction" }, { label: "Snake", value: "snake" }]}
          value={draft.draftType}
        />
        <Select
          id="keeper-league"
          label="Keeper league"
          onValueChange={value => {
            dispatch({ type: "set-keeper-league", value: value === "yes" });
          }}
          options={[{ label: "No", value: "no" }, { label: "Yes", value: "yes" }]}
          value={draft.keeperLeague ? "yes" : "no"}
        />
      </div>
      {draft.draftType === "snake" && (
        <NumberField
          {...(errors["snakeRounds"] === undefined ? {} : { error: errors["snakeRounds"] })}
          id="snake-rounds"
          label="Draft rounds"
          min={1}
          onChange={event => { dispatch({ type: "set-snake-rounds", value: event.currentTarget.valueAsNumber }); }}
          value={Number.isFinite(draft.snakeRounds) ? draft.snakeRounds : ""}
        />
      )}
      {draft.draftType === "auction" && (
        <div className="create-league-grid create-league-grid--two">
          <NumberField
            {...(errors["auctionBudget"] === undefined ? {} : { error: errors["auctionBudget"] })}
            id="auction-budget"
            label="Auction budget"
            min={1}
            onChange={event => { dispatch({ type: "set-auction-budget", value: event.currentTarget.valueAsNumber }); }}
            value={Number.isFinite(draft.auctionBudget) ? draft.auctionBudget : ""}
          />
          <NumberField
            {...(errors["minimumBid"] === undefined ? {} : { error: errors["minimumBid"] })}
            id="minimum-bid"
            label="Minimum bid"
            min={1}
            onChange={event => { dispatch({ type: "set-minimum-bid", value: event.currentTarget.valueAsNumber }); }}
            value={Number.isFinite(draft.minimumBid) ? draft.minimumBid : ""}
          />
        </div>
      )}
    </form>
  );
};
