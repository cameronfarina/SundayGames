import type { SyntheticEvent } from "react";
import { NumberField } from "../../../../shared/ui/NumberField/NumberField";
import type { LeagueDraftAction } from "../../model/createLeagueDraft";
import type { LeagueDraft, ScoringField } from "../../model/createLeagueTypes";

interface ScoringStepProps {
  readonly dispatch: (action: LeagueDraftAction) => void;
  readonly draft: LeagueDraft;
  readonly errors: Readonly<Record<string, string>>;
  readonly formId: string;
  readonly onSubmit: () => void;
}

const fields: readonly { readonly field: ScoringField; readonly label: string }[] = [
  { field: "passingYards", label: "Points per passing yard" },
  { field: "passingTouchdown", label: "Points per passing touchdown" },
  { field: "rushingYards", label: "Points per rushing yard" },
  { field: "rushingTouchdown", label: "Points per rushing touchdown" },
  { field: "receivingYards", label: "Points per receiving yard" },
  { field: "receivingTouchdown", label: "Points per receiving touchdown" },
  { field: "reception", label: "Points per reception" },
];

export const ScoringStep = ({ dispatch, draft, errors, formId, onSubmit }: ScoringStepProps) => {
  const submit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form className="create-league-step" id={formId} onSubmit={submit}>
      <h2>Scoring rules</h2>
      <p>Confirm the point values we should use for projections and draft models.</p>
      <div className="create-league-grid create-league-grid--three">
        {fields.map(item => (
          <NumberField
            aria-label={item.label}
            {...(errors[item.field] === undefined ? {} : { error: errors[item.field] })}
            id={`scoring-${item.field}`}
            key={item.field}
            label={item.label}
            onChange={event => {
              dispatch({
                type: "set-scoring", field: item.field, value: event.currentTarget.valueAsNumber,
              });
            }}
            step="any"
            value={Number.isFinite(draft.scoring[item.field]) ? draft.scoring[item.field] : ""}
          />
        ))}
      </div>
    </form>
  );
};
