import type { WizardStep } from "../../model/createLeagueTypes";
import "./WizardProgress.css";

interface WizardProgressProps {
  readonly current: WizardStep;
  readonly onNavigate: (step: WizardStep) => void;
  readonly visited: readonly WizardStep[];
}

const labels: readonly { readonly id: WizardStep; readonly label: string }[] = [
  { id: "basics", label: "Basics" },
  { id: "reference", label: "Reference" },
  { id: "scoring", label: "Scoring" },
  { id: "roster", label: "Roster" },
  { id: "teams", label: "Teams" },
];

export const WizardProgress = ({ current, onNavigate, visited }: WizardProgressProps) => (
  <ol aria-label="League setup progress" className="wizard-progress">
    {labels.map(item => (
      <li aria-current={item.id === current ? "step" : undefined} key={item.id}>
        {visited.includes(item.id) && item.id !== current ? (
          <button
            className="wizard-progress__step"
            onClick={() => { onNavigate(item.id); }}
            type="button"
          >
            {item.label}
          </button>
        ) : item.label}
      </li>
    ))}
  </ol>
);
