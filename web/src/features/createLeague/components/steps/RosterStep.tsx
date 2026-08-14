import type { SyntheticEvent } from "react";
import { NumberField } from "../../../../shared/ui/NumberField/NumberField";
import type { LeagueDraftAction } from "../../model/createLeagueDraft";
import type { LeagueDraft, RosterSlot } from "../../model/createLeagueTypes";
import { rosterSlotOrder } from "../../model/createLeagueValidation";

interface RosterStepProps {
  readonly dispatch: (action: LeagueDraftAction) => void;
  readonly draft: LeagueDraft;
  readonly errors: Readonly<Record<string, string>>;
  readonly formId: string;
  readonly onSubmit: () => void;
}

const labelFor = (slot: RosterSlot): string => slot === "BENCH" ? "Bench" : slot;

export const RosterStep = ({ dispatch, draft, errors, formId, onSubmit }: RosterStepProps) => {
  const submit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form className="create-league-step" id={formId} onSubmit={submit}>
      <h2>Roster slots</h2>
      <p>Set the number of players each team drafts at every slot.</p>
      {errors["roster"] !== undefined && <p role="alert">{errors["roster"]}</p>}
      <div className="create-league-grid create-league-grid--four">
        {rosterSlotOrder.map(slot => (
          <NumberField
            aria-label={labelFor(slot)}
            {...(errors[slot] === undefined ? {} : { error: errors[slot] })}
            id={`roster-${slot.toLowerCase()}`}
            key={slot}
            label={labelFor(slot)}
            min={0}
            onChange={event => {
              dispatch({ type: "set-roster", slot, value: event.currentTarget.valueAsNumber });
            }}
            step={1}
            value={Number.isFinite(draft.roster[slot]) ? draft.roster[slot] : ""}
          />
        ))}
      </div>
    </form>
  );
};
