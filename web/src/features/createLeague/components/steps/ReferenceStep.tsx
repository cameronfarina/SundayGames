import type { SyntheticEvent } from "react";
import { Button } from "../../../../shared/ui/Button/Button";
import { InlineNotice } from "../../../../shared/ui/InlineNotice/InlineNotice";
import { TextField } from "../../../../shared/ui/TextField/TextField";
import type { EspnReviewOutcome } from "../../api/createLeagueSchemas";
import type { LeagueDraftAction } from "../../model/createLeagueDraft";
import type { LeagueDraft, EspnSettingsReview } from "../../model/createLeagueTypes";
import { ImportReview } from "../ImportReview/ImportReview";

interface ReferenceStepProps {
  readonly dispatch: (action: LeagueDraftAction) => void;
  readonly error: Error | null;
  readonly formId: string;
  readonly draft: LeagueDraft;
  readonly isPending: boolean;
  readonly onReview: () => void;
  readonly onSourceChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly outcome: EspnReviewOutcome | undefined;
}

export const ReferenceStep = (props: ReferenceStepProps) => {
  const submit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    props.onSubmit();
  };
  const apply = (review: EspnSettingsReview) => {
    props.dispatch({ type: "accept-import", review });
  };
  return (
    <form className="create-league-step" id={props.formId} onSubmit={submit}>
      <h2>Reference league</h2>
      <p>
        Mockd can automatically read league name, team count, draft format, scoring, roster
        slots, and team names from a public ESPN league. It cannot read private leagues or
        settings ESPN does not expose. Review every imported value before applying it, or enter
        the setup manually.
      </p>
      <div className="create-league-reference">
        <TextField
          hint="Optional. Private ESPN leagues usually require manual entry."
          id="espn-league-source"
          label="ESPN league ID or URL"
          onChange={event => { props.onSourceChange(event.currentTarget.value); }}
          value={props.draft.referenceSource}
        />
        <Button
          aria-busy={props.isPending}
          disabled={props.isPending || props.draft.referenceSource.trim().length === 0}
          onClick={props.onReview}
        >
          {props.isPending ? "Reviewing ESPN" : "Review ESPN settings"}
        </Button>
        <span>or</span>
        <Button onClick={() => { props.dispatch({ type: "choose-manual" }); }} variant="secondary">
          Enter settings manually
        </Button>
      </div>
      {props.error !== null && <InlineNotice variant="error">{props.error.message}</InlineNotice>}
      {props.outcome?.kind === "manual-review-required" && (
        <InlineNotice variant="warning">{props.outcome.message}</InlineNotice>
      )}
      {props.outcome?.kind === "review" && (
        <ImportReview
          applied={props.draft.referenceMode === "imported"}
          onApply={apply}
          outcome={props.outcome}
        />
      )}
      {props.draft.referenceMode === "manual" && (
        <InlineNotice variant="success">Manual setup selected. Continue to scoring.</InlineNotice>
      )}
    </form>
  );
};
