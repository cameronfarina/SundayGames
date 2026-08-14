import type { WizardStep } from "../../model/createLeagueTypes";
import "./WizardProgress.css";

interface WizardProgressProps {
  readonly current: WizardStep;
}

const labels: readonly { readonly id: WizardStep; readonly label: string }[] = [
  { id: "basics", label: "Basics" },
  { id: "reference", label: "Reference" },
  { id: "scoring", label: "Scoring" },
  { id: "roster", label: "Roster" },
  { id: "teams", label: "Teams" },
];

export const WizardProgress = ({ current }: WizardProgressProps) => (
  <ol aria-label="League setup progress" className="wizard-progress">
    {labels.map(item => (
      <li aria-current={item.id === current ? "step" : undefined} key={item.id}>
        {item.label}
      </li>
    ))}
  </ol>
);
