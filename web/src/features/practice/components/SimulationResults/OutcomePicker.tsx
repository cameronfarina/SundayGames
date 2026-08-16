import { Star } from "lucide-react";
import type { PracticeSimulationSummary } from "../../api/simulationSchema";
import { PracticeSelect } from "../PracticeSelect/PracticeSelect";
import "./OutcomePicker.css";

type Outcome = PracticeSimulationSummary["outcomes"][number];

interface OutcomePickerProps {
  readonly onFavoriteChange: (favorite: boolean) => void;
  readonly onRunChange: (runNumber: number) => void;
  readonly pendingFavorite: boolean;
  readonly selectedRunNumber: number;
  readonly summary: PracticeSimulationSummary;
}

const labelFor = (outcome: Outcome): string =>
  `#${String(outcome.rank)} Run ${String(outcome.runNumber)} · ${outcome.userWeek1Points.toFixed(1)} pts${outcome.favorite ? " · Saved" : ""}`;

export function OutcomePicker(props: OutcomePickerProps) {
  const selected = props.summary.outcomes.find(
    outcome => outcome.runNumber === props.selectedRunNumber,
  );
  const options = props.summary.outcomes.length > 0
    ? props.summary.outcomes.map(outcome => ({
      label: labelFor(outcome),
      value: String(outcome.runNumber),
    }))
    : Array.from({ length: props.summary.runCount }, (_, index) => ({
      label: `Run ${String(index + 1)}`,
      value: String(index + 1),
    }));
  const saveLabel = selected?.favorite === true
    ? `Remove Run ${String(props.selectedRunNumber)} from My Team`
    : `Save Run ${String(props.selectedRunNumber)} to My Team`;

  return <div className="simulation-results__outcome-picker">
    <PracticeSelect
      label="Simulation outcome"
      onValueChange={value => { props.onRunChange(Number(value)); }}
      options={options}
      value={String(props.selectedRunNumber)}
    />
    {selected !== undefined && <button
      aria-label={saveLabel}
      className="simulation-results__favorite"
      disabled={props.pendingFavorite}
      onClick={() => { props.onFavoriteChange(!selected.favorite); }}
      title={saveLabel}
      type="button"
    >
      <Star aria-hidden="true" fill={selected.favorite ? "currentColor" : "none"} size={20} />
    </button>}
  </div>;
}
