import type { SyntheticEvent } from "react";
import type { PracticeShortlistItem } from "../../api/practiceContextSchema";
import type { SimulationHistoryItem, SimulationProgress } from "../../api/simulationSchema";
import { formText, simulationStrategyText } from "../../model/simulationPlan";
import "./SimulationWorkspace.css";

interface RunRequest {
  readonly count: number;
  readonly note: string;
  readonly strategy: string;
}

interface SimulationWorkspaceProps {
  readonly history: readonly SimulationHistoryItem[];
  readonly onOpenHistory: (historyId: string) => void;
  readonly onRun: (request: RunRequest) => void;
  readonly pending: boolean;
  readonly progress: SimulationProgress | undefined;
  readonly shortlist: readonly PracticeShortlistItem[];
  readonly teamClaimed: boolean;
}

export function SimulationWorkspace(props: SimulationWorkspaceProps) {
  const progressPercent = props.progress === undefined
    ? 0
    : Math.round((props.progress.completed / props.progress.total) * 100);
  const submit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const count = Number(formText(data, "count"));
    props.onRun({
      count,
      note: formText(data, "note"),
      strategy: simulationStrategyText(props.shortlist, formText(data, "instructions")),
    });
  };

  return (
    <section aria-labelledby="simulation-workspace-title" className="simulation-workspace">
      <div><p className="practice-eyebrow">Simulations</p><h2 id="simulation-workspace-title">Run full-league drafts</h2></div>
      {!props.teamClaimed && <p className="simulation-workspace__notice">Claim a team before running private league simulations.</p>}
      <form onSubmit={submit}>
        <label><span>Additional draft instructions</span><textarea
          name="instructions"
          placeholder="Prioritize Week 1 scoring. Do not spend over $25 on another WR."
          rows={3}
        /></label>
        <div className="simulation-workspace__fields">
          <label><span>Number of simulations</span><input defaultValue="25" max="100" min="1" name="count" required type="number" /></label>
          <label><span>Run label</span><input name="note" placeholder="What are you comparing?" type="text" /></label>
        </div>
        <button disabled={!props.teamClaimed || props.pending} type="submit">
          {props.pending ? "Running simulations" : "Run simulations"}
        </button>
        {props.pending && <div aria-live="polite" className="simulation-workspace__progress">
          <progress
            aria-label="Simulation progress"
            max={props.progress?.total ?? 1}
            value={props.progress?.completed ?? 0}
          />
          <span>{props.progress === undefined
            ? "Preparing league simulations…"
            : `${String(props.progress.completed)} of ${String(props.progress.total)} drafts complete (${String(progressPercent)}%)`}</span>
        </div>}
      </form>
      <div className="simulation-history">
        <h3>Previous runs</h3>
        {props.history.length === 0
          ? <p className="practice-empty">No saved simulation runs yet.</p>
          : <ol>{props.history.map(item => <li key={item.id}>
              <div><strong>{item.simulation.strategy.summary}</strong><span>{item.note ?? "No label"}</span></div>
              <button
                aria-label={`Open ${String(item.simulation.runCount)}-run simulation from ${item.completedAt ?? item.createdAt ?? "saved history"}`}
                onClick={() => { props.onOpenHistory(item.id); }}
                type="button"
              >Open</button>
            </li>)}</ol>}
      </div>
    </section>
  );
}
