import { useId, useState } from "react";
import type { LeagueDraftOverride } from "../../api/leagueConnectionsApi";
import type { LeagueDraftSetup } from "../../api/leagueConnectionsSchema";
import { Button, NumberField, Select } from "../../../../shared/ui";

interface DraftSetupFormProps {
  readonly defaults: LeagueDraftSetup;
  readonly disabled: boolean;
  readonly onSubmit: (draft: LeagueDraftOverride) => void;
}

export const DraftSetupForm = ({ defaults, disabled, onSubmit }: DraftSetupFormProps) => {
  const id = useId();
  const [format, setFormat] = useState<"auction" | "snake" | undefined>();
  const [budget, setBudget] = useState(defaults.auctionBudgetDollars);
  const [minimumBid, setMinimumBid] = useState(defaults.minimumBidDollars);
  const [rounds, setRounds] = useState(defaults.snakeRounds);
  const submit = () => {
    if (format === "auction") {
      onSubmit({ type: "auction", budgetDollars: budget, minimumBidDollars: minimumBid });
      return;
    }
    onSubmit({ type: "snake", rounds });
  };

  return <div className="add-connection__draft-setup">
    <Select
      disabled={disabled}
      id={`${id}-draft-format`}
      label="Draft format"
      onValueChange={value => { setFormat(value === "auction" ? "auction" : "snake"); }}
      options={[{ label: "Auction", value: "auction" }, { label: "Snake", value: "snake" }]}
      placeholder="Choose Auction or Snake"
      {...(format === undefined ? {} : { value: format })}
    />
    {format === "auction" ? <>
      <NumberField
        id={`${id}-auction-budget`}
        label="Auction budget"
        min={1}
        onChange={event => { setBudget(event.currentTarget.valueAsNumber); }}
        value={budget}
      />
      <NumberField
        id={`${id}-minimum-bid`}
        label="Minimum bid"
        min={1}
        onChange={event => { setMinimumBid(event.currentTarget.valueAsNumber); }}
        value={minimumBid}
      />
    </> : null}
    {format === "snake" ? <NumberField
      id={`${id}-snake-rounds`}
      label="Rounds"
      min={1}
      onChange={event => { setRounds(event.currentTarget.valueAsNumber); }}
      value={rounds}
    /> : null}
    <Button disabled={disabled || format === undefined} onClick={submit}>Finish import</Button>
  </div>;
};
